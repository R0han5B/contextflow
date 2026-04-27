# Context Flow

Context Flow is a retrieval-augmented document intelligence application built for asking clear, grounded questions over uploaded PDFs. It combines a polished Next.js interface with a FastAPI backend that handles parsing, embedding, retrieval, and answer generation.

## Overview

The application keeps the user interface in Next.js while delegating the full retrieval pipeline to Python. Uploaded files are parsed, split into overlapping chunks, embedded locally, stored in MongoDB Atlas, and retrieved through Atlas Vector Search before being passed to OpenRouter for answer generation.

## Core Capabilities

- Upload PDF or plain text files for temporary document analysis
- Generate local embeddings with `sentence-transformers/all-MiniLM-L6-v2`
- Search document chunks with MongoDB Atlas Vector Search
- Classify incoming questions before retrieval
- Generate concise answers grounded in retrieved context
- Inspect source chunks and lightweight verification metadata
- Automatically clean uploaded data when the session ends

## Architecture

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui

### Backend

- FastAPI
- PyMuPDF
- sentence-transformers
- pymongo
- OpenRouter

### Data Layer

- MongoDB Atlas
- Atlas Vector Search
- 384-dimensional embeddings

## Retrieval Pipeline

1. A user uploads a PDF or `.txt` file from the browser.
2. FastAPI extracts raw text from the file.
3. Text is normalized and split into 500-character chunks with 50-character overlap.
4. Each chunk is embedded locally using `all-MiniLM-L6-v2`.
5. Documents and chunk embeddings are stored in MongoDB Atlas.
6. A user question is analyzed through OpenRouter.
7. The question is embedded and used in Atlas Vector Search.
8. The most relevant chunks are assembled into a prompt.
9. OpenRouter generates a grounded, user-friendly answer.

## API Surface

### Next.js Proxy Routes

- `POST /api/documents/upload`
- `POST /api/documents/cleanup`
- `POST /api/analyze`
- `POST /api/answer`

### FastAPI Routes

- `POST /upload`
- `DELETE /cleanup`
- `POST /analyze`
- `POST /answer`
- `GET /documents`
- `DELETE /documents/{documentId}`

## Environment Variables

Use the root [.env](</c:/game/IIITH/.env>) file.

```env
MONGODB_URI="your-atlas-uri"
PYTHON_BACKEND_URL="http://localhost:8000"
OPENROUTER_API_KEY="your-openrouter-key"
OPENROUTER_MODEL="openrouter/free"
```

### Notes

- `MONGODB_URI` is required by the FastAPI backend.
- `OPENROUTER_MODEL` can stay as `openrouter/free` if you want OpenRouter to select a free model automatically.
- You can pin a specific model later without changing the application structure.

## MongoDB Atlas Setup

Create a vector index on the `chunks` collection with the following settings:

- Index name: `chunks_embedding_index`
- Field path: `embedding`
- Dimensions: `384`
- Similarity: `cosine`

Example definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```

The application can upload documents without this index, but retrieval-based answers will not work until the index status is `READY`.

## Local Development

### Install Frontend Dependencies

```bash
bun install
```

### Install Backend Dependencies

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run the Application

### Start FastAPI from the Project Root

```bash
backend\.venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Or Start FastAPI from Inside `backend`

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Start the Frontend

```bash
bun run dev
```

Open `http://localhost:3000` in your browser.

## Bun Commands

```bash
bun run dev
bun run build
bun run start
bun run lint
```

## Prisma Commands

Prisma remains in the repository, but it is not part of the active RAG pipeline because the backend uses `pymongo` directly.

```bash
bun run db:generate
bun run db:push
bun run db:migrate
bun run db:reset
```

### Notes

- Prisma commands are optional for normal application use.
- `bun run db:push` can be used if you want Prisma to create its own schema collections in Atlas.
- Avoid `bun run db:reset` unless you explicitly want destructive behavior.

## Project Structure

```text
src/
  app/
    api/                    # Next.js proxy routes
  components/               # UI components
  hooks/                    # Client hooks
  lib/                      # Shared frontend utilities

backend/
  main.py                   # FastAPI application entry point
  routes/                   # Upload, analyze, answer, cleanup, documents
  services/                 # Chunking, embeddings, Mongo, OpenRouter

prisma/
  schema.prisma             # Kept in repo, not used by the active RAG path
```

## Operational Notes

- Uploaded document data is treated as session-scoped and can be cleared automatically or manually.
- Embeddings are generated locally, so no paid embedding provider is required.
- OpenRouter is used for question analysis and final answer generation only.
- If the application reports no relevant results, check the Atlas vector index status first.
