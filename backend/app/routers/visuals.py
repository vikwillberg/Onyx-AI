import logging
import traceback
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

from app.core.deps import get_current_user
from app.db import get_session
from app.models import DataFile, Dataset, Project, User
from app.schemas import (
    DuelPickRequest,
    DuelPoolResponse,
    DuelRound,
    FileProfile,
    VisualCustomRequest,
    VisualMoreRequest,
    VisualResponse,
    VisualSelectionRequest,
    VisualSpec,
)
from app.services.ingestion import load_dataframe, profile_dataframe
from app.services.visuals import (
    ALLOWED_TYPES,
    apply_data_to_spec,
    build_visual_id,
    generate_dashboard_visuals,
    generate_duel_pool,
    generate_final_visuals,
    generate_more_visuals,
    generate_sample_visuals,
    pair_candidates,
)

router = APIRouter()


def get_dataset_or_404(session: Session, user: User, dataset_id: UUID) -> Dataset:
    dataset = session.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    project = session.get(Project, dataset.project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


def get_dataset_dataframe(session: Session, dataset: Dataset) -> tuple[FileProfile, object]:
    if dataset.merged_path:
        dataframe = load_dataframe(
            DataFile(
                id=dataset.id,
                dataset_id=dataset.id,
                original_filename="merged",
                stored_path=dataset.merged_path,
                parquet_path=dataset.merged_path,
                row_count=0,
                column_count=0,
            )
        )
        if dataset.merged_profile_json:
            profile = FileProfile.model_validate(dataset.merged_profile_json)
        else:
            profile = profile_dataframe(dataset.id, "Merged Dataset", dataframe)
        return profile, dataframe

    file_record = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).first()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No files available")
    dataframe = load_dataframe(file_record)
    profile = profile_dataframe(file_record.id, file_record.original_filename, dataframe)
    return profile, dataframe


@router.post("/{dataset_id}/sample", response_model=VisualResponse)
def sample_visuals(
    dataset_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VisualResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    profile, dataframe = get_dataset_dataframe(session, dataset)

    visuals = generate_sample_visuals(profile, dataframe)
    dataset.sample_visuals_json = [visual.model_dump() for visual in visuals]
    session.add(dataset)
    session.commit()

    return VisualResponse(visuals=visuals, generated_at=datetime.utcnow())


@router.post("/{dataset_id}/dashboard", response_model=VisualResponse)
def dashboard_visuals(
    dataset_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VisualResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    try:
        profile, dataframe = get_dataset_dataframe(session, dataset)
    except Exception as exc:
        logger.error("Failed to load dataset data: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to load data: {exc}")

    project = session.get(Project, dataset.project_id)
    business_category = project.business_category if project else None
    business_context = project.business_context if project else None

    try:
        visuals = generate_dashboard_visuals(
            profile, dataframe,
            business_category=business_category,
            business_context=business_context,
        )
    except Exception as exc:
        logger.error("Dashboard generation failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Dashboard generation error: {exc}")

    dataset.final_visuals_json = [visual.model_dump() for visual in visuals]
    dataset.sample_visuals_json = None
    session.add(dataset)
    session.commit()

    return VisualResponse(visuals=visuals, generated_at=datetime.utcnow())


@router.post("/{dataset_id}/final", response_model=VisualResponse)
def finalize_visuals(
    dataset_id: UUID,
    payload: VisualSelectionRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VisualResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    if not dataset.sample_visuals_json:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No sample visuals available")

    sample_visuals = [VisualSpec.model_validate(item) for item in dataset.sample_visuals_json]
    selected_visuals = [
        visual for visual in sample_visuals if visual.visual_id in payload.selected_visual_ids
    ]
    if not selected_visuals:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No visuals selected")

    profile, dataframe = get_dataset_dataframe(session, dataset)
    visuals = generate_final_visuals(profile, dataframe, selected_visuals)
    dataset.final_visuals_json = [visual.model_dump() for visual in visuals]
    session.add(dataset)
    session.commit()

    return VisualResponse(visuals=visuals, generated_at=datetime.utcnow())


@router.post("/{dataset_id}/more", response_model=VisualResponse)
def more_visuals(
    dataset_id: UUID,
    payload: VisualMoreRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VisualResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    existing_data = dataset.final_visuals_json or dataset.sample_visuals_json
    if not existing_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No visuals available to expand")

    existing_visuals = [VisualSpec.model_validate(item) for item in existing_data]
    selected_visuals = None
    if payload.selected_visual_ids:
        selected_visuals = [
            visual for visual in existing_visuals if visual.visual_id in payload.selected_visual_ids
        ]

    profile, dataframe = get_dataset_dataframe(session, dataset)
    more_visuals_list = generate_more_visuals(
        profile,
        dataframe,
        existing_visuals,
        selected_visuals=selected_visuals,
    )
    combined = existing_visuals + more_visuals_list
    dataset.final_visuals_json = [visual.model_dump() for visual in combined]
    session.add(dataset)
    session.commit()

    return VisualResponse(visuals=combined, generated_at=datetime.utcnow())


@router.delete("/{dataset_id}/remove/{visual_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_visual(
    dataset_id: UUID,
    visual_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    if not dataset.final_visuals_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No visuals available to remove",
        )

    existing_visuals = [VisualSpec.model_validate(item) for item in dataset.final_visuals_json]
    updated_visuals = [visual for visual in existing_visuals if visual.visual_id != visual_id]
    if len(updated_visuals) == len(existing_visuals):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visual not found")

    dataset.final_visuals_json = [visual.model_dump() for visual in updated_visuals]
    session.add(dataset)
    session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{dataset_id}/custom", response_model=VisualResponse)
def custom_visual(
    dataset_id: UUID,
    payload: VisualCustomRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VisualResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    profile, dataframe = get_dataset_dataframe(session, dataset)

    visual_type = payload.type.lower()
    if visual_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported visual type")

    column_names = set(dataframe.columns)
    for column in (payload.x, payload.y, payload.values):
        if column and column not in column_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Column not found: {column}",
            )

    existing_data = dataset.final_visuals_json or dataset.sample_visuals_json or []
    existing_visuals = [VisualSpec.model_validate(item) for item in existing_data]
    existing_lookup = {visual.visual_id: visual for visual in existing_visuals}

    visual_id = payload.visual_id or build_visual_id(visual_type)
    config: Optional[dict] = None
    if payload.columns:
        config = {"columns": payload.columns}

    existing_visual = existing_lookup.get(visual_id)
    if existing_visual and existing_visual.config:
        config = {**(existing_visual.config or {}), **(config or {})}

    spec = VisualSpec(
        visual_id=visual_id,
        type=visual_type,
        title=payload.title or "Custom visual",
        x=payload.x,
        y=payload.y,
        values=payload.values,
        aggregation=payload.aggregation,
        config=config,
    )

    visual = apply_data_to_spec(spec, dataframe)
    if not visual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid visual configuration",
        )

    visual.visual_id = visual_id
    if payload.title:
        visual.title = payload.title
    elif existing_visual:
        visual.title = existing_visual.title
    if config:
        visual.config = {**(visual.config or {}), **config}

    updated_visuals: list[VisualSpec] = []
    replaced = False
    for existing in existing_visuals:
        if existing.visual_id == visual_id:
            updated_visuals.append(visual)
            replaced = True
        else:
            updated_visuals.append(existing)
    if not replaced:
        updated_visuals.append(visual)

    dataset.final_visuals_json = [item.model_dump() for item in updated_visuals]
    session.add(dataset)
    session.commit()

    return VisualResponse(visuals=updated_visuals, generated_at=datetime.utcnow())


@router.post("/{dataset_id}/duel-pool", response_model=DuelPoolResponse)
def duel_pool(
    dataset_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DuelPoolResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    try:
        profile, dataframe = get_dataset_dataframe(session, dataset)
    except Exception as exc:
        logger.error("Failed to load dataset data: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to load data: {exc}")

    project = session.get(Project, dataset.project_id)
    business_category = project.business_category if project else None
    business_context = project.business_context if project else None

    try:
        kpis, pool = generate_duel_pool(
            profile, dataframe,
            business_category=business_category,
            business_context=business_context,
        )
    except Exception as exc:
        logger.error("Duel pool generation failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Duel pool error: {exc}")

    rounds = pair_candidates(pool)
    duel_rounds = [DuelRound(**r) for r in rounds]

    return DuelPoolResponse(
        rounds=duel_rounds,
        kpis=kpis,
        pool_size=len(pool),
        generated_at=datetime.utcnow(),
    )


@router.post("/{dataset_id}/duel-pick", response_model=VisualResponse)
def duel_pick(
    dataset_id: UUID,
    payload: DuelPickRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> VisualResponse:
    dataset = get_dataset_or_404(session, current_user, dataset_id)
    try:
        profile, dataframe = get_dataset_dataframe(session, dataset)
    except Exception as exc:
        logger.error("Failed to load dataset data: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to load data: {exc}")

    project = session.get(Project, dataset.project_id)
    business_category = project.business_category if project else None
    business_context = project.business_context if project else None

    # Generate KPIs (auto-included)
    kpis, _ = generate_duel_pool(
        profile, dataframe,
        business_category=business_category,
        business_context=business_context,
        max_pool=0,
    )

    # Combine KPIs + user-picked visuals (sent from frontend with full data)
    final_visuals = kpis + payload.picked_visuals

    dataset.final_visuals_json = [v.model_dump() for v in final_visuals]
    dataset.sample_visuals_json = None
    session.add(dataset)
    session.commit()

    return VisualResponse(visuals=final_visuals, generated_at=datetime.utcnow())
