"""
car_dynamics/base.py
--------------------
Abstract base class for all car dynamics models.

The solver ONLY calls this interface — it is completely agnostic of
which model is active. Adding a new model (e.g. tyre thermals, aero)
requires only:
  1. Subclassing CarDynamicsBase
  2. Registering in the MODEL_REGISTRY
  3. Zero changes to the solver code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np


# ---------------------------------------------------------------------------
# State object — mutable physics state carried across integration steps
# ---------------------------------------------------------------------------

@dataclass
class CarDynamicsState:
    """
    Holds any state that persists across integration timesteps.
    Stateless models (PointMass) leave all fields at None.
    Future plugins populate the fields they own.
    """
    # Tyre thermals plugin
    tyre_temps_c: np.ndarray | None = None  # shape (4,) — FL, FR, RL, RR

    # Weight transfer plugin
    suspension_deflection_mm: np.ndarray | None = None  # shape (4,)

    # Aero plugin
    current_cl_factor: float | None = None

    # Catch-all for future plugins
    extra: dict[str, Any] = field(default_factory=dict)

    def copy(self) -> "CarDynamicsState":
        return CarDynamicsState(
            tyre_temps_c=self.tyre_temps_c.copy() if self.tyre_temps_c is not None else None,
            suspension_deflection_mm=(
                self.suspension_deflection_mm.copy()
                if self.suspension_deflection_mm is not None else None
            ),
            current_cl_factor=self.current_cl_factor,
            extra=dict(self.extra),
        )


# ---------------------------------------------------------------------------
# Track node — passed into every dynamics call
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TrackNode:
    """Minimal track geometry context at a single discretisation point."""
    s: float            # arc-length from start, metres
    curvature: float    # κ(s) in 1/m — positive = left turn
    half_width_left: float   # metres
    half_width_right: float  # metres
    banking_angle: float = 0.0          # radians, positive = banked left
    surface_grip_factor: float = 1.0    # relative to nominal


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class CarDynamicsBase(ABC):
    """
    Abstract base for all car dynamics models.

    Subclasses must implement:
      - max_lateral_acceleration_ms2
      - max_acceleration_ms2
      - max_braking_ms2
      - update_state
      - initial_state

    The default `is_feasible` implementation uses an elliptical GG diagram
    and can be overridden for non-elliptical traction envelopes.
    """

    def __init__(self, config: dict[str, Any]):
        self._config = config
        self._g = 9.81  # m/s²

    @property
    def model_id(self) -> str:
        return self._config.get("modelId", type(self).__name__)

    @property
    def config(self) -> dict[str, Any]:
        return dict(self._config)

    # ------------------------------------------------------------------
    # Methods subclasses MUST implement
    # ------------------------------------------------------------------

    @abstractmethod
    def max_lateral_acceleration_ms2(
        self,
        speed_ms: float,
        node: TrackNode,
        state: CarDynamicsState,
    ) -> float:
        """
        Maximum lateral (cornering) acceleration available at this speed
        and track position, given the current dynamics state.

        For the simple point-mass model this is constant (μ·g).
        For aero models it increases as v² (downforce adds normal load).
        Banking angle can also increase the effective limit.
        """
        ...

    @abstractmethod
    def max_acceleration_ms2(
        self,
        speed_ms: float,
        node: TrackNode,
        state: CarDynamicsState,
    ) -> float:
        """
        Maximum longitudinal (throttle) acceleration available.
        For power-limited models: P / (m * v), capped at ax_max.
        """
        ...

    @abstractmethod
    def max_braking_ms2(
        self,
        speed_ms: float,
        node: TrackNode,
        state: CarDynamicsState,
    ) -> float:
        """
        Maximum braking deceleration (returned as a positive magnitude).
        For aero models: increases with v² due to downforce.
        """
        ...

    @abstractmethod
    def update_state(
        self,
        state: CarDynamicsState,
        speed_ms: float,
        ax: float,
        ay: float,
        dt_s: float,
        node: TrackNode,
    ) -> CarDynamicsState:
        """
        Advance state by one integration step.
        Stateless models return state unchanged.
        Thermal models update tyre temperatures here.
        """
        ...

    @abstractmethod
    def initial_state(self) -> CarDynamicsState:
        """Return a fresh state for the start of a lap."""
        ...

    # ------------------------------------------------------------------
    # Default implementation — can be overridden
    # ------------------------------------------------------------------

    def is_feasible(
        self,
        ax: float,
        ay: float,
        speed_ms: float,
        node: TrackNode,
        state: CarDynamicsState,
    ) -> bool:
        """
        Elliptical GG diagram constraint.
        (ax / ax_max)² + (ay / ay_max)² ≤ 1
        where ax_max depends on sign of ax (throttle vs braking).
        """
        ay_max = self.max_lateral_acceleration_ms2(speed_ms, node, state)
        if ax >= 0:
            ax_max = self.max_acceleration_ms2(speed_ms, node, state)
        else:
            ax_max = self.max_braking_ms2(speed_ms, node, state)

        if ax_max <= 0 or ay_max <= 0:
            return False

        return (ax / ax_max) ** 2 + (ay / ay_max) ** 2 <= 1.0

    def corner_speed_limit_ms(
        self,
        curvature: float,
        node: TrackNode,
        state: CarDynamicsState,
    ) -> float:
        """
        Maximum speed at which the car can sustain the given path curvature.
        v_max = sqrt( a_y_max / |κ| )
        Called by the speed profile integrator.
        """
        if abs(curvature) < 1e-9:
            return self._config.get("vMaxMs", 100.0)
        # Initial guess — iterate once to account for speed-dependent ay_max
        v_guess = np.sqrt(
            self.max_lateral_acceleration_ms2(0.0, node, state) / abs(curvature)
        )
        # One Newton step for speed-dependent models (aero etc.)
        for _ in range(5):
            ay_max = self.max_lateral_acceleration_ms2(v_guess, node, state)
            v_new = np.sqrt(ay_max / abs(curvature))
            if abs(v_new - v_guess) < 0.01:
                break
            v_guess = v_new
        return min(v_guess, self._config.get("vMaxMs", 100.0))
