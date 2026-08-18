from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    database_url : str
    jwt_secret : str
    jwt_expire_minutes : int = 30

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")

settings = Settings()
