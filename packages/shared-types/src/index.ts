/**
 * @package @rn-ideallinie/shared-types
 *
 * Central type definitions shared across all services and the frontend.
 * This file defines the core abstractions — especially ICarDynamicsModel —
 * that allow the solver to remain agnostic of vehicle physics implementation.
 */

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

export interface GpsPoint {
  lat: number;
  lon: number;
  altitudeM?: number;
}

export interface Point2D {
  x: number; // metres, local Cartesian
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

/** A position along the track expressed as arc-length from start */
export interface TrackPoint {
  s: number;       // arc-length along centreline (metres)
  pos: Point2D;    // Cartesian position
  heading: number; // radians, 0 = north
  curvature: number; // κ(s) in 1/m — positive = left turn
}

// ---------------------------------------------------------------------------
// Track corridor
// ---------------------------------------------------------------------------

export interface TrackCorridor {
  id: string;
  trackId: string;
  variantId: string;
  totalLengthM: number;
  nodes: TrackCorridorNode[];
}

export interface TrackCorridorNode {
  s: number;          // arc-length (metres)
  pos: Point2D;       // centreline Cartesian
  heading: number;    // radians
  curvature: number;  // κ (1/m)
  halfWidthLeft: number;   // metres to left boundary
  halfWidthRight: number;  // metres to right boundary
  /** Optional: road banking angle in radians (positive = banked left) */
  bankingAngle?: number;
  /** Optional: surface grip scalar relative to nominal (1.0 = nominal) */
  surfaceGripFactor?: number;
}

// ---------------------------------------------------------------------------
// Track Geometry — rendering-ready data for SVG viewer
// ---------------------------------------------------------------------------

/** A GPS point as stored in RN data (matches DB JSON shape) */
export interface RnGpsPointDto {
  latitude: number;
  longitude: number;
  direction: number; // degrees, 0=North clockwise
}

/** Geometry for a sector or start/finish line — three points in local coords */
export interface TrackLineGeometry {
  label: string;
  left: Point2D;
  centre: Point2D;
  right: Point2D;
}

/** Elevation sample: arc-length + altitude from telemetry */
export interface ElevationSample {
  s: number;         // arc-length along centreline (metres)
  altitudeM: number; // altitude in metres (GPS/barometric)
}

/** Complete rendering-ready geometry payload for a track variant */
export interface TrackGeometry {
  variantId: string;
  variantName: string;
  distanceM: number;
  widthM: number;
  /** Track centreline as projected Cartesian points with curvature */
  centreline: TrackPoint[];
  /** Left track boundary (centreline offset by +widthM/2 perpendicular) */
  boundaryLeft: Point2D[];
  /** Right track boundary (centreline offset by -widthM/2 perpendicular) */
  boundaryRight: Point2D[];
  /** Start/finish line in local coords */
  startLine: TrackLineGeometry | null;
  /** End line */
  endLine: TrackLineGeometry | null;
  /** Sector timing lines in local coords */
  sectorLines: TrackLineGeometry[];
  /** Bounding box for SVG viewBox computation */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Elevation profile from telemetry measurements (null if no lap data) */
  elevationProfile: ElevationSample[] | null;
  /** Elevation mapped to each centreline point via interpolation (null if no lap data) */
  centrelineElevation: (number | null)[] | null;
}

/** Lightweight outline for track card thumbnails */
export interface TrackOutline {
  variantId: string;
  /** Simplified centreline path (XY points, downsampled) */
  points: Point2D[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// ---------------------------------------------------------------------------
// Trajectory
// ---------------------------------------------------------------------------

export interface Trajectory {
  id: string;
  trackId: string;
  variantId: string;
  sourceType: TrajectorySourceType;
  /** Lateral offset from centreline at each corridor node (metres) */
  lateralOffsets: number[];
  speedProfileMs: number[];   // m/s at each node
  lapTimeS: number;
  metadata: TrajectoryMetadata;
}

export type TrajectorySourceType =
  | "rn_customer"       // recorded by RN hardware
  | "computed_ideal"    // output of our solver
  | "simulation"        // from RN Sim Connector / Assetto Corsa
  | "manual";           // hand-drawn / imported

export interface TrajectoryMetadata {
  driverId?: string;
  vehicleId?: string;
  vehicleClass?: VehicleClass;
  recordedAt?: Date;
  rnDeviceId?: string;
  solverConfig?: SolverConfig;
}

// ---------------------------------------------------------------------------
// Vehicle classification
// ---------------------------------------------------------------------------

export type VehicleClass =
  | "point_mass"   // generic, no drivetrain distinction
  | "fwd"          // front-wheel drive
  | "rwd"          // rear-wheel drive
  | "awd"          // all-wheel drive
  | "formula"      // open-wheel, high aero
  | "gt"           // GT / touring car
  | "custom";      // user-defined

// ---------------------------------------------------------------------------
// Car dynamics — THE CORE ABSTRACTION
// ---------------------------------------------------------------------------

/**
 * CarDynamicsState holds any mutable physical state that persists across
 * integration steps. For the simple point-mass model this is empty.
 * For tyre thermal models it would include tyre temperatures.
 * For weight transfer models it would include suspension deflections.
 *
 * All implementations must be serialisable (plain object, no class instances).
 */
export interface CarDynamicsState {
  /** Tyre temperatures per corner, °C — populated by ThermalModel */
  tyreTempsC?: [number, number, number, number]; // FL, FR, RL, RR
  /** Suspension deflections, mm — populated by WeightTransferModel */
  suspensionDeflectionMm?: [number, number, number, number];
  /** Current aerodynamic downforce coefficient — populated by AeroModel */
  currentClFactor?: number;
  /** Any additional state fields added by future plugins */
  [key: string]: unknown;
}

/**
 * ICarDynamicsModel — the central interface every vehicle model implements.
 *
 * The solver ONLY calls this interface. It never references a concrete model.
 * This is the extension point for all future physics improvements.
 *
 * All accelerations are in m/s².  Positive ax = acceleration, negative = braking.
 */
export interface ICarDynamicsModel {
  /** Human-readable model identifier, e.g. "point_mass", "rwd_aero" */
  readonly modelId: string;

  /** Current configuration (parameters) — serialisable */
  readonly config: CarModelConfig;

  /**
   * Maximum lateral acceleration available at this speed and track position.
   * For simple models this is constant. For aero models it increases with v².
   */
  maxLateralAccelerationMs2(
    speedMs: number,
    trackPoint: TrackCorridorNode,
    state: CarDynamicsState
  ): number;

  /**
   * Maximum longitudinal acceleration (throttle) available.
   * For simple models: constant ax_max.
   * For power-limited models: ax_max(v) = P / (m * v).
   */
  maxAccelerationMs2(
    speedMs: number,
    trackPoint: TrackCorridorNode,
    state: CarDynamicsState
  ): number;

  /**
   * Maximum braking deceleration (positive value = deceleration magnitude).
   * For simple models: constant.
   * For aero models: increases with v² (downforce improves braking).
   */
  maxBrakingMs2(
    speedMs: number,
    trackPoint: TrackCorridorNode,
    state: CarDynamicsState
  ): number;

  /**
   * Combined friction circle constraint.
   * Returns true if the given (ax, ay) combination is within limits.
   * Default implementations use the elliptical GG diagram.
   */
  isFeasible(
    ax: number,
    ay: number,
    speedMs: number,
    trackPoint: TrackCorridorNode,
    state: CarDynamicsState
  ): boolean;

  /**
   * Advance the dynamics state by one integration step.
   * For stateless models (point mass) this returns the same state unchanged.
   * For thermal models this updates tyre temperatures.
   * For weight transfer models this updates suspension state.
   *
   * @param dtS  time step in seconds
   */
  updateState(
    state: CarDynamicsState,
    speedMs: number,
    ax: number,
    ay: number,
    dtS: number,
    trackPoint: TrackCorridorNode
  ): CarDynamicsState;

  /** Return a fresh initial state for the start of a lap */
  initialState(): CarDynamicsState;
}

// ---------------------------------------------------------------------------
// Car model configuration — one interface per implementation
// ---------------------------------------------------------------------------

export interface CarModelConfig {
  vehicleClass: VehicleClass;
  /** Total vehicle mass including driver, kg */
  massKg: number;
  /** Peak tyre-road friction coefficient (combined, nominal conditions) */
  muPeak: number;
  /** Peak lateral acceleration, m/s² — derived: muPeak * g, overridable */
  ayMaxMs2: number;
  /** Peak longitudinal acceleration (throttle), m/s² */
  axMaxMs2: number;
  /** Peak braking deceleration, m/s² (positive) */
  brakingMaxMs2: number;
  /** Top speed, m/s */
  vMaxMs: number;
}

export interface FWDModelConfig extends CarModelConfig {
  vehicleClass: "fwd";
  /**
   * Traction oversteer factor at corner exit [0–1].
   * FWD cars understeer under power — this reduces effective ay at exit
   * when throttle is applied. 0 = no effect, 1 = maximum understeer penalty.
   */
  exitUndersteerFactor: number;
}

export interface RWDModelConfig extends CarModelConfig {
  vehicleClass: "rwd";
  /**
   * Throttle-oversteer sensitivity at corner exit [0–1].
   * High-power RWD cars lose rear traction under power at slow-speed exits.
   * This reduces effective ax_max when lateral load is high.
   */
  exitOversteerSensitivity: number;
}

export interface AWDModelConfig extends CarModelConfig {
  vehicleClass: "awd";
  /** Front torque split fraction [0–1], 0 = pure RWD, 1 = pure FWD */
  frontTorqueSplit: number;
}

// ---------------------------------------------------------------------------
// Future extension configs — defined now so the DB schema can accommodate them
// ---------------------------------------------------------------------------

/** Placeholder: Aerodynamic downforce plugin config */
export interface AeroPluginConfig {
  /** Lift coefficient (downforce) at reference speed */
  clRef: number;
  /** Reference speed for Cl, m/s */
  vRefMs: number;
  /** Frontal drag coefficient — affects top speed */
  cdFrontal: number;
}

/** Placeholder: Tyre thermal plugin config */
export interface TyreThermalsPluginConfig {
  /** Optimal tyre operating temperature, °C */
  optimalTempC: number;
  /** Grip loss fraction per °C below optimal */
  coldGripLossPerDegC: number;
  /** Grip loss fraction per °C above optimal */
  hotGripLossPerDegC: number;
  /** Thermal time constant (how fast tyres heat/cool), seconds */
  thermalTimeConstantS: number;
}

/** Placeholder: Weight transfer plugin config */
export interface WeightTransferPluginConfig {
  /** Front/rear weight distribution [0–1], 0.5 = 50/50 */
  weightDistributionFront: number;
  /** Roll stiffness, Nm/rad */
  rollStiffnessNmRad: number;
  /** Centre of gravity height, m */
  cgHeightM: number;
  /** Wheelbase, m */
  wheelbaseM: number;
}

// ---------------------------------------------------------------------------
// Default car configurations — ready-to-use presets
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIGS = {
  pointMass: {
    vehicleClass: "point_mass",
    massKg: 1400,
    muPeak: 1.1,
    ayMaxMs2: 10.8,   // ~1.1 g
    axMaxMs2: 5.0,    // ~0.5 g
    brakingMaxMs2: 12.0, // ~1.2 g
    vMaxMs: 55.6,     // 200 km/h
  } satisfies CarModelConfig,

  trackdayRWD: {
    vehicleClass: "rwd",
    massKg: 1350,
    muPeak: 1.2,
    ayMaxMs2: 11.8,
    axMaxMs2: 5.5,
    brakingMaxMs2: 13.0,
    vMaxMs: 69.4,     // 250 km/h
    exitOversteerSensitivity: 0.3,
  } satisfies RWDModelConfig,

  trackdayFWD: {
    vehicleClass: "fwd",
    massKg: 1250,
    muPeak: 1.05,
    ayMaxMs2: 10.3,
    axMaxMs2: 4.5,
    brakingMaxMs2: 11.0,
    vMaxMs: 52.8,     // 190 km/h
    exitUndersteerFactor: 0.4,
  } satisfies FWDModelConfig,

  trackdayAWD: {
    vehicleClass: "awd",
    massKg: 1600,
    muPeak: 1.3,
    ayMaxMs2: 12.7,
    axMaxMs2: 7.0,
    brakingMaxMs2: 13.5,
    vMaxMs: 75.0,     // 270 km/h
    frontTorqueSplit: 0.4,
  } satisfies AWDModelConfig,

  formulaCar: {
    vehicleClass: "formula",
    massKg: 800,
    muPeak: 1.8,
    ayMaxMs2: 25.0,   // ~2.5 g — aero augmented
    axMaxMs2: 12.0,
    brakingMaxMs2: 25.0,
    vMaxMs: 83.3,     // 300 km/h
  } satisfies CarModelConfig,
} as const;

// ---------------------------------------------------------------------------
// Solver configuration
// ---------------------------------------------------------------------------

export interface SolverConfig {
  /** Which algorithm level to use */
  level: SolverLevel;
  /** Number of discretisation nodes along the track */
  numNodes: number;
  /** Car dynamics model to use */
  carModelId: string;
  /** Car model configuration — overrides defaults */
  carModelConfig: CarModelConfig;
  /** Convergence tolerance for iterative solvers */
  tolerance?: number;
  /** Maximum solver iterations */
  maxIterations?: number;
}

export type SolverLevel =
  | "geometric"        // Level 1: inscribed circles
  | "min_curvature"    // Level 2: minimise ∫κ²ds  (recommended default)
  | "lap_time";        // Level 3: direct T minimisation

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  level: "min_curvature",
  numNodes: 500,
  carModelId: "point_mass",
  carModelConfig: DEFAULT_CONFIGS.pointMass,
  tolerance: 1e-4,
  maxIterations: 200,
};

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface IdealLineResult {
  requestId: string;
  trackId: string;
  variantId: string;
  trajectory: Trajectory;
  solverConfig: SolverConfig;
  computedAtMs: number;   // Unix timestamp ms
  solverDurationMs: number;
}

export interface TrajectoryComparisonResult {
  referenceTrajectoryId: string;
  comparedTrajectoryId: string;
  deltaTimeS: number[];       // time delta at each node (positive = reference faster)
  lateralDeviationM: number[]; // lateral deviation between the two paths
  summaryDeltaS: number;       // total lap time difference
}

// ---------------------------------------------------------------------------
// RN Import API types
// ---------------------------------------------------------------------------

export interface RnImportResult {
  status: "imported" | "duplicate" | "error";
  lapId?: string;
  rnSourceLapId: number;
  track: {
    id: string;
    name: string;
    variantName: string;
    variantVersion: number;
    action: "created" | "existing" | "new_version";
  };
  lap: {
    lapNumber: number;
    startTime: string;   // ISO-8601
    lapTimeMs: number | null;
  };
  counts: {
    measurements: number;
    canRecords: number;
  };
}

