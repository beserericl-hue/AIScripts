from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cshse_env: Literal["prod", "dev"] = Field(default="dev")

    qdrant_url: str = Field(default="http://qdrant.railway.internal:6333")
    qdrant_api_key: str = ""

    anthropic_api_key: str = ""
    openai_api_key: str = ""

    node_service_hmac_secret: str = ""

    cross_institution_search_enabled: bool = False

    mongo_url: str = ""

    @property
    def specs_collection(self) -> str:
        return "cshse_specs"

    @property
    def sections_collection(self) -> str:
        return f"cshse_sections_{self.cshse_env}"

    @property
    def xinst_collection(self) -> str:
        return f"cshse_narratives_xinst_{self.cshse_env}"

    @property
    def corrections_collection(self) -> str:
        """Per-institution coordinator-supplied corrections (few-shot pool)."""
        return f"cshse_corrections_{self.cshse_env}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
