import asyncio
import uuid

import fitz
from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.services.chunker import chunk_text, clean_text
from backend.services.embedder import embed_texts
from backend.services.mongo import insert_chunks, insert_document, now_iso

router = APIRouter()


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Read every page with PyMuPDF for reliable PDF extraction."""
    document = fitz.open(stream=file_bytes, filetype="pdf")
    pages = [page.get_text("text") for page in document]
    document.close()
    return "\n".join(pages)


def _extract_text(file_bytes: bytes, filename: str) -> str:
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        return _extract_text_from_pdf(file_bytes)

    if lower_name.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")

    # Last-resort fallback for plain text uploads with non-standard extensions.
    return file_bytes.decode("utf-8", errors="ignore")


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")

        file_bytes = await file.read()
        raw_text = await asyncio.to_thread(_extract_text, file_bytes, file.filename)
        cleaned_text = clean_text(raw_text)

        if not cleaned_text:
            raise HTTPException(status_code=400, detail="File contains no readable text")

        chunks = chunk_text(cleaned_text, chunk_size=500, overlap=50)
        if not chunks:
            raise HTTPException(status_code=400, detail="Unable to create chunks from file")

        embeddings = await asyncio.to_thread(embed_texts, chunks)
        document_id = uuid.uuid4().hex

        document_record = {
            "_id": document_id,
            "id": document_id,
            "name": file.filename,
            "uploadedAt": now_iso(),
            "chunkCount": len(chunks),
        }

        chunk_records = []
        for index, chunk in enumerate(chunks):
            chunk_id = uuid.uuid4().hex
            chunk_records.append(
                {
                    "_id": chunk_id,
                    "id": chunk_id,
                    "documentId": document_id,
                    "documentName": file.filename,
                    "chunkIndex": index,
                    "text": chunk,
                    "embedding": embeddings[index],
                }
            )

        await asyncio.to_thread(insert_document, document_record)
        await asyncio.to_thread(insert_chunks, chunk_records)

        return {
            "success": True,
            "message": "Document uploaded and indexed successfully",
            "documentId": document_id,
            "chunkCount": len(chunk_records),
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {error}") from error
