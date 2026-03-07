"""
Solver Service — FastAPI wrapper around car_dynamics models.

Exposes the existing Python car dynamics models as REST endpoints.
The solver core lives in packages/solver/car_dynamics/ — this service
is purely the HTTP boundary.
"""
import sys
from pathlib import Path

# Add the solver package to Python path so we can import car_dynamics
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "packages" / "solver"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, models, solve

app = FastAPI(
    title="RN Ideallinie Solver Service",
    version="0.1.0",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(models.router, prefix="/models", tags=["models"])
app.include_router(solve.router, prefix="/solve", tags=["solve"])
