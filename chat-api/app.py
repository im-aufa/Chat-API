from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from openai import OpenAI
import os
import psycopg2
from contextlib import contextmanager

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@contextmanager
def get_db():
    conn = psycopg2.connect(
        dbname="ai_db", user="aufaim", password=os.getenv("POSTGRES_PASSWORD"),
        host="postgres", port="5432"
    )
    try:
        yield conn
    finally:
        conn.close()

class QueryRequest(BaseModel):
    query: str

@app.post("/chat")
async def chat(request: QueryRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO chats (query) VALUES (%s)", (request.query,))
        conn.commit()
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": request.query}],
            max_tokens=150,
        )
        return {"response": response.choices[0].message.content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Chat API running"}