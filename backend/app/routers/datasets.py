from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

import io

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.deps import get_current_user
from app.db import get_session
from app.models import DataFile, Dataset, Project, User
from app.schemas import (
    AiChatRequest,
    AiChatResponse,
    DatasetDetail,
    DatasetPreview,
    DatasetProfile,
    DatasetUploadResponse,
    FileProfile,
    MergeRequest,
    MergeResponse,
    MergeSuggestions,
    VisualSpec,
)
from app.services.llm import analyze_data_chat
from app.services.ingestion import (
    generate_merge_suggestions,
    is_dictionary_file,
    load_dataframe,
    parse_dictionary_file,
    profile_dataframe,
    read_tabular_file,
    store_dataframe_parquet,
    to_serializable,
)
from app.services.storage import merged_dataset_path, save_upload_file

router = APIRouter()


def get_dataset_or_404(session: Session, user: User, dataset_id: UUID) -> Dataset:
    dataset = session.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    project = session.get(Project, dataset.project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


def serialize_rows(rows: list[dict]) -> list[dict]:
    serialized: list[dict] = []
    for row in rows:
        serialized.append({key: to_serializable(value) for key, value in row.items()})
    return serialized


@router.get("/{dataset_id}", response_model=DatasetDetail)
def get_dataset(
    dataset_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DatasetDetail:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    files = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).all()

    profile = DatasetProfile.model_validate(dataset.profile_json) if dataset.profile_json else None
    merge_suggestions = (
        MergeSuggestions.model_validate(dataset.merge_suggestions_json)
        if dataset.merge_suggestions_json
        else None
    )
    merged_profile = FileProfile.model_validate(dataset.merged_profile_json) if dataset.merged_profile_json else None
    sample_visuals = (
        [VisualSpec.model_validate(item) for item in dataset.sample_visuals_json]
        if dataset.sample_visuals_json
        else None
    )
    final_visuals = (
        [VisualSpec.model_validate(item) for item in dataset.final_visuals_json]
        if dataset.final_visuals_json
        else None
    )

    return DatasetDetail(
        dataset=dataset,
        files=files,
        profile=profile,
        merge_suggestions=merge_suggestions,
        merged_profile=merged_profile,
        sample_visuals=sample_visuals,
        final_visuals=final_visuals,
    )


@router.post("/{dataset_id}/upload", response_model=DatasetUploadResponse)
async def upload_dataset_files(
    dataset_id: UUID,
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DatasetUploadResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files uploaded")

    data_files: list[DataFile] = []
    file_profiles: list[FileProfile] = []
    dictionary_data: dict | None = None

    for upload in files:
        filename = upload.filename or "upload"
        file_id = uuid4()
        stored_path = save_upload_file(upload.file, filename, dataset.id, file_id)

        # Detect and parse dictionary files separately
        if is_dictionary_file(filename):
            dictionary_data = parse_dictionary_file(stored_path, filename)
            # Still store as a DataFile for reference, but mark it small
            data_file = DataFile(
                id=file_id,
                dataset_id=dataset.id,
                original_filename=filename,
                stored_path=stored_path,
                parquet_path=None,
                row_count=0,
                column_count=0,
            )
            data_files.append(data_file)
            continue

        dataframe = read_tabular_file(stored_path)
        parquet_path = store_dataframe_parquet(dataset.id, file_id, dataframe)

        data_file = DataFile(
            id=file_id,
            dataset_id=dataset.id,
            original_filename=filename,
            stored_path=stored_path,
            parquet_path=parquet_path,
            row_count=int(len(dataframe)),
            column_count=int(len(dataframe.columns)),
        )
        data_files.append(data_file)
        file_profiles.append(profile_dataframe(data_file.id, data_file.original_filename, dataframe))

    session.add_all(data_files)

    # Store dictionary if found
    if dictionary_data:
        existing_dict = dataset.dictionary_json or {}
        existing_cols = existing_dict.get("columns", {})
        existing_cols.update(dictionary_data.get("columns", {}))
        dictionary_data["columns"] = existing_cols
        dataset.dictionary_json = dictionary_data
    existing_profiles: list[FileProfile] = []
    if dataset.profile_json:
        existing_profiles = DatasetProfile.model_validate(dataset.profile_json).files
    profile_map = {profile.file_id: profile for profile in existing_profiles}
    for profile in file_profiles:
        profile_map[profile.file_id] = profile
    dataset_profile = DatasetProfile(files=list(profile_map.values()), generated_at=datetime.utcnow())
    dataset.profile_json = dataset_profile.model_dump(mode="json")
    merge_suggestions = generate_merge_suggestions(dataset_profile)
    dataset.merge_suggestions_json = merge_suggestions.model_dump(mode="json")
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    return DatasetUploadResponse(
        dataset=dataset,
        files=data_files,
        profile=dataset_profile,
        merge_suggestions=merge_suggestions,
    )


@router.get("/{dataset_id}/preview", response_model=DatasetPreview)
def preview_dataset(
    dataset_id: UUID,
    file_id: Optional[UUID] = None,
    use_merged: bool = False,
    limit: int = Query(25, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DatasetPreview:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    dataframe: pd.DataFrame

    if use_merged and dataset.merged_path:
        dataframe = pd.read_parquet(dataset.merged_path)
    else:
        file_record = None
        if file_id:
            file_record = session.get(DataFile, file_id)
            if not file_record or file_record.dataset_id != dataset.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        else:
            file_record = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).first()
        if not file_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No files available")
        dataframe = load_dataframe(file_record)

    preview = dataframe.head(limit)
    rows = serialize_rows(preview.to_dict(orient="records"))
    return DatasetPreview(columns=[str(col) for col in dataframe.columns], rows=rows)


@router.post("/{dataset_id}/merge", response_model=MergeResponse)
def merge_dataset(
    dataset_id: UUID,
    payload: MergeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MergeResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    if not payload.instructions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No merge instructions provided")

    files = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).all()
    file_map = {file.id: file for file in files}
    dataframe_map = {file_id: load_dataframe(file_record) for file_id, file_record in file_map.items()}

    # Use a single accumulator: first merge seeds it, subsequent merges fold new files in
    accumulated: Optional[pd.DataFrame] = None
    merged_file_ids: set[UUID] = set()

    for instruction in payload.instructions:
        left_df = dataframe_map.get(instruction.left_file_id)
        right_df = dataframe_map.get(instruction.right_file_id)
        if left_df is None or right_df is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merge file not found")

        if accumulated is None:
            # First merge: combine both files
            base = left_df
            new_df = right_df
            left_on = instruction.left_on
            right_on = instruction.right_on
            merged_file_ids.update([instruction.left_file_id, instruction.right_file_id])
        else:
            # Subsequent merges: fold the new (unmerged) file into the accumulator
            if instruction.right_file_id not in merged_file_ids:
                base = accumulated
                new_df = right_df
                left_on = instruction.left_on
                right_on = instruction.right_on
                merged_file_ids.add(instruction.right_file_id)
            elif instruction.left_file_id not in merged_file_ids:
                base = accumulated
                new_df = left_df
                left_on = instruction.right_on
                right_on = instruction.left_on
                merged_file_ids.add(instruction.left_file_id)
            else:
                # Both already merged — skip this instruction
                continue

        # Resolve suffixed column names from previous merges
        if left_on not in base.columns:
            for col in base.columns:
                if col.startswith(left_on) and col.endswith(("_x", "_y")):
                    left_on = col
                    break

        if left_on not in base.columns or right_on not in new_df.columns:
            continue  # Skip this instruction instead of failing entirely

        # Drop columns from right that already exist in base (except join key) to avoid _x/_y
        right_only = [right_on] + [c for c in new_df.columns if c not in base.columns and c != right_on]
        new_df_trimmed = new_df[right_only]

        accumulated = pd.merge(
            base,
            new_df_trimmed,
            left_on=left_on,
            right_on=right_on,
            how=instruction.how,
        )

    if accumulated is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Merge failed")
    merged_frame = accumulated

    merged_path = merged_dataset_path(dataset.id)
    merged_path.parent.mkdir(parents=True, exist_ok=True)
    merged_frame.to_parquet(merged_path, index=False)

    merged_profile = profile_dataframe(dataset.id, payload.output_name or "Merged Dataset", merged_frame)
    dataset.merged_path = str(merged_path)
    dataset.merged_profile_json = merged_profile.model_dump(mode="json")
    dataset.sample_visuals_json = None
    dataset.final_visuals_json = None
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    return MergeResponse(dataset=dataset, merged_profile=merged_profile)


@router.post("/{dataset_id}/concat", response_model=MergeResponse)
def concat_dataset(
    dataset_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MergeResponse:
    """Stack all files vertically (union). Only works when files share similar schemas."""
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    files = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).all()
    if len(files) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Need at least 2 files to concat")

    frames = []
    col_sets: list[set[str]] = []
    for file_record in files:
        df = load_dataframe(file_record)
        frames.append(df)
        col_sets.append({c.lower().strip() for c in df.columns})

    # Validate schema overlap — require at least 40% overlap between all file pairs
    for i in range(len(col_sets)):
        for j in range(i + 1, len(col_sets)):
            a, b = col_sets[i], col_sets[j]
            overlap = len(a & b) / max(min(len(a), len(b)), 1)
            if overlap < 0.4:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Files have different schemas and cannot be stacked. Use merge instead.",
                )

    for i, file_record in enumerate(files):
        frames[i]["_source_file"] = file_record.original_filename

    combined = pd.concat(frames, ignore_index=True, sort=False)

    merged_path = merged_dataset_path(dataset.id)
    merged_path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(merged_path, index=False)

    merged_profile = profile_dataframe(dataset.id, "Combined Dataset", combined)
    dataset.merged_path = str(merged_path)
    dataset.merged_profile_json = merged_profile.model_dump(mode="json")
    dataset.sample_visuals_json = None
    dataset.final_visuals_json = None
    session.add(dataset)
    session.commit()
    session.refresh(dataset)

    return MergeResponse(dataset=dataset, merged_profile=merged_profile)


@router.get("/{dataset_id}/export")
def export_dataset_csv(
    dataset_id: UUID,
    use_merged: bool = True,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    dataframe: pd.DataFrame

    if use_merged and dataset.merged_path:
        dataframe = pd.read_parquet(dataset.merged_path)
    else:
        file_record = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).first()
        if not file_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No files available")
        dataframe = load_dataframe(file_record)

    buffer = io.StringIO()
    dataframe.to_csv(buffer, index=False)
    buffer.seek(0)
    filename = f"{dataset.name or 'export'}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{dataset_id}/ai-chat", response_model=AiChatResponse)
def ai_chat(
    dataset_id: UUID,
    payload: AiChatRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AiChatResponse:
    """Conversational AI data analyst — one turn per call."""
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    if not dataset.profile_json:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset not profiled yet")

    history = [{"role": m.role, "content": m.content} for m in payload.history]
    reply, done, insights = analyze_data_chat(
        profile_data=dataset.profile_json,
        user_message=payload.message,
        history=history,
        dictionary_data=dataset.dictionary_json,
    )

    # If the AI is done, store insights on the project
    if done and insights:
        project = session.get(Project, dataset.project_id)
        if project:
            project.business_context = insights
            if insights.get("business_category"):
                project.business_category = insights["business_category"]
            session.add(project)
            session.commit()

    from app.services.llm import llm_service
    model_label = f"{llm_service.provider} / {llm_service._model}" if llm_service.enabled else None
    return AiChatResponse(reply=reply, done=done, insights=insights, model_name=model_label)
