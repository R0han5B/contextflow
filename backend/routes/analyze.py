import asyncio
import json
import re

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.llm import chat_completion

router = APIRouter()

DEFAULT_ANALYSIS = {
    "type": "factual",
    "complexity": 2,
    "entities": [],
    "chunksNeeded": 3,
    "confidence": 50,
}

SYSTEM_PROMPT = """You are a question classifier. Given a question, respond ONLY with a JSON object with these fields:
- type: one of factual, conceptual, procedural, analytical
- complexity: integer 1-5
- entities: array of key terms found in the question
- chunksNeeded: estimated number of text chunks needed to answer (1-5)
- confidence: integer 0-100
Do not include any explanation, only the JSON object."""


class QuestionRequest(BaseModel):
    question: str


def _normalize_analysis(payload: dict) -> dict:
    valid_types = {"factual", "conceptual", "procedural", "analytical"}
    question_type = payload.get("type", DEFAULT_ANALYSIS["type"])
    if question_type not in valid_types:
        question_type = DEFAULT_ANALYSIS["type"]

    complexity = payload.get("complexity", DEFAULT_ANALYSIS["complexity"])
    confidence = payload.get("confidence", DEFAULT_ANALYSIS["confidence"])
    chunks_needed = payload.get("chunksNeeded", DEFAULT_ANALYSIS["chunksNeeded"])
    entities = payload.get("entities", DEFAULT_ANALYSIS["entities"])

    if not isinstance(entities, list):
        entities = []

    return {
        "type": question_type,
        "complexity": max(1, min(5, int(complexity))),
        "entities": [str(entity) for entity in entities],
        "chunksNeeded": max(1, min(5, int(chunks_needed))),
        "confidence": max(0, min(100, int(confidence))),
    }


def _extract_json(raw_text: str) -> dict:
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if not match:
        raise ValueError("No JSON object found in LLM response")
    return json.loads(match.group(0))


@router.post("/analyze")
async def analyze_question(payload: QuestionRequest):
    if not payload.question.strip():
        return DEFAULT_ANALYSIS

    try:
        llm_response = await asyncio.to_thread(
            chat_completion,
            SYSTEM_PROMPT,
            payload.question,
            0,
            250,
        )
        parsed = _extract_json(llm_response)
        return _normalize_analysis(parsed)
    except Exception:
        return DEFAULT_ANALYSIS
