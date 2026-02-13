from datetime import datetime
from typing import Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password too long (max 72 bytes).")
        return value


class UserRead(BaseModel):
    id: UUID
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    business_category: Optional[str] = None
    business_context: Optional[dict] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail_data_url: Optional[str] = None
    chat_history_json: Optional[list] = None


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    business_category: Optional[str] = None
    business_context: Optional[dict] = None
    chat_history_json: Optional[list] = None
    thumbnail_data_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetCreate(BaseModel):
    name: str


class DatasetRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DataFileRead(BaseModel):
    id: UUID
    original_filename: str
    row_count: int
    column_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ColumnProfile(BaseModel):
    name: str
    normalized_name: str
    inferred_type: str
    sample_values: list
    null_ratio: float
    unique_count: int
    min_value: Optional[Union[float, str]] = None
    max_value: Optional[Union[float, str]] = None
    mean_value: Optional[float] = None
    top_values: Optional[list] = None


class FileProfile(BaseModel):
    file_id: UUID
    name: str
    row_count: int
    column_count: int
    columns: list[ColumnProfile]


class DatasetProfile(BaseModel):
    files: list[FileProfile]
    generated_at: datetime


class DatasetPreview(BaseModel):
    columns: list[str]
    rows: list[dict]


class MergeSuggestion(BaseModel):
    left_file_id: UUID
    right_file_id: UUID
    left_column: str
    right_column: str
    score: float
    reason: str
    source: str
    sample_left: Optional[list] = None
    sample_right: Optional[list] = None


class MergeSuggestions(BaseModel):
    suggestions: list[MergeSuggestion]
    generated_at: datetime


class DatasetUploadResponse(BaseModel):
    dataset: DatasetRead
    files: list[DataFileRead]
    profile: DatasetProfile
    merge_suggestions: MergeSuggestions


class MergeInstruction(BaseModel):
    left_file_id: UUID
    right_file_id: UUID
    left_on: str
    right_on: str
    how: str = "inner"


class MergeRequest(BaseModel):
    instructions: list[MergeInstruction]
    output_name: Optional[str] = None


class MergeResponse(BaseModel):
    dataset: DatasetRead
    merged_profile: FileProfile


class VisualSpec(BaseModel):
    visual_id: str
    type: str
    title: str
    x: Optional[str] = None
    y: Optional[str] = None
    values: Optional[str] = None
    aggregation: Optional[str] = None
    data: Optional[list[dict]] = None
    config: Optional[dict] = None


class VisualSelectionRequest(BaseModel):
    selected_visual_ids: list[str]


class VisualMoreRequest(BaseModel):
    selected_visual_ids: Optional[list[str]] = None


class VisualCustomRequest(BaseModel):
    type: str
    title: Optional[str] = None
    x: Optional[str] = None
    y: Optional[str] = None
    values: Optional[str] = None
    aggregation: Optional[str] = None
    columns: Optional[list[str]] = None
    visual_id: Optional[str] = None


class VisualResponse(BaseModel):
    visuals: list[VisualSpec]
    generated_at: datetime


class DatasetDetail(BaseModel):
    dataset: DatasetRead
    files: list[DataFileRead]
    profile: Optional[DatasetProfile] = None
    merge_suggestions: Optional[MergeSuggestions] = None
    merged_profile: Optional[FileProfile] = None
    sample_visuals: Optional[list[VisualSpec]] = None
    final_visuals: Optional[list[VisualSpec]] = None


class DuelRound(BaseModel):
    round: int
    option_a: VisualSpec
    option_b: VisualSpec
    round_label: Optional[str] = None


class DuelPoolResponse(BaseModel):
    rounds: list[DuelRound]
    kpis: list[VisualSpec]
    pool_size: int
    generated_at: datetime


class DuelPoolRequest(BaseModel):
    exclude_signatures: Optional[list[list]] = None


class DuelPickRequest(BaseModel):
    picked_visuals: list[VisualSpec]


class FilterRequest(BaseModel):
    date_start: Optional[str] = None
    date_end: Optional[str] = None
    column_filters: Optional[list[dict]] = None


class AiChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AiChatRequest(BaseModel):
    message: str
    history: list[AiChatMessage] = []


class AiChatResponse(BaseModel):
    reply: str
    done: bool = False
    insights: Optional[dict] = None
    model_name: Optional[str] = None


class AiVisualRequest(BaseModel):
    prompt: str
    history: list[AiChatMessage] = []
