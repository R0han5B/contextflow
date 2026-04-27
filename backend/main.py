from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ROOT_ENV_PATH)

from backend.routes.analyze import router as analyze_router
from backend.routes.answer import router as answer_router
from backend.routes.documents import router as documents_router
from backend.routes.upload import router as upload_router

app = FastAPI(title="Context Flow Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(upload_router)
app.include_router(answer_router)
app.include_router(documents_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "context-flow-backend"}
