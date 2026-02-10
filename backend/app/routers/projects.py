from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.core.deps import GUEST_EMAIL, get_current_user
from app.db import get_session
from app.models import DataFile, Dataset, Project, User
from app.schemas import DatasetCreate, DatasetRead, ProjectCreate, ProjectRead
from app.services.storage import delete_project_files

router = APIRouter()


def get_project_or_404(session: Session, user: User, project_id: UUID) -> Project:
    project = session.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("/", response_model=list[ProjectRead])
def list_projects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Project]:
    return session.exec(select(Project).where(Project.user_id == current_user.id)).all()


@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Project:
    project = Project(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        business_category=payload.business_category,
        business_context=payload.business_context,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    project = get_project_or_404(session, current_user, project_id)
    datasets = session.exec(select(Dataset).where(Dataset.project_id == project.id)).all()
    for dataset in datasets:
        files = session.exec(select(DataFile).where(DataFile.dataset_id == dataset.id)).all()
        for f in files:
            session.delete(f)
        session.delete(dataset)
    delete_project_files(project.id)
    session.delete(project)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/claim", response_model=list[ProjectRead])
def claim_guest_projects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Project]:
    """Transfer all guest-user projects to the authenticated user."""
    if current_user.email == GUEST_EMAIL:
        return []
    guest = session.exec(select(User).where(User.email == GUEST_EMAIL)).first()
    if not guest:
        return []
    guest_projects = session.exec(
        select(Project).where(Project.user_id == guest.id)
    ).all()
    claimed = []
    for project in guest_projects:
        project.user_id = current_user.id
        session.add(project)
        claimed.append(project)
    if claimed:
        session.commit()
        for p in claimed:
            session.refresh(p)
    return claimed


@router.get("/{project_id}/datasets", response_model=list[DatasetRead])
def list_project_datasets(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[Dataset]:
    project = get_project_or_404(session, current_user, project_id)
    return session.exec(select(Dataset).where(Dataset.project_id == project.id)).all()


@router.post("/{project_id}/datasets", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def create_dataset(
    project_id: UUID,
    payload: DatasetCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Dataset:
    project = get_project_or_404(session, current_user, project_id)
    dataset = Dataset(project_id=project.id, name=payload.name)
    session.add(dataset)
    session.commit()
    session.refresh(dataset)
    return dataset
