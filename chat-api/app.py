from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import os
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "https://aufaim.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str

@app.post("/chat")
async def chat(request: QueryRequest):
    logger.debug(f"Received query: {request.query}")
    try:
        # Define Cerince's system message
        system_message = (
            "I am Cerince, your friendly assistant! I can chat with you about anything "
            "or provide specific information about menstruation and cervix when relevant."
        )
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_message},  # Add this
                {"role": "user", "content": request.query}
            ],
            max_tokens=150,
        )
        logger.debug(f"OpenAI response: {response.choices[0].message.content}")
        return {"response": response.choices[0].message.content.strip()}
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Chat API running"}