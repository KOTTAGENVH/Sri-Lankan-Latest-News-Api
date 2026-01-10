import os
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from services.embedding_service import EmbeddingService

def load_env(path: str = ".env"):
    if not os.path.exists(path):
        return

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

load_env()

app = FastAPI(
    title="Embedding Service",
    version="1.0.0",
    description="Embedding service for Sri Lankan news semantic search"
)

embedding_service = EmbeddingService()

api_key = os.getenv("EMBEDDING_API_KEY")

class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
def verify_api_key(embedding_news_api_key: str = Header(..., alias="embedding_news_api_key")):
    if not api_key or embedding_news_api_key != api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.post("/embed/text", response_model=EmbedResponse)
def get_embedding_text(
    request: EmbedRequest,
    _: None = Depends(verify_api_key)
):
    try:
        vector = embedding_service.embed(request.text)
        return {"embedding": vector}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
