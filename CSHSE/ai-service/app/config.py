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

    @property
    def matrix_columns_collection(self) -> str:
        """Per-institution confirmed matrix column → course mappings.

        Built up over time as the coordinator confirms (or overrides) the
        AI's inferred mappings on the wizard's Matrix step. Filtered at
        retrieval by institutionId so one institution's catalog never
        leaks into another's inference prompt.
        """
        return f"cshse_matrix_columns_{self.cshse_env}"

    @property
    def matrix_context_collection(self) -> str:
        """Per-institution surrounding-narrative paragraphs that name course
        codes near the curriculum matrix anchors. Drives the RAG side of
        the column-inference endpoint when mammoth has stripped merged-cell
        headers from the raw `<table>`.
        """
        return f"cshse_matrix_context_{self.cshse_env}"

    @property
    def evidence_collection(self) -> str:
        """CR-018 — per-institution evidence-document chunks for the RAG
        side of evidence-spec scoring. Filtered at retrieval time by
        institutionId so one institution's uploads never surface in
        another's prompt.
        """
        return f"cshse_evidence_{self.cshse_env}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
