from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings

DATABASE_URL = settings.database_url

# SQL echo is debug noise — off in production to avoid logging
# query params (phones, names) to stdout.
engine = create_engine(DATABASE_URL, echo=not settings.is_production)

SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()