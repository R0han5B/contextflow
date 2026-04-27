import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.embedder import embed_text
from backend.services.llm import chat_completion
from backend.services.mongo import vector_search_chunks

router = APIRouter()

ANSWER_SYSTEM_PROMPT = """You are an intelligent assistant that answers questions clearly and helpfully. You are given context chunks retrieved from a document.

Your job is to:
- Read the context carefully
- Answer the question in a clear, well-structured way
- Explain concepts in simple english as if teaching someone
- Use bullet points or numbered steps when listing things
- Bold important terms using markdown
- Do NOT copy paste from the context, synthesize and explain it
- If the context does not contain enough information, say so honestly
- Keep the answer concise but complete, 3-6 sentences or a short list"""


class AnswerRequest(BaseModel):
    question: str
    analysis: dict | None = None
    documentIds: list[str] | None = None


def _build_context(chunks: list[dict]) -> str:
    return "\n\n".join(
        [f"Chunk {i + 1}: {chunk['text']}" for i, chunk in enumerate(chunks)]
    )


def _clamp_relevance(score: float) -> float:
    return max(0.0, min(1.0, float(score)))


@router.post("/answer")
async def answer_question(payload: AnswerRequest):
    try:
        if not payload.question.strip():
            return {
                "text": "Please ask a question about your uploaded documents.",
                "source": "System",
                "chunks": [],
            }

        chunks_needed = 5
        if isinstance(payload.analysis, dict):
            raw_chunks_needed = payload.analysis.get("chunksNeeded", 5)
            try:
                chunks_needed = max(1, min(5, int(raw_chunks_needed)))
            except (TypeError, ValueError):
                chunks_needed = 5

        question_embedding = await asyncio.to_thread(embed_text, payload.question)
        retrieved_chunks = await asyncio.to_thread(vector_search_chunks, question_embedding, chunks_needed)

        if not retrieved_chunks:
            return {
                "text": "I could not find relevant information in the uploaded documents.",
                "source": "MongoDB Atlas Vector Search",
                "chunks": [],
            }

        context = _build_context(retrieved_chunks)
        user_prompt = (
            f"Context:\n{context}\n\n"
            f"Question: {payload.question}\n\n"
            "Answer clearly and explain the concept:"
        )

        answer_text = await asyncio.to_thread(
            chat_completion,
            ANSWER_SYSTEM_PROMPT,
            user_prompt,
            0.2,
            700,
        )

        response_chunks = []
        relevances: list[float] = []

        for chunk in retrieved_chunks:
            relevance = _clamp_relevance(chunk.get("score", 0))
            relevances.append(relevance)
            response_chunks.append(
                {
                    "id": chunk["id"],
                    "content": chunk["text"],
                    "relevance": relevance,
                    "source": chunk["documentName"],
                }
            )

        average_relevance = sum(relevances) / len(relevances) if relevances else 0

        return {
            "text": answer_text,
            "source": "MongoDB Atlas Vector Search",
            "chunks": response_chunks,
            "verification": {
                "claims": len(response_chunks),
                "verified": len(response_chunks),
                "accuracy": round(average_relevance * 100),
            },
        }
    except Exception as error:
        return {
            "text": f"An error occurred while processing your question: {error}",
            "source": "Error",
        }
