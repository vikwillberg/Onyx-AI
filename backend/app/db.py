from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    # Migrate: add chat_history_json column if missing
    _migrate_add_column("project", "chat_history_json", "TEXT")


def _migrate_add_column(table: str, column: str, col_type: str) -> None:
    """Add a column to an existing table if it doesn't exist (SQLite)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
        except Exception:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
