from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Application
    app_env: str = "production"
    app_secret_key: str = "change-me"

    # Authorized user
    authorized_user_email: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_publishable_key: str = ""
    supabase_service_role_key: str = ""

    @property
    def effective_anon_key(self) -> str:
        return self.supabase_anon_key or self.supabase_publishable_key

    # Groq
    groq_api_key: str = ""
    groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # URLs
    frontend_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
