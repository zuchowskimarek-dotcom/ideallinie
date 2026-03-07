from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class SolveRequest(BaseModel):
    model_id: str = "point_mass"
    model_config_override: dict | None = None


class SolveResponse(BaseModel):
    status: str
    message: str


@router.post("/")
async def solve(request: SolveRequest) -> SolveResponse:
    """Stub: will compute ideal racing line in future sprints."""
    return SolveResponse(
        status="not_implemented",
        message=f"Solver endpoint stub. Model: {request.model_id}. "
        "Full implementation coming in Sprint 2.",
    )
