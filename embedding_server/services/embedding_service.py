from sentence_transformers import SentenceTransformer
from typing import List

class EmbeddingService:
    def __init__(self) -> None:
        # Load model once when service starts
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

    def embed(self, text: str) -> List[float]:
        if not text.strip():
            raise ValueError("Text cannot be empty")

        embedding = self.model.encode(text)
        return embedding.tolist()
