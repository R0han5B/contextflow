import asyncio

from fastapi import APIRouter, HTTPException

from backend.services.mongo import delete_all_documents_and_chunks, delete_document, list_documents

router = APIRouter()


@router.get("/documents")
async def get_documents():
    documents = await asyncio.to_thread(list_documents)
    return {"documents": documents}


@router.delete("/documents/{document_id}")
async def remove_document(document_id: str):
    result = await asyncio.to_thread(delete_document, document_id)
    if result["deletedDocumentCount"] == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "success": True,
        "documentId": document_id,
        "deletedChunkCount": result["deletedChunkCount"],
    }


@router.delete("/cleanup")
async def cleanup_documents():
    result = await asyncio.to_thread(delete_all_documents_and_chunks)
    return {
        "success": True,
        "deletedDocumentCount": result["deletedDocumentCount"],
        "deletedChunkCount": result["deletedChunkCount"],
    }
