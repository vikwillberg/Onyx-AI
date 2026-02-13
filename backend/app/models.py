from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON, String
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    email: str = Field(sa_column=Column(String, unique=True, index=True, nullable=False))
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id", index=True)
    name: str
    description: Optional[str] = None
    business_category: Optional[str] = None
    business_context: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    chat_history_json: Optional[list] = Field(default=None, sa_column=Column(JSON))
    thumbnail_data_url: Optional[str] = Field(default=None, sa_column=Column(String, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Dataset(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id", index=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    profile_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    merge_suggestions_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    merged_profile_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    merged_path: Optional[str] = None
    sample_visuals_json: Optional[list[dict]] = Field(default=None, sa_column=Column(JSON))
    final_visuals_json: Optional[list[dict]] = Field(default=None, sa_column=Column(JSON))
    dictionary_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class DataFile(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    dataset_id: UUID = Field(foreign_key="dataset.id", index=True)
    original_filename: str
    stored_path: str
    table_name: Optional[str] = None
    parquet_path: Optional[str] = None
    row_count: int
    column_count: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
