"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import profile, cv, jobs, drafts, gmail, history, auth

app = FastAPI(
    title="AI Job Application API",
    version="1.0.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
)

# CORS — allow only configured frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(cv.router, prefix="/api/cv", tags=["CV"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["Drafts"])
app.include_router(gmail.router, prefix="/api/gmail", tags=["Gmail"])
app.include_router(history.router, prefix="/api/history", tags=["History"])


@app.get("/health")
async def health():
    return {"status": "ok"}
