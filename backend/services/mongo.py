import os
from datetime import datetime, timezone

from pymongo import MongoClient

VECTOR_INDEX_NAME = "chunks_embedding_index"
_client: MongoClient | None = None


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        mongodb_uri = os.getenv("MONGODB_URI")
        if not mongodb_uri:
            raise RuntimeError("MONGODB_URI is not configured")
        _client = MongoClient(mongodb_uri)
    return _client


def _get_database():
    client = _get_client()
    database = client.get_default_database()
    return database if database is not None else client["contextflow"]


def get_documents_collection():
    return _get_database()["documents"]


def get_chunks_collection():
    return _get_database()["chunks"]


def insert_document(document: dict) -> None:
    get_documents_collection().insert_one(document)


def insert_chunks(chunks: list[dict]) -> None:
    if chunks:
        get_chunks_collection().insert_many(chunks)


def list_documents() -> list[dict]:
    documents = list(
        get_documents_collection()
        .find({}, {"_id": 0})
        .sort("uploadedAt", -1)
    )
    return documents


def delete_document(document_id: str) -> dict:
    document_result = get_documents_collection().delete_one({"id": document_id})
    chunk_result = get_chunks_collection().delete_many({"documentId": document_id})
    return {
        "deletedDocumentCount": document_result.deleted_count,
        "deletedChunkCount": chunk_result.deleted_count,
    }


def delete_all_documents_and_chunks() -> dict:
    document_result = get_documents_collection().delete_many({})
    chunk_result = get_chunks_collection().delete_many({})
    return {
        "deletedDocumentCount": document_result.deleted_count,
        "deletedChunkCount": chunk_result.deleted_count,
    }


def vector_search_chunks(query_vector: list[float], limit: int = 5) -> list[dict]:
    """Run Atlas Vector Search over the chunk embeddings."""
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": max(limit * 10, 50),
                "limit": limit,
            }
        },
        {
            "$project": {
                "_id": 0,
                "id": 1,
                "documentId": 1,
                "documentName": 1,
                "chunkIndex": 1,
                "text": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]
    return list(get_chunks_collection().aggregate(pipeline))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
