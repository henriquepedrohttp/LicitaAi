import logging
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.documents import router as documents_router
from app.requirements import router as requirements_router
from app.workflow import router as workflow_router

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
app = FastAPI(title="LicitaAI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "licitaai-api"}


@app.get("/health/ready")
def readiness():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "not_configured"})
    try:
        with psycopg.connect(database_url, connect_timeout=3) as connection:
            connection.execute("SELECT 1").fetchone()
    except psycopg.Error:
        logging.getLogger(__name__).warning("Database readiness check failed")
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unreachable"})
    return {"status": "ok", "database": "connected"}


app.include_router(documents_router)

app.include_router(requirements_router)

app.include_router(workflow_router)
