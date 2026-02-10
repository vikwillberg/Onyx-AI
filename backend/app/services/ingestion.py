import itertools
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import UUID

import pandas as pd

from app.models import DataFile
from app.schemas import ColumnProfile, DatasetProfile, FileProfile, MergeSuggestion, MergeSuggestions
from app.services.llm import llm_service
from app.services.storage import dataset_data_dir

SAMPLE_ROWS = 5000
SAMPLE_VALUES = 6
TOP_VALUES = 6


def normalize_column_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
    return cleaned


def read_tabular_file(path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
    ext = Path(path).suffix.lower()
    if ext in {".xlsx", ".xls"}:
        result = pd.read_excel(path, sheet_name=sheet_name or 0)
        if isinstance(result, dict):
            result = next(iter(result.values()))
        return result
    if ext == ".xlsb":
        result = pd.read_excel(path, sheet_name=sheet_name or 0, engine="pyxlsb")
        if isinstance(result, dict):
            result = next(iter(result.values()))
        return result
    if ext in {".csv", ".tsv", ".txt"}:
        sep = "\t" if ext == ".tsv" else ","
        try:
            return pd.read_csv(path, sep=sep, low_memory=False)
        except UnicodeDecodeError:
            return pd.read_csv(path, sep=sep, low_memory=False, encoding="latin1")
    raise ValueError(f"Unsupported file type: {ext}")


def store_dataframe_parquet(dataset_id: UUID, file_id: UUID, dataframe: pd.DataFrame) -> str:
    data_dir = dataset_data_dir(dataset_id)
    data_dir.mkdir(parents=True, exist_ok=True)
    target_path = data_dir / f"{file_id}.parquet"
    dataframe.to_parquet(target_path, index=False)
    return str(target_path)


def load_dataframe(file_record: DataFile) -> pd.DataFrame:
    if file_record.parquet_path:
        return pd.read_parquet(file_record.parquet_path)
    return read_tabular_file(file_record.stored_path, sheet_name=file_record.table_name)


def to_serializable(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, (pd.Timedelta,)):
        return str(value)
    if isinstance(value, pd.Series):
        return [to_serializable(item) for item in value.tolist()]
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return str(value)
    return value


DATE_NAME_HINTS = {"date", "datetime", "timestamp", "created", "updated", "order_date", "start_date", "end_date", "released", "release_date"}


def _looks_like_date_string(series: pd.Series) -> bool:
    """Try parsing a small sample of string values as dates.

    Rejects time-only strings like '11:38:36 AM' that parse as today's date.
    """
    sample = series.dropna().head(40)
    if sample.empty:
        return False
    try:
        parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
        valid = parsed.dropna()
        success_rate = len(valid) / len(sample)
        if success_rate < 0.8:
            return False
        # Reject time-only strings: if all parsed dates are the same day, it's likely
        # a time column (e.g. "11:38:36 AM" → today's date for all values)
        if len(valid) >= 2:
            span = (valid.max() - valid.min()).days
            if span < 1:
                return False
        return True
    except Exception:
        return False


def infer_series_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    non_null = series.dropna()
    if non_null.empty:
        return "text"
    # Try detecting date strings (e.g. "1/1/23", "2023-01-15")
    col_name = str(series.name).lower().replace("_", " ").replace("-", " ")
    name_hints_date = any(hint in col_name for hint in DATE_NAME_HINTS)
    if name_hints_date and _looks_like_date_string(non_null):
        return "datetime"
    unique_ratio = non_null.nunique() / max(len(non_null), 1)
    return "categorical" if unique_ratio <= 0.2 else "text"


def profile_series(series: pd.Series, sample_rows: int = SAMPLE_ROWS) -> ColumnProfile:
    sampled = series
    if len(series) > sample_rows:
        sampled = series.sample(sample_rows, random_state=42)

    inferred_type = infer_series_type(sampled)
    non_null = sampled.dropna()
    sample_values = [to_serializable(val) for val in non_null.head(SAMPLE_VALUES).tolist()]
    unique_count = int(non_null.nunique()) if not non_null.empty else 0
    null_ratio = float(series.isna().mean()) if len(series) else 0.0

    min_value = None
    max_value = None
    mean_value = None
    top_values = None

    if inferred_type == "numeric" and not non_null.empty:
        min_value = float(non_null.min())
        max_value = float(non_null.max())
        mean_value = float(non_null.mean())
    elif inferred_type == "datetime" and not non_null.empty:
        # For string-based dates, parse before computing min/max
        if not pd.api.types.is_datetime64_any_dtype(non_null):
            parsed = pd.to_datetime(non_null, errors="coerce", format="mixed").dropna()
            if not parsed.empty:
                min_value = to_serializable(parsed.min())
                max_value = to_serializable(parsed.max())
            else:
                min_value = to_serializable(non_null.min())
                max_value = to_serializable(non_null.max())
        else:
            min_value = to_serializable(non_null.min())
            max_value = to_serializable(non_null.max())
    elif inferred_type in {"categorical", "text", "boolean"} and not non_null.empty:
        top_values = [to_serializable(val) for val in non_null.value_counts().head(TOP_VALUES).index.tolist()]

    return ColumnProfile(
        name=str(series.name),
        normalized_name=normalize_column_name(str(series.name)),
        inferred_type=inferred_type,
        sample_values=sample_values,
        null_ratio=null_ratio,
        unique_count=unique_count,
        min_value=min_value,
        max_value=max_value,
        mean_value=mean_value,
        top_values=top_values,
    )


def profile_dataframe(file_id: UUID, name: str, dataframe: pd.DataFrame) -> FileProfile:
    columns = [profile_series(dataframe[col]) for col in dataframe.columns]
    return FileProfile(
        file_id=file_id,
        name=name,
        row_count=int(len(dataframe)),
        column_count=int(len(dataframe.columns)),
        columns=columns,
    )


def build_dataset_profile(file_records: list[DataFile]) -> DatasetProfile:
    file_profiles: list[FileProfile] = []
    for record in file_records:
        dataframe = load_dataframe(record)
        file_profiles.append(profile_dataframe(record.id, record.original_filename, dataframe))
    return DatasetProfile(files=file_profiles, generated_at=datetime.utcnow())


def collect_values_for_similarity(profile: ColumnProfile) -> set[str]:
    values: list[object] = []
    if profile.sample_values:
        values.extend(profile.sample_values)
    if profile.top_values:
        values.extend(profile.top_values)
    return {str(val).lower() for val in values if val is not None}


def compute_numeric_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    if left.min_value is None or left.max_value is None or right.min_value is None or right.max_value is None:
        return 0.0
    try:
        left_min = float(left.min_value)
        left_max = float(left.max_value)
        right_min = float(right.min_value)
        right_max = float(right.max_value)
    except (TypeError, ValueError):
        return 0.0
    left_range = max(left_max - left_min, 1e-9)
    right_range = max(right_max - right_min, 1e-9)
    range_ratio = min(left_range, right_range) / max(left_range, right_range)
    if left.mean_value is None or right.mean_value is None:
        return range_ratio
    mean_diff = abs(float(left.mean_value) - float(right.mean_value)) / max(left_range, right_range)
    return max(0.0, (1 - mean_diff)) * range_ratio


def compute_datetime_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    if not left.min_value or not left.max_value or not right.min_value or not right.max_value:
        return 0.0
    try:
        left_min = pd.to_datetime(left.min_value)
        left_max = pd.to_datetime(left.max_value)
        right_min = pd.to_datetime(right.min_value)
        right_max = pd.to_datetime(right.max_value)
    except Exception:
        return 0.0
    left_span = max((left_max - left_min).days, 1)
    right_span = max((right_max - right_min).days, 1)
    overlap = (min(left_max, right_max) - max(left_min, right_min)).days
    overlap = max(overlap, 0)
    return overlap / max(left_span, right_span)


def compute_categorical_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    left_values = collect_values_for_similarity(left)
    right_values = collect_values_for_similarity(right)
    if not left_values or not right_values:
        return 0.0
    intersection = left_values.intersection(right_values)
    union = left_values.union(right_values)
    return len(intersection) / len(union)


def compute_data_similarity(left: ColumnProfile, right: ColumnProfile) -> float:
    if left.inferred_type != right.inferred_type:
        return 0.0
    if left.inferred_type == "numeric":
        return compute_numeric_similarity(left, right)
    if left.inferred_type == "datetime":
        return compute_datetime_similarity(left, right)
    return compute_categorical_similarity(left, right)


def llm_merge_suggestions(dataset_profile: DatasetProfile) -> list[MergeSuggestion]:
    if not llm_service.enabled:
        return []
    payload = {
        "files": [
            {
                "file_id": str(file_profile.file_id),
                "name": file_profile.name,
                "columns": [
                    {
                        "name": col.name,
                        "type": col.inferred_type,
                        "sample_values": col.sample_values,
                    }
                    for col in file_profile.columns
                ],
            }
            for file_profile in dataset_profile.files
        ]
    }
    system_prompt = (
        "You are an analytics assistant. Suggest join keys between file pairs. "
        "Return JSON with a 'suggestions' array. Each suggestion must include: "
        "left_file_id, right_file_id, left_column, right_column, score (0-1), reason."
    )
    user_prompt = (
        "Given the file column summaries below, propose join keys for merging tables. "
        "Only propose columns that appear to represent the same entity. "
        "If unsure, return an empty list. Data: "
        f"{payload}"
    )
    response = llm_service.request_json(system_prompt, user_prompt)
    if not response or "suggestions" not in response:
        return []

    suggestions: list[MergeSuggestion] = []
    for suggestion in response.get("suggestions", []):
        try:
            left_file_id = UUID(str(suggestion.get("left_file_id")))
            right_file_id = UUID(str(suggestion.get("right_file_id")))
            left_column = str(suggestion.get("left_column"))
            right_column = str(suggestion.get("right_column"))
            score = float(suggestion.get("score", 0.85))
            reason = str(suggestion.get("reason", "LLM suggested join keys"))
        except Exception:
            continue
        suggestions.append(
            MergeSuggestion(
                left_file_id=left_file_id,
                right_file_id=right_file_id,
                left_column=left_column,
                right_column=right_column,
                score=score,
                reason=reason,
                source="llm",
            )
        )
    return suggestions


def _is_id_column(col: ColumnProfile) -> bool:
    """Check if a column looks like an ID/key column."""
    name = col.normalized_name or col.name.lower()
    return name.endswith(" id") or name == "id" or name.endswith("_id")


def _fuzzy_id_match(left_name: str, right_name: str) -> bool:
    """Check if two column names refer to the same ID entity.

    Examples that should match:
      - 'item_id' <-> 'menu_item_id'  (suffix match)
      - 'pizza_id' <-> 'pizza_type_id' (shared root 'pizza')
      - 'order_id' <-> 'order_id' (exact)
    """
    ln = left_name.replace(" ", "_").lower().strip()
    rn = right_name.replace(" ", "_").lower().strip()
    if ln == rn:
        return True
    # Suffix match: one ends with the other (e.g. 'item_id' is suffix of 'menu_item_id')
    if ln.endswith(rn) or rn.endswith(ln):
        return True
    # Both end with '_id' and share the core entity token
    if ln.endswith("_id") and rn.endswith("_id"):
        left_tokens = set(ln.replace("_id", "").split("_"))
        right_tokens = set(rn.replace("_id", "").split("_"))
        if left_tokens & right_tokens:
            return True
    return False


def compute_schema_overlap(file_a: FileProfile, file_b: FileProfile) -> float:
    """Return fraction of columns shared between two files (by normalized name)."""
    names_a = {col.normalized_name for col in file_a.columns if col.normalized_name}
    names_b = {col.normalized_name for col in file_b.columns if col.normalized_name}
    if not names_a or not names_b:
        return 0.0
    intersection = names_a & names_b
    return len(intersection) / min(len(names_a), len(names_b))


def generate_merge_suggestions(dataset_profile: DatasetProfile) -> MergeSuggestions:
    suggestions: list[MergeSuggestion] = []
    seen_keys: set[tuple[UUID, UUID, str, str]] = set()
    normalized_columns = {
        file_profile.file_id: {col.normalized_name for col in file_profile.columns if col.normalized_name}
        for file_profile in dataset_profile.files
    }

    for left_file, right_file in itertools.combinations(dataset_profile.files, 2):
        for left_col in left_file.columns:
            for right_col in right_file.columns:
                # --- Exact name match ---
                is_exact = left_col.normalized_name == right_col.normalized_name
                # --- Fuzzy ID match (item_id <-> menu_item_id) ---
                is_fuzzy_id = (
                    not is_exact
                    and _is_id_column(left_col)
                    and _is_id_column(right_col)
                    and _fuzzy_id_match(left_col.normalized_name, right_col.normalized_name)
                )
                if not is_exact and not is_fuzzy_id:
                    continue

                data_similarity = compute_data_similarity(left_col, right_col)
                if is_exact:
                    score = 0.75 + 0.25 * data_similarity
                    reason = "Exact column name match"
                else:
                    # Fuzzy match gets a slightly lower base score
                    score = 0.60 + 0.30 * data_similarity
                    reason = f"Fuzzy ID match: {left_col.name} ↔ {right_col.name}"

                suggestion = MergeSuggestion(
                    left_file_id=left_file.file_id,
                    right_file_id=right_file.file_id,
                    left_column=left_col.name,
                    right_column=right_col.name,
                    score=score,
                    reason=reason,
                    source="name" if is_exact else "fuzzy",
                    sample_left=left_col.sample_values,
                    sample_right=right_col.sample_values,
                )

                key = (suggestion.left_file_id, suggestion.right_file_id, suggestion.left_column, suggestion.right_column)
                if key not in seen_keys:
                    suggestions.append(suggestion)
                    seen_keys.add(key)

    llm_suggestions = llm_merge_suggestions(dataset_profile)
    for suggestion in llm_suggestions:
        left_columns = normalized_columns.get(suggestion.left_file_id)
        right_columns = normalized_columns.get(suggestion.right_file_id)
        if not left_columns or not right_columns:
            continue
        left_normalized = normalize_column_name(suggestion.left_column)
        right_normalized = normalize_column_name(suggestion.right_column)
        if not left_normalized or left_normalized != right_normalized:
            continue
        if left_normalized not in left_columns or right_normalized not in right_columns:
            continue
        key = (suggestion.left_file_id, suggestion.right_file_id, suggestion.left_column, suggestion.right_column)
        if key in seen_keys:
            continue
        suggestions.append(suggestion)
        seen_keys.add(key)

    suggestions.sort(key=lambda item: item.score, reverse=True)
    return MergeSuggestions(suggestions=suggestions[:30], generated_at=datetime.utcnow())
