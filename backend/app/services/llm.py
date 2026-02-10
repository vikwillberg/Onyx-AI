import json
import logging
from typing import Any, Optional

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class LLMService:
    def __init__(self) -> None:
        self._client: Optional[OpenAI] = None
        self._model: str = ""
        self._provider: str = "none"

        if settings.groq_api_key:
            self._client = OpenAI(api_key=settings.groq_api_key, base_url=GROQ_BASE_URL)
            self._model = settings.groq_model
            self._provider = "groq"
            logger.info("LLM: using Groq (free) with model %s", self._model)
        elif settings.openai_api_key:
            if settings.openai_base_url:
                self._client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
            else:
                self._client = OpenAI(api_key=settings.openai_api_key)
            self._model = settings.openai_model
            self._provider = "openai"
            logger.info("LLM: using OpenAI with model %s", self._model)
        elif settings.openai_base_url:
            self._client = OpenAI(api_key="local", base_url=settings.openai_base_url)
            self._model = settings.openai_model
            self._provider = "local"
            logger.info("LLM: using local endpoint %s", settings.openai_base_url)
        else:
            logger.info("LLM: no API key configured — AI features disabled")

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @property
    def provider(self) -> str:
        return self._provider

    def request_json(self, system_prompt: str, user_prompt: str, max_tokens: int = 1200) -> Optional[dict[str, Any]]:
        if not self._client:
            return None
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content
            if not content:
                return None
            return json.loads(content)
        except Exception as exc:
            logger.warning("LLM request failed (%s): %s", self._provider, exc)
            return None


llm_service = LLMService()
