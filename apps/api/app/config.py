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
    # Login with Facebook (OAuth2 Authorization Code). Optional: the app
    # boots fine without these, but /auth/facebook/login refuses with a
    # clear 500 until both are set. Secrets come from the environment only.
    facebook_app_id: str | None = None
    facebook_app_secret: str | None = None
    facebook_redirect_uri: str = "http://localhost:8000/auth/facebook/callback"
    # Override when Meta sunsets a version — no code change needed.
    facebook_graph_version: str | None = None
    # Where the OAuth callback sends the user after issuing our own JWT.
    frontend_url: str = "http://localhost:5173"
    # Local disk storage for uploaded GCash proof images.
    # Resolved relative to the API working dir (apps/api) unless absolute.
    upload_dir: str = "uploads/payment_proofs"
    max_proof_mb: int = 5

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.cors_origins, str):
            return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return self.cors_origins

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")

settings = Settings()
