"""
car_dynamics/models.py
----------------------
Concrete implementations of CarDynamicsBase.

Current models:
  - PointMassModel   : Simplest. Constant friction circle. No drivetrain effects.
  - RWDModel         : Rear-wheel drive. Reduced ax_max under combined lat/long load.
  - FWDModel         : Front-wheel drive. Understeer penalty at corner exit.
  - AWDModel         : All-wheel drive. Balanced traction with torque-split parameter.

Stub models (interface only — full implementation in future sprints):
  - AeroPlugin       : Speed-dependent downforce scaling
  - TyreThermalsPlugin : Temperature-dependent μ
  - WeightTransferPlugin : Load transfer effects on per-axle grip
"""

from __future__ import annotations

from typing import Any

import numpy as np

from .base import CarDynamicsBase, CarDynamicsState, TrackNode


# ---------------------------------------------------------------------------
# 1. Point Mass Model
# ---------------------------------------------------------------------------

class PointMassModel(CarDynamicsBase):
    """
    Simplest physically meaningful model.
    Constant friction circle — no drivetrain effects.
    4 parameters: mu_peak, ay_max_ms2, ax_max_ms2, braking_max_ms2, v_max_ms

    This is the correct starting point for:
    - Initial solver validation
    - Tracks where vehicle class is unknown
    - Calibration baseline
    """

    def __init__(self, config: dict[str, Any] | None = None):
        defaults = {
            "modelId": "point_mass",
            "vehicleClass": "point_mass",
            "massKg": 1400,
            "muPeak": 1.1,
            "ayMaxMs2": 10.8,
            "axMaxMs2": 5.0,
            "brakingMaxMs2": 12.0,
            "vMaxMs": 55.6,
        }
        super().__init__({**defaults, **(config or {})})

    def max_lateral_acceleration_ms2(self, speed_ms, node, state):
        base = self._config["ayMaxMs2"]
        # Banking increases effective lateral grip
        banking_bonus = self._g * np.sin(node.banking_angle)
        return (base + banking_bonus) * node.surface_grip_factor

    def max_acceleration_ms2(self, speed_ms, node, state):
        return self._config["axMaxMs2"] * node.surface_grip_factor

    def max_braking_ms2(self, speed_ms, node, state):
        return self._config["brakingMaxMs2"] * node.surface_grip_factor

    def update_state(self, state, speed_ms, ax, ay, dt_s, node):
        return state  # stateless

    def initial_state(self):
        return CarDynamicsState()


# ---------------------------------------------------------------------------
# 2. RWD Model
# ---------------------------------------------------------------------------

class RWDModel(CarDynamicsBase):
    """
    Rear-wheel-drive vehicle.

    Key behaviour: at corner exit, applying throttle while still carrying
    lateral load causes the rear tyres to approach their combined limit
    earlier than a point-mass model predicts. This manifests as a reduced
    effective ax_max when ay is already high — modelled here via the
    exitOversteerSensitivity parameter.

    The GG diagram is still elliptical but the longitudinal axis shrinks
    when lateral load fraction is high:

      ax_available = ax_max * (1 - sensitivity * (ay_actual / ay_max)²)

    This reproduces the characteristic RWD behaviour of needing to wait
    for the car to straighten before going to full throttle.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        defaults = {
            "modelId": "rwd",
            "vehicleClass": "rwd",
            "massKg": 1350,
            "muPeak": 1.2,
            "ayMaxMs2": 11.8,
            "axMaxMs2": 5.5,
            "brakingMaxMs2": 13.0,
            "vMaxMs": 69.4,
            "exitOversteerSensitivity": 0.3,
        }
        super().__init__({**defaults, **(config or {})})

    def max_lateral_acceleration_ms2(self, speed_ms, node, state):
        base = self._config["ayMaxMs2"]
        banking_bonus = self._g * np.sin(node.banking_angle)
        return (base + banking_bonus) * node.surface_grip_factor

    def max_acceleration_ms2(self, speed_ms, node, state):
        return self._config["axMaxMs2"] * node.surface_grip_factor

    def max_braking_ms2(self, speed_ms, node, state):
        return self._config["brakingMaxMs2"] * node.surface_grip_factor

    def is_feasible(self, ax, ay, speed_ms, node, state):
        ay_max = self.max_lateral_acceleration_ms2(speed_ms, node, state)
        lat_fraction = abs(ay) / ay_max if ay_max > 0 else 0.0

        if ax >= 0:
            # RWD exit throttle penalty: ax available reduces under lateral load
            sensitivity = self._config["exitOversteerSensitivity"]
            ax_max_effective = self._config["axMaxMs2"] * (
                1.0 - sensitivity * lat_fraction ** 2
            ) * node.surface_grip_factor
        else:
            ax_max_effective = self.max_braking_ms2(speed_ms, node, state)

        if ax_max_effective <= 0 or ay_max <= 0:
            return False

        return (ax / ax_max_effective) ** 2 + (ay / ay_max) ** 2 <= 1.0

    def update_state(self, state, speed_ms, ax, ay, dt_s, node):
        return state

    def initial_state(self):
        return CarDynamicsState()


# ---------------------------------------------------------------------------
# 3. FWD Model
# ---------------------------------------------------------------------------

class FWDModel(CarDynamicsBase):
    """
    Front-wheel-drive vehicle.

    Key behaviour: the front tyres handle both steering and traction.
    Under power at corner exit, the front axle is simultaneously being
    asked for lateral force (cornering) and longitudinal force (traction).
    This causes understeer — the car runs wide.

    Modelled as a reduction in effective ay_max when throttle is applied:

      ay_available = ay_max * (1 - understeer_factor * (ax / ax_max)²)

    The ideal FWD line therefore typically uses a later, tighter apex
    than RWD — getting the car rotated before applying throttle.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        defaults = {
            "modelId": "fwd",
            "vehicleClass": "fwd",
            "massKg": 1250,
            "muPeak": 1.05,
            "ayMaxMs2": 10.3,
            "axMaxMs2": 4.5,
            "brakingMaxMs2": 11.0,
            "vMaxMs": 52.8,
            "exitUndersteerFactor": 0.4,
        }
        super().__init__({**defaults, **(config or {})})

    def max_lateral_acceleration_ms2(self, speed_ms, node, state):
        base = self._config["ayMaxMs2"]
        banking_bonus = self._g * np.sin(node.banking_angle)
        return (base + banking_bonus) * node.surface_grip_factor

    def max_acceleration_ms2(self, speed_ms, node, state):
        return self._config["axMaxMs2"] * node.surface_grip_factor

    def max_braking_ms2(self, speed_ms, node, state):
        return self._config["brakingMaxMs2"] * node.surface_grip_factor

    def is_feasible(self, ax, ay, speed_ms, node, state):
        ay_max_base = self.max_lateral_acceleration_ms2(speed_ms, node, state)
        ax_max = self.max_acceleration_ms2(speed_ms, node, state)

        if ax >= 0 and ax_max > 0:
            # FWD understeer under power: lateral limit shrinks as throttle increases
            understeer = self._config["exitUndersteerFactor"]
            throttle_fraction = ax / ax_max
            ay_max_effective = ay_max_base * (
                1.0 - understeer * throttle_fraction ** 2
            )
            ax_limit = ax_max
        else:
            ay_max_effective = ay_max_base
            ax_limit = self.max_braking_ms2(speed_ms, node, state)

        if ax_limit <= 0 or ay_max_effective <= 0:
            return False

        return (ax / ax_limit) ** 2 + (ay / ay_max_effective) ** 2 <= 1.0

    def update_state(self, state, speed_ms, ax, ay, dt_s, node):
        return state

    def initial_state(self):
        return CarDynamicsState()


# ---------------------------------------------------------------------------
# 4. AWD Model
# ---------------------------------------------------------------------------

class AWDModel(CarDynamicsBase):
    """
    All-wheel-drive vehicle.

    AWD distributes traction across all four wheels, which means
    the longitudinal traction limit is higher and less sensitive to
    lateral load than RWD or FWD.  The combined GG envelope is
    approximately elliptical with a bonus in the combined region.

    The frontTorqueSplit parameter controls the balance:
    - 0.0 = pure RWD behaviour
    - 0.5 = perfectly balanced
    - 1.0 = pure FWD behaviour

    At intermediate splits, the combined-slip penalty is reduced
    proportionally — the tyres share the longitudinal work across
    more contact patches.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        defaults = {
            "modelId": "awd",
            "vehicleClass": "awd",
            "massKg": 1600,
            "muPeak": 1.3,
            "ayMaxMs2": 12.7,
            "axMaxMs2": 7.0,
            "brakingMaxMs2": 13.5,
            "vMaxMs": 75.0,
            "frontTorqueSplit": 0.4,
        }
        super().__init__({**defaults, **(config or {})})

    def max_lateral_acceleration_ms2(self, speed_ms, node, state):
        base = self._config["ayMaxMs2"]
        banking_bonus = self._g * np.sin(node.banking_angle)
        return (base + banking_bonus) * node.surface_grip_factor

    def max_acceleration_ms2(self, speed_ms, node, state):
        return self._config["axMaxMs2"] * node.surface_grip_factor

    def max_braking_ms2(self, speed_ms, node, state):
        return self._config["brakingMaxMs2"] * node.surface_grip_factor

    def is_feasible(self, ax, ay, speed_ms, node, state):
        ay_max = self.max_lateral_acceleration_ms2(speed_ms, node, state)
        lat_fraction = abs(ay) / ay_max if ay_max > 0 else 0.0

        # AWD reduces the combined-slip penalty relative to single-axle cars
        # by distributing traction: penalty scales with how far from balanced split
        split = self._config["frontTorqueSplit"]
        balance_factor = 1.0 - 2.0 * abs(split - 0.5)  # 1.0 at 50:50, 0 at pure FWD/RWD
        combined_penalty = (1.0 - balance_factor) * 0.15 * lat_fraction ** 2

        if ax >= 0:
            ax_max_effective = self._config["axMaxMs2"] * (
                1.0 - combined_penalty
            ) * node.surface_grip_factor
        else:
            ax_max_effective = self.max_braking_ms2(speed_ms, node, state)

        if ax_max_effective <= 0 or ay_max <= 0:
            return False

        return (ax / ax_max_effective) ** 2 + (ay / ay_max) ** 2 <= 1.0

    def update_state(self, state, speed_ms, ax, ay, dt_s, node):
        return state

    def initial_state(self):
        return CarDynamicsState()


# ---------------------------------------------------------------------------
# Future plugin stubs — define interface now, implement later
# ---------------------------------------------------------------------------

class AeroPlugin:
    """
    Aerodynamic downforce plugin.
    Wraps any CarDynamicsBase model and scales ay_max and braking_max
    with speed²: F_down = Cl * 0.5 * rho * A * v²

    To use: AeroPlugin(base_model, aero_config)
    The solver calls the same ICarDynamicsBase interface — no changes needed.

    TODO Sprint 3: implement full downforce calculation.
    """

    def __init__(self, base_model: CarDynamicsBase, aero_config: dict[str, Any]):
        self._base = base_model
        self._aero_config = aero_config
        raise NotImplementedError(
            "AeroPlugin is not yet implemented. "
            "Use PointMassModel, RWDModel, FWDModel, or AWDModel."
        )


class TyreThermalsPlugin:
    """
    Tyre thermal model plugin.
    Wraps any CarDynamicsBase model and modulates muPeak based on
    tyre temperature state (updated via update_state each step).

    Uses CarDynamicsState.tyre_temps_c to track temperature per corner.

    TODO Sprint 4: implement thermal state machine.
    """

    def __init__(self, base_model: CarDynamicsBase, thermal_config: dict[str, Any]):
        raise NotImplementedError("TyreThermalsPlugin is not yet implemented.")


class WeightTransferPlugin:
    """
    Weight transfer dynamics plugin.
    Models the transient load distribution as the car changes speed/direction.
    Affects per-axle grip limits — particularly relevant for stiff race cars.

    TODO Sprint 5: implement load transfer equations.
    """

    def __init__(self, base_model: CarDynamicsBase, wt_config: dict[str, Any]):
        raise NotImplementedError("WeightTransferPlugin is not yet implemented.")


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

MODEL_REGISTRY: dict[str, type[CarDynamicsBase]] = {
    "point_mass": PointMassModel,
    "rwd":        RWDModel,
    "fwd":        FWDModel,
    "awd":        AWDModel,
}


def create_model(model_id: str, config: dict[str, Any] | None = None) -> CarDynamicsBase:
    """
    Factory function. Returns the requested model instance.
    Raises ValueError for unknown model IDs.
    """
    cls = MODEL_REGISTRY.get(model_id)
    if cls is None:
        raise ValueError(
            f"Unknown model_id '{model_id}'. "
            f"Available: {list(MODEL_REGISTRY.keys())}"
        )
    return cls(config)
