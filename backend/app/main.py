from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import init_db
from app.routers import auth, datasets, google_auth, models, projects, visuals
from app.services.storage import ensure_storage_dirs


def create_app() -> FastAPI:
    app = FastAPI(title="AI Powered Analytics API")

    base_dir = Path(__file__).resolve().parent.parent.parent
    frontend_dir = base_dir / "frontend"
    if frontend_dir.exists():
        app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

        @app.get("/", response_class=FileResponse)
        def serve_frontend():
            return FileResponse(frontend_dir / "index.html")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"] ,
        allow_headers=["*"] ,
    )

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        ensure_storage_dirs()

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(google_auth.router, prefix="/auth", tags=["auth"])
    app.include_router(projects.router, prefix="/projects", tags=["projects"])
    app.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
    app.include_router(visuals.router, prefix="/visuals", tags=["visuals"])
    app.include_router(models.router, prefix="/models", tags=["models"])

    return app


app = create_app()
