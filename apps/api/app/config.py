from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    database_url : str
    jwt_secret : str
    jwt_expire_minutes : int = 30
    owner_email: str = "owner@kabarbers.local"
    owner_password: str = "owner123"
    owner_name: str = "Kabarbers Owner"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.cors_origins, str):
            return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return self.cors_origins

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")

settings = Settings()
