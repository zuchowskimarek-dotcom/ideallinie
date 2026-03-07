# RN Ideallinie — Ideal Racing Line Platform

**Part of:** RN NextGen · Race Navigator AI Platform  
**Status:** Sprint 0 — Foundation  
**Target path:** `iCloud Drive/projects/RN AI/ideallinie/`

---

## What This Is

A cloud-native, microservice-based platform for computing, storing, comparing, and
visualising optimal racing trajectories. Built on top of the existing Race Navigator
track database and customer trajectory data.

The core computation is a **minimum-curvature / lap-time optimisation** that finds
the ideal racing line for any supported circuit, parameterised by vehicle dynamics
model. The result is a GPS trajectory in the same format as existing RN recordings,
making it directly comparable inside the RN Analyzer.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend  (TypeScript + Vite)                          │
│  Track map · Trajectory overlay · Analysis charts       │
└────────────────────────┬────────────────────────────────┘
                         │ REST / JSON
┌────────────────────────▼────────────────────────────────┐
│  API Gateway  (TypeScript / Node.js)                    │
│  Auth · Routing · Response shaping                      │
└──────┬──────────────┬───────────────┬───────────────────┘
       │              │               │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────────────┐
│   Solver    │ │   Track    │ │  Trajectory            │
│  Service   │ │  Service   │ │  Service               │
│ (Python /  │ │  (TS)      │ │  (TS)                  │
│  FastAPI)  │ │            │ │                        │
└──────┬──────┘ └─────┬──────┘ └─────┬──────────────────┘
       │              │               │
┌──────▼──────────────▼───────────────▼───────────────────┐
│  PostgreSQL + PostGIS                                   │
│  Prisma ORM                                            │
└─────────────────────────────────────────────────────────┘
```

### Why Python for the solver?
The solver microservice is Python because:
- `numpy` / `scipy` are the best tools for the numerical work
- The rest of the stack is TypeScript — clean separation of concerns
- The solver is called over REST — language is irrelevant to the caller
- Future ML/data-science work (trajectory database fitting) lives naturally in Python

---

## Monorepo Structure

```
ideallinie/
├── packages/
│   ├── shared-types/          # TypeScript interfaces shared by all services + frontend
│   │   └── src/index.ts       # ICarDynamicsModel, TrackCorridor, Trajectory, etc.
│   └── solver/                # Python solver core
│       ├── car_dynamics/
│       │   ├── base.py        # CarDynamicsBase abstract class
│       │   ├── models.py      # PointMass, RWD, FWD, AWD + future plugin stubs
│       │   └── __init__.py
│       └── requirements.txt
│
├── services/
│   ├── api-gateway/           # TypeScript — routes requests to microservices
│   ├── solver-service/        # Python FastAPI — exposes solver over REST
│   ├── track-service/         # TypeScript — corridor building, track CRUD
│   └── trajectory-service/    # TypeScript — trajectory storage, comparison
│
├── frontend/                  # TypeScript + Vite
│   └── src/
│
├── database/
│   └── prisma/
│       └── schema.prisma      # PostgreSQL + PostGIS schema
│
├── docs/
├── .env.example
├── package.json               # Turborepo monorepo root
├── turbo.json
└── tsconfig.base.json
```

---

## Car Dynamics Model Architecture

The solver is **completely decoupled from vehicle physics** via the `CarDynamicsBase`
abstract class. The solver only ever calls the interface — it never knows whether
it is talking to the simple point-mass model or a full aero+thermal model.

```
CarDynamicsBase  (abstract)
├── max_lateral_acceleration_ms2(speed, node, state) → float
├── max_acceleration_ms2(speed, node, state) → float
├── max_braking_ms2(speed, node, state) → float
├── is_feasible(ax, ay, speed, node, state) → bool
├── update_state(state, speed, ax, ay, dt, node) → CarDynamicsState
└── initial_state() → CarDynamicsState

Implementations:
├── PointMassModel       Constant friction circle · 4 params · default
├── RWDModel             Reduced ax_max under combined load (oversteer sensitivity)
├── FWDModel             Reduced ay_max under throttle (understeer factor)
└── AWDModel             Balanced traction with front/rear torque split

Plugin stubs (future):
├── AeroPlugin           Wraps any base model · speed-dependent downforce
├── TyreThermalsPlugin   Wraps any base model · temperature-dependent μ
└── WeightTransferPlugin Wraps any base model · transient load distribution
```

To **add a new model or plugin**: subclass `CarDynamicsBase`, implement the 5 abstract
methods, add to `MODEL_REGISTRY` in `models.py`. The solver requires zero changes.

---

## Implementation Roadmap

### Sprint 0 — Foundation ✅ (current)
- [x] Monorepo scaffold (Turborepo, TypeScript, Python)
- [x] Shared type definitions (`ICarDynamicsModel`, `TrackCorridor`, `Trajectory`)
- [x] Prisma schema with PostGIS
- [x] Abstract car dynamics base class
- [x] PointMass, RWD, FWD, AWD model implementations
- [x] Plugin stubs (Aero, Thermals, WeightTransfer) with clear TODO markers

### Sprint 1 — Corridor Builder
- [ ] Track service: import GPS boundary polylines from RN track DB
- [ ] Spline fitting to smooth raw GPS data
- [ ] Compute `κ(s)`, `ψ(s)`, `w_L(s)`, `w_R(s)` per node
- [ ] Store as `TrackCorridor` in PostgreSQL
- [ ] Unit tests on known circuits (Nürburgring, Spa)

### Sprint 2 — Minimum Curvature Solver
- [ ] Solver service: FastAPI endpoint `POST /solve`
- [ ] Implement minimum curvature optimisation (`scipy` QP)
- [ ] Three-phase forward/backward speed profile integrator
- [ ] Return `Trajectory` object (same format as RN recordings)
- [ ] Solver job queue (async, PostgreSQL-backed)
- [ ] Validate against top-decile RN customer laps

### Sprint 3 — Trajectory Comparison & API
- [ ] Trajectory service: store, retrieve, compare trajectories
- [ ] Time delta and lateral deviation computation
- [ ] API Gateway routing to all services
- [ ] REST API documentation (OpenAPI)

### Sprint 4 — Frontend MVP
- [ ] Track map with trajectory overlay (deck.gl / Mapbox)
- [ ] Speed profile chart (Recharts)
- [ ] Lap time delta visualisation
- [ ] Vehicle model selector UI

### Sprint 5 — Database Integration & Calibration
- [ ] Import pipeline for RN customer trajectory data
- [ ] Parameter calibration: fit `μ`, `ax_max`, `ay_max` from observed laps
- [ ] Per-circuit correction field `δ(s)` from residuals

### Sprint 6+ — Advanced Physics (prioritised)
- [ ] AeroPlugin: speed-dependent downforce
- [ ] TyreThermalsPlugin: temperature-dependent grip
- [ ] WeightTransferPlugin: transient load distribution
- [ ] Banking / camber from 3D track data
- [ ] Surface grip variation map from trajectory database

---

## Database Setup

```bash
# 1. Start PostgreSQL with PostGIS
docker run -d \
  --name rn-ideallinie-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=rn_ideallinie \
  -p 5432:5432 \
  postgis/postgis:16-3.4

# 2. Copy environment
cp .env.example .env

# 3. Run migrations
npm run db:migrate

# 4. Generate Prisma client
npm run db:generate
```

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start all services (Turborepo)
npm run dev

# Or start individually:
cd services/solver-service && uvicorn main:app --reload --port 8001
cd services/track-service  && npm run dev
cd frontend                && npm run dev
```

---

## Key Dependencies

| Layer | Technology | Why |
|---|---|---|
| Frontend | TypeScript + Vite | Fast dev, shared types with backend |
| Map visualisation | deck.gl / Mapbox GL | GPU-accelerated trajectory rendering |
| API Gateway | Node.js / Express or Fastify | TS, lightweight, Prisma-native |
| Solver | Python + FastAPI | numpy/scipy for numerics, clean REST |
| ORM | Prisma | Already in use, excellent TS codegen |
| Database | PostgreSQL + PostGIS | Spatial queries, JSON, proven at scale |
| Monorepo | Turborepo | Parallel builds, shared packages |

---

*RN Vision / Macrix · RN NextGen Platform · March 2026*
