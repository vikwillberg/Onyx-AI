import json
from pathlib import Path
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_FILES = (str(BACKEND_DIR / ".env"), str(PROJECT_ROOT_DIR / ".env"))


class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    storage_dir: str = "./storage"
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.0-flash"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    cors_origins: list[str] = ["http://localhost:3000"]
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None

    model_config = SettingsConfigDict(env_file=ENV_FILES, case_sensitive=False)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                return [value]
            if isinstance(parsed, list):
                return parsed
            return [value]
        if isinstance(value, list):
            return value
        return ["http://localhost:3000"]


settings = Settings()
