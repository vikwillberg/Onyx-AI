from fastapi import APIRouter

from app.services.llm import get_available_models

router = APIRouter()


@router.get("/", summary="List all available AI models with pricing")
def list_models() -> list[dict]:
    """Return the full model registry, indicating which models have API keys configured."""
    return get_available_models()
