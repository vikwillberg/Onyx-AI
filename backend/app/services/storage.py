import re
import shutil
from pathlib import Path
from typing import IO
from uuid import UUID

from app.core.config import settings


def ensure_storage_dirs() -> None:
    base = Path(settings.storage_dir)
    (base / "files").mkdir(parents=True, exist_ok=True)
    (base / "datasets").mkdir(parents=True, exist_ok=True)


def dataset_files_dir(dataset_id: UUID) -> Path:
    return Path(settings.storage_dir) / "files" / str(dataset_id)


def dataset_data_dir(dataset_id: UUID) -> Path:
    return Path(settings.storage_dir) / "datasets" / str(dataset_id)


def merged_dataset_path(dataset_id: UUID) -> Path:
    return dataset_data_dir(dataset_id) / "merged.parquet"


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", filename.strip())
    return cleaned or "upload"


def save_upload_file(file_obj: IO[bytes], filename: str, dataset_id: UUID, file_id: UUID) -> str:
    dataset_dir = dataset_files_dir(dataset_id)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    safe_name = sanitize_filename(filename)
    target_path = dataset_dir / f"{file_id}_{safe_name}"
    with target_path.open("wb") as buffer:
        shutil.copyfileobj(file_obj, buffer)
    return str(target_path)


def delete_project_files(project_id: UUID) -> None:
    """Remove all stored files and datasets for a project."""
    base = Path(settings.storage_dir)
    for sub in ("files", "datasets"):
        parent = base / sub
        if not parent.exists():
            continue
        for child in parent.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
