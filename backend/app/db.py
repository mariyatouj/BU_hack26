"""Database setup.

Set DATABASE_URL to your Tiger Data (TimescaleDB / PostgreSQL) connection string, e.g.
  postgresql+psycopg://tsdbadmin:<password>@<host>:<port>/tsdb?sslmode=require
Without it, a local SQLite file is used so the app runs with zero setup.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pantrypass.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
