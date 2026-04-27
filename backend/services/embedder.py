from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate normalized embeddings for a batch of texts."""
    if not texts:
        return []

    model = _get_model()
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return [[float(value) for value in row] for row in embeddings]


def embed_text(text: str) -> list[float]:
    """Generate a single embedding while reusing the shared model instance."""
    vectors = embed_texts([text])
    return vectors[0] if vectors else []
