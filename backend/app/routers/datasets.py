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
from app.services.llm import analyze_data_chat, generate_chat_suggestions, stream_chat_for_model, BillingError, build_profile_summary, build_dictionary_section, DATA_ANALYST_SYSTEM, MODEL_REGISTRY
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


def _is_generic_build_confirmation(message: str) -> bool:
    normalized = (message or "").strip().lower()
    if not normalized:
        return True
    generic = {
        "yes",
        "yeah",
        "yep",
        "ok",
        "okay",
        "looks good",
        "go ahead",
        "build it",
        "do it",
        "start generating",
        "generate",
    }
    if normalized in generic:
        return True
    if len(normalized.split()) <= 3 and any(token in normalized for token in ("build", "generate", "go")):
        return True
    return False


def _fallback_primary_question(history: list[dict[str, str]], latest_user_message: str) -> str:
    latest = (latest_user_message or "").strip()
    if latest and not _is_generic_build_confirmation(latest):
        return latest

    for message in reversed(history):
        if message.get("role") != "user":
            continue
        content = str(message.get("content") or "").strip()
        if not content:
            continue
        if "just uploaded my data" in content.lower():
            continue
        if _is_generic_build_confirmation(content):
            continue
        return content

    return latest or "Build a dashboard for this dataset"


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
    try:
        reply, done, insights = analyze_data_chat(
            profile_data=dataset.profile_json,
            user_message=payload.message,
            history=history,
            dictionary_data=dataset.dictionary_json,
            model_key=payload.model_key or None,
        )
    except BillingError as e:
        return AiChatResponse(reply=str(e), done=False, insights=None, model_name=None)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("ai_chat error: %s", exc, exc_info=True)
        return AiChatResponse(
            reply="I ran into an error processing your request. Please try again or choose a different model.",
            done=False, insights=None, model_name=None,
        )

    # If the AI is done, store context on the project
    if done:
        project = session.get(Project, dataset.project_id)
        if project:
            merged_context: dict = dict(project.business_context or {})
            if isinstance(insights, dict):
                merged_context.update(insights)
            if not merged_context.get("primary_question"):
                merged_context["primary_question"] = _fallback_primary_question(history, payload.message)
            project.business_context = merged_context
            if isinstance(insights, dict) and insights.get("business_category"):
                project.business_category = insights["business_category"]
            session.add(project)
            session.commit()

    from app.services.llm import llm_service, MODEL_REGISTRY
    if payload.model_key and payload.model_key in MODEL_REGISTRY:
        reg = MODEL_REGISTRY[payload.model_key]
        model_label = f"{reg['badge']} / {reg['display_name']}"
    else:
        model_label = f"{llm_service.provider} / {llm_service._model}" if llm_service.enabled else None

    # Generate context-aware suggestion chips (skip if conversation is done)
    suggestions: list[str] = []
    if not done and dataset.profile_json:
        try:
            full_history = history + [{"role": "user", "content": payload.message}]
            suggestions = generate_chat_suggestions(
                profile_data=dataset.profile_json,
                history=full_history,
                latest_reply=reply,
                model_key=payload.model_key or None,
            )
        except Exception:
            pass  # non-fatal — just show no suggestions

    return AiChatResponse(reply=reply, done=done, insights=insights, model_name=model_label, suggestions=suggestions)


@router.post("/{dataset_id}/ai-chat-stream")
def ai_chat_stream(
    dataset_id: UUID,
    payload: AiChatRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """SSE streaming version of ai-chat — streams tokens as they arrive."""
    import logging as _log
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    if not dataset.profile_json:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset not profiled yet")

    history = [{"role": m.role, "content": m.content} for m in payload.history]
    model_key = payload.model_key or None

    profile_summary = build_profile_summary(dataset.profile_json, dataset.dictionary_json)
    dictionary_section = build_dictionary_section(dataset.dictionary_json)
    
    from app.services.llm import DATA_ANALYST_SYSTEM, DASHBOARD_REFINE_SYSTEM
    system_prompt = DASHBOARD_REFINE_SYSTEM if payload.mode == "refine" else DATA_ANALYST_SYSTEM
    system = system_prompt.format(profile_summary=profile_summary, dictionary_section=dictionary_section)

    conv_messages: list[dict[str, str]] = []
    for msg in history:
        conv_messages.append({"role": msg["role"], "content": msg["content"]})
    conv_messages.append({"role": "user", "content": payload.message})

    def event_stream():
        import json as _json
        full_reply = ""
        try:
            if model_key and model_key in MODEL_REGISTRY:
                for chunk in stream_chat_for_model(model_key, system, conv_messages, max_tokens=4096, temperature=0.6):
                    full_reply += chunk
                    yield f"data: {_json.dumps({'t': chunk})}\n\n"
            else:
                # Fallback: non-streaming call, send as one chunk
                from app.services.llm import llm_service
                messages = [{"role": "system", "content": system}] + conv_messages
                reply = llm_service.chat(messages, max_tokens=4096, temperature=0.6)
                if reply:
                    full_reply = reply
                    yield f"data: {_json.dumps({'t': reply})}\n\n"
        except BillingError as e:
            full_reply = str(e)
            yield f"data: {_json.dumps({'t': full_reply})}\n\n"
        except Exception as exc:
            _log.getLogger(__name__).error("ai_chat_stream error: %s", exc, exc_info=True)
            full_reply = "I ran into an error. Please try again or choose a different model."
            yield f"data: {_json.dumps({'t': full_reply})}\n\n"

        # After streaming completes, check if done and extract insights
        done = False
        insights = None
        if full_reply:
            done_signals = ["i have what i need", "have enough", "let me build", "let's build",
                            "i'll create", "ready to build", "generating", "let me generate",
                            "let me create", "i'll design", "dashboard will cover",
                            "here's the plan", "here is the plan", "i'll now create",
                            "let me put together", "i'll put together"]
            real_user_count = sum(
                1 for m in conv_messages
                if m["role"] == "user" and "just uploaded" not in m.get("content", "").lower()
            )
            done = real_user_count >= 2 and any(sig in full_reply.lower() for sig in done_signals)

            if done:
                try:
                    from app.services.llm import (
                        INSIGHT_EXTRACTION_SYSTEM, call_json_for_model, llm_service,
                    )
                    conv_str = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in conv_messages[:-1])
                    extract_messages = [
                        {"role": "system", "content": INSIGHT_EXTRACTION_SYSTEM},
                        {"role": "user", "content": (
                            f"Dataset profile:\n{profile_summary}\n\n"
                            f"Conversation:\n{conv_str}"
                            f"\nUSER: {payload.message}\nASSISTANT: {full_reply}"
                        )},
                    ]
                    if model_key and model_key in MODEL_REGISTRY:
                        insights = call_json_for_model(model_key, INSIGHT_EXTRACTION_SYSTEM,
                                                       extract_messages[1:], max_tokens=1200)
                    else:
                        insights = llm_service.chat_json(extract_messages, max_tokens=1200)

                    # Store on project
                    project = session.get(Project, dataset.project_id)
                    if project:
                        merged_context = dict(project.business_context or {})
                        if isinstance(insights, dict):
                            merged_context.update(insights)
                        if not merged_context.get("primary_question"):
                            merged_context["primary_question"] = _fallback_primary_question(history, payload.message)
                        project.business_context = merged_context
                        if isinstance(insights, dict) and insights.get("business_category"):
                            project.business_category = insights["business_category"]
                        session.add(project)
                        session.commit()
                except Exception:
                    pass

        # Generate suggestions
        suggestions: list[str] = []
        if not done and dataset.profile_json:
            try:
                full_history = history + [{"role": "user", "content": payload.message}]
                suggestions = generate_chat_suggestions(
                    profile_data=dataset.profile_json,
                    history=full_history,
                    latest_reply=full_reply,
                    model_key=model_key,
                )
            except Exception:
                pass

        # Send final metadata event
        from app.services.llm import llm_service as _svc
        if model_key and model_key in MODEL_REGISTRY:
            reg = MODEL_REGISTRY[model_key]
            model_label = f"{reg['badge']} / {reg['display_name']}"
        else:
            model_label = f"{_svc.provider} / {_svc._model}" if _svc.enabled else None

        yield f"data: {_json.dumps({'done': done, 'insights': insights, 'model_name': model_label, 'suggestions': suggestions})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
