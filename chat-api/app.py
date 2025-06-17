import os
import pickle
import logging
from typing import List, Optional
import glob
import tiktoken
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from docling.chunking import HybridChunker
from docling.document_converter import DocumentConverter
from dotenv import load_dotenv
from openai import OpenAI
import psycopg2
from psycopg2.extras import execute_values
import numpy as np
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
from fastapi.security import APIKeyHeader

# --- Setup ---
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("/var/log/cerince_api.log")]
)
logger = logging.getLogger(__name__)

# --- OpenAI Configuration ---
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- Tokenizer ---
class OpenAITokenizerWrapper:
    def __init__(self, model_name: str = "text-embedding-3-large"):
        self.model_name = model_name
        try:
            self.encoding = tiktoken.encoding_for_model(self.model_name)
        except KeyError:
            logger.warning(f"Model '{self.model_name}' not found. Using 'cl100k_base'.")
            self.encoding = tiktoken.get_encoding("cl100k_base")

    def count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text))

    def encode(self, text: str) -> List[int]:
        return self.encoding.encode(text)

    def decode(self, tokens: List[int]) -> str:
        return self.encoding.decode(tokens)

tokenizer = OpenAITokenizerWrapper()
MAX_TOKENS = 8191
EMBEDDING_MODEL = "text-embedding-3-large"
CHAT_MODEL = "gpt-3.5-turbo"  # Accessible model

# --- Google Drive Configuration ---
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDENTIALS_FILE = '/app/credentials.json'
TOKEN_FILE = '/app/data/token.pickle'
DEFAULT_GOOGLE_DRIVE_FOLDER_ID = os.getenv('GOOGLE_DRIVE_FOLDER_ID')

# --- PostgreSQL Configuration ---
DB_PARAMS = {
    "dbname": os.getenv("POSTGRES_DB", "rag_db"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "host": os.getenv("POSTGRES_HOST", "postgres"),
    "port": os.getenv("POSTGRES_PORT", "5432")
}

# --- FastAPI Setup ---
app = FastAPI(title="Cerince RAG API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://aufaim.com", "https://api.aufaim.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Key Authentication ---
API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if not api_key or api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    return api_key

# --- Google Drive Functions ---
def authenticate_google_drive():
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                logger.error(f"Failed to refresh Google token: {e}")
                creds = None
        if not creds:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(f"Google Drive credentials file ('{CREDENTIALS_FILE}') not found.")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
    
    return build('drive', 'v3', credentials=creds)

def list_gdrive_files(folder_id):
    service = authenticate_google_drive()
    query = f"'{folder_id}' in parents"
    results = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    return results.get('files', [])

def download_gdrive_file(file_id, file_name, mime_type):
    service = authenticate_google_drive()
    os.makedirs("/tmp", exist_ok=True)
    request = None
    if mime_type == 'application/vnd.google-apps.document':
        logger.info(f"Exporting Google Doc '{file_name}' as PDF.")
        request = service.files().export_media(fileId=file_id, mimeType='application/pdf')
        file_path = f"/tmp/{file_name}.pdf" if not file_name.lower().endswith('.pdf') else f"/tmp/{file_name}"
    else:
        logger.info(f"Downloading standard file '{file_name}'.")
        request = service.files().get_media(fileId=file_id)
        file_path = f"/tmp/{file_name}"
    with open(file_path, 'wb') as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            logger.debug(f"Download progress for {file_name}: {int(status.progress() * 100)}%.")
    return file_path

# --- PostgreSQL Functions ---
def setup_postgres():
    conn = None
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cursor = conn.cursor()
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id SERIAL PRIMARY KEY,
                doc_id VARCHAR(255),
                doc_name VARCHAR(255),
                chunk_index INTEGER,
                text TEXT,
                embedding VECTOR(3072),
                filename VARCHAR(255),
                page_numbers INTEGER[],
                title VARCHAR(255),
                source_type VARCHAR(50),
                UNIQUE (doc_id, chunk_index, source_type)
            )
        """)
        conn.commit()
        logger.info("PostgreSQL setup complete.")
    except psycopg2.Error as e:
        logger.error(f"PostgreSQL setup error: {e}")
        raise
    finally:
        if conn:
            cursor.close()
            conn.close()

def embed_text(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    try:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts, dimensions=3072)
        return [embedding.embedding for embedding in response.data]
    except Exception as e:
        logger.error(f"Error embedding text: {e}")
        raise

def store_chunks(chunks_data: List[tuple]):
    if not chunks_data:
        logger.info("No chunks to store.")
        return
    conn = None
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cursor = conn.cursor()
        insert_query = """
        INSERT INTO chunks (doc_id, doc_name, chunk_index, text, embedding, filename, page_numbers, title, source_type)
        VALUES %s
        ON CONFLICT (doc_id, chunk_index, source_type) DO UPDATE SET
            doc_name = EXCLUDED.doc_name,
            text = EXCLUDED.text,
            embedding = EXCLUDED.embedding,
            filename = EXCLUDED.filename,
            page_numbers = EXCLUDED.page_numbers,
            title = EXCLUDED.title;
        """
        execute_values(cursor, insert_query, chunks_data, template="(%s, %s, %s, %s, %s::vector, %s, %s, %s, %s)")
        conn.commit()
        logger.info(f"Stored/Updated {len(chunks_data)} chunks.")
    except psycopg2.Error as e:
        logger.error(f"Error storing chunks: {e}")
    finally:
        if conn:
            cursor.close()
            conn.close()

# --- Document Processing ---
def process_documents(source_type: str, google_drive_folder_id: Optional[str] = None, local_folder_path: Optional[str] = None):
    converter = DocumentConverter()
    chunker = HybridChunker(tokenizer="bert-base-uncased", max_tokens=MAX_TOKENS - 100, merge_peers=True)
    all_chunks_to_store = []
    batch_size = 5  # Process 5 files at a time to reduce memory usage

    if source_type == "google_drive":
        if not google_drive_folder_id:
            raise ValueError("Google Drive Folder ID required.")
        gdrive_files = list_gdrive_files(google_drive_folder_id)
        if not gdrive_files:
            logger.info("No files found in Google Drive folder.")
            return

        # Process files in batches
        for i in range(0, len(gdrive_files), batch_size):
            batch_files = gdrive_files[i:i + batch_size]
            logger.info(f"Processing batch of {len(batch_files)} files (batch {i//batch_size + 1})")
            
            for file_info in batch_files:
                if file_info.get('mimeType') == 'application/vnd.google-apps.folder':
                    continue
                file_name = file_info['name']
                file_id = file_info['id']
                mime_type = file_info['mimeType']
                downloaded_path = None
                try:
                    downloaded_path = download_gdrive_file(file_id, file_name, mime_type)
                    result = converter.convert(downloaded_path)
                    document = result.document
                    chunk_iter = chunker.chunk(dl_doc=document)
                    doc_chunks = list(chunk_iter)
                    if not doc_chunks:
                        logger.warning(f"No chunks for file: {file_name}")
                        continue
                    chunk_texts = [chunk.text for chunk in doc_chunks]
                    embeddings = embed_text(chunk_texts)
                    for j, chunk in enumerate(doc_chunks):
                        page_numbers = sorted(list(set(prov.page_no for item in chunk.meta.doc_items for prov in item.prov if prov.page_no is not None))) or None
                        title = chunk.meta.headings[0] if chunk.meta.headings else None
                        all_chunks_to_store.append((
                            file_id, file_name, j, chunk.text, embeddings[j],
                            chunk.meta.origin.filename, page_numbers, title, "google_drive"
                        ))
                except Exception as e:
                    logger.error(f"Error processing file {file_name}: {e}")
                finally:
                    if downloaded_path and os.path.exists(downloaded_path):
                        os.remove(downloaded_path)
            
            # Store chunks for the current batch
            if all_chunks_to_store:
                store_chunks(all_chunks_to_store)
                all_chunks_to_store = []  # Clear chunks after storing to free memory
                logger.info(f"Stored chunks for batch {i//batch_size + 1}")

    elif source_type == "local":
        if not local_folder_path or not os.path.isdir(local_folder_path):
            raise ValueError(f"Invalid local folder path: {local_folder_path}")
        pdf_files = glob.glob(os.path.join(local_folder_path, "*.pdf"))
        if not pdf_files:
            logger.info(f"No PDF files in {local_folder_path}.")
            return
        for pdf_path in pdf_files:
            doc_name = os.path.basename(pdf_path)
            doc_id = doc_name
            try:
                result = converter.convert(pdf_path)
                document = result.document
                chunk_iter = chunker.chunk(dl_doc=document)
                doc_chunks = list(chunk_iter)
                if not doc_chunks:
                    logger.warning(f"No chunks for PDF: {doc_name}")
                    continue
                chunk_texts = [chunk.text for chunk in doc_chunks]
                embeddings = embed_text(chunk_texts)
                for i, chunk in enumerate(doc_chunks):
                    page_numbers = sorted(list(set(prov.page_no for item in chunk.meta.doc_items for prov in item.prov if prov.page_no is not None))) or None
                    title = chunk.meta.headings[0] if chunk.meta.headings else None
                    all_chunks_to_store.append((
                        doc_id, doc_name, i, chunk.text, embeddings[i],
                        doc_name, page_numbers, title, "local"
                    ))
            except Exception as e:
                logger.error(f"Error processing PDF {doc_name}: {e}")
        if all_chunks_to_store:
            store_chunks(all_chunks_to_store)

# --- RAG Query Functions ---
def search_chunks(query: str, n_results: int = 5) -> List[dict]:
    conn = None
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cursor = conn.cursor()
        query_embedding = embed_text([query])[0]
        cursor.execute("""
            SELECT doc_id, doc_name, chunk_index, text, filename, page_numbers, title, source_type,
                   (embedding <=> %s::vector) as distance
            FROM chunks
            ORDER BY distance ASC
            LIMIT %s
        """, (query_embedding, n_results))
        results = [
            {
                "doc_id": row[0], "doc_name": row[1], "chunk_index": row[2],
                "text": row[3], "filename": row[4], "page_numbers": row[5],
                "title": row[6], "source_type": row[7], "distance": row[8]
            }
            for row in cursor.fetchall()
        ]
        return results
    except psycopg2.Error as e:
        logger.error(f"Database error during chunk search: {e}")
        return []
    finally:
        if conn:
            cursor.close()
            conn.close()

def query_rag(query: str, n_results: int = 5) -> str:
    try:
        relevant_chunks = search_chunks(query, n_results)
        if not relevant_chunks:
            return "I am Cerince, your friendly assistant. I couldn't find any relevant information in the documents to answer your question."
        context = []
        for res in relevant_chunks:
            source_info_parts = []
            if res.get("doc_name"):
                source_info_parts.append(f"Document: '{res['doc_name']}' ({res.get('source_type', 'unknown source')})")
            if res.get("page_numbers"):
                source_info_parts.append(f"Pages: {', '.join(map(str, res['page_numbers']))}")
            if res.get("title"):
                source_info_parts.append(f"Section: '{res['title']}'")
            source_info = " | ".join(filter(None, source_info_parts))
            context.append(f"Context from {source_info}:\n{res['text']}\n---")
        context_str = "\n\n".join(context)
        system_message = (
            "You are Cerince, a friendly AI assistant specializing in providing information about menstruation and cervix when relevant. "
            "Answer the user's question based *only* on the provided context. If the context lacks sufficient information, clearly state that. "
            "Cite your sources by referencing the document name, page numbers, or section titles from the context. Be concise, accurate, and friendly."
        )
        logger.debug(f"Context provided to LLM:\n{context_str}")
        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": f"User Question: {query}\n\nProvided Context:\n{context_str}"}
            ],
            max_tokens=700,
            temperature=0.5
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error querying RAG: {e}")
        return f"I am Cerince, your friendly assistant. An error occurred: {e}"

# --- FastAPI Endpoints ---
class QueryRequest(BaseModel):
    query: str
    n_results: int = Field(5, ge=1, le=20)

class QueryResponse(BaseModel):
    response: str
    retrieved_chunks: Optional[List[dict]] = None

class ProcessRequest(BaseModel):
    source_type: str = Field("google_drive", pattern="^(google_drive|local)$")
    google_drive_folder_id: Optional[str] = DEFAULT_GOOGLE_DRIVE_FOLDER_ID
    local_folder_path: Optional[str] = None

class ProcessResponse(BaseModel):
    status: str
    message: Optional[str] = None
    processed_files: Optional[List[str]] = None

@app.post("/chat", response_model=QueryResponse)
async def chat_endpoint(request: QueryRequest, _api_key: str = Depends(verify_api_key)):
    logger.info(f"Received query: '{request.query}' with n_results={request.n_results}")
    response_text = query_rag(request.query, request.n_results)
    logger.info(f"RAG response generated.")
    return QueryResponse(response=response_text)

@app.post("/process", response_model=ProcessResponse)
async def process_endpoint(request: ProcessRequest, _api_key: str = Depends(verify_api_key)):
    logger.info(f"Processing request: {request.model_dump_json()}")
    try:
        if request.source_type == "local" and not request.local_folder_path:
            raise HTTPException(status_code=400, detail="local_folder_path required.")
        if request.source_type == "google_drive" and not request.google_drive_folder_id:
            raise HTTPException(status_code=400, detail="google_drive_folder_id required.")
        process_documents(
            source_type=request.source_type,
            google_drive_folder_id=request.google_drive_folder_id,
            local_folder_path=request.local_folder_path
        )
        return ProcessResponse(status="success", message="Documents processed successfully.")
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.error(f"Value error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")

@app.get("/")
async def root():
    return {"message": "Cerince RAG API is running."}

# --- Startup Event ---
@app.on_event("startup")
async def startup_event():
    logger.info("Application startup...")
    try:
        setup_postgres()
        logger.info("PostgreSQL connection verified.")
    except Exception as e:
        logger.error(f"Failed to initialize PostgreSQL: {e}")