-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid_ossp";

-- CreateEnum
CREATE TYPE "SolverJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rnTrackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trackId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "centreline" geometry(LineStringZ, 4326),
    "boundaryLeft" geometry(LineString, 4326),
    "boundaryRight" geometry(LineString, 4326),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_corridors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variantId" UUID NOT NULL,
    "totalLengthM" DOUBLE PRECISION NOT NULL,
    "numNodes" INTEGER NOT NULL,
    "nodes" JSONB NOT NULL,
    "processingVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_corridors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "vehicleClass" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajectories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variantId" UUID NOT NULL,
    "vehiclePresetId" UUID,
    "sourceType" TEXT NOT NULL,
    "lapTimeS" DOUBLE PRECISION NOT NULL,
    "lateralOffsets" JSONB NOT NULL,
    "speedProfileMs" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "gpsPath" geometry(LineString, 4326),
    "recordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trajectories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solver_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variantId" UUID NOT NULL,
    "vehiclePresetId" UUID,
    "status" "SolverJobStatus" NOT NULL DEFAULT 'PENDING',
    "solverLevel" TEXT NOT NULL,
    "solverConfig" JSONB NOT NULL,
    "resultTrajectoryId" UUID,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "solver_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajectory_comparisons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referenceTrajectoryId" UUID NOT NULL,
    "comparedTrajectoryId" UUID NOT NULL,
    "deltaTimeS" JSONB NOT NULL,
    "lateralDeviationM" JSONB NOT NULL,
    "summaryDeltaS" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trajectory_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT,

    CONSTRAINT "rn_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_track_variant_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rnTrackId" TEXT NOT NULL,
    "rnVariantId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "rawDefinitionXml" TEXT NOT NULL,
    "centrelinePoints" JSONB NOT NULL,
    "startLinePoints" JSONB NOT NULL,
    "endLinePoints" JSONB NOT NULL,
    "sectorLines" JSONB NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "widthM" DOUBLE PRECISION NOT NULL,
    "trackType" INTEGER NOT NULL,
    "processedVariantId" UUID,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rn_track_variant_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rnEventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),

    CONSTRAINT "rn_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_event_variants" (
    "eventId" UUID NOT NULL,
    "variantSourceId" UUID NOT NULL,

    CONSTRAINT "rn_event_variants_pkey" PRIMARY KEY ("eventId","variantSourceId")
);

-- CreateTable
CREATE TABLE "rn_drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rnDriverId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT,

    CONSTRAINT "rn_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_laps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rnSourceLapId" INTEGER NOT NULL,
    "lapNumber" INTEGER NOT NULL,
    "lapType" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "isStartLineCrossed" BOOLEAN NOT NULL,
    "isEndLineCrossed" BOOLEAN NOT NULL,
    "lapTimeMs" INTEGER,
    "sourceDeviceId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "rnVariantSourceId" UUID NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "exportDeviceName" TEXT,
    "exportDeviceVersion" TEXT,
    "exportDeviceTime" TIMESTAMP(3),
    "trajectoryId" UUID,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rn_laps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_measurements" (
    "id" BIGSERIAL NOT NULL,
    "rnId" INTEGER NOT NULL,
    "lapId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitudeM" DOUBLE PRECISION NOT NULL,
    "directionDeg" DOUBLE PRECISION NOT NULL,
    "gpsSpeedKph" DOUBLE PRECISION NOT NULL,
    "gpsPosDeviationCm" INTEGER NOT NULL,
    "gpsAccuracy" INTEGER NOT NULL,
    "isGpsValid" BOOLEAN NOT NULL,
    "isPositionCalculated" BOOLEAN NOT NULL,
    "lateralG" DOUBLE PRECISION NOT NULL,
    "longitudinalG" DOUBLE PRECISION NOT NULL,
    "verticalG" DOUBLE PRECISION NOT NULL,
    "pitchRateDs" DOUBLE PRECISION NOT NULL,
    "rollRateDs" DOUBLE PRECISION NOT NULL,
    "yawRateDs" DOUBLE PRECISION NOT NULL,
    "isGyroValid" BOOLEAN NOT NULL,
    "distanceMm" INTEGER NOT NULL,
    "distanceOffsetMm" INTEGER NOT NULL,
    "rpm" INTEGER NOT NULL,
    "throttlePct" INTEGER NOT NULL,
    "obdSpeedKph" DOUBLE PRECISION NOT NULL,
    "oilTempC" INTEGER NOT NULL,
    "coolantTempC" INTEGER NOT NULL,
    "isObdValid" BOOLEAN NOT NULL,
    "gear" INTEGER,
    "steeringAngle" INTEGER,
    "brakePct" INTEGER,
    "oilPressureBar" DOUBLE PRECISION,
    "measurementNumber" INTEGER NOT NULL,

    CONSTRAINT "rn_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rn_can_records" (
    "id" BIGSERIAL NOT NULL,
    "rnId" BIGINT NOT NULL,
    "lapId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "channelName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "rn_can_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracks_rnTrackId_key" ON "tracks"("rnTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "track_corridors_variantId_processingVersion_key" ON "track_corridors"("variantId", "processingVersion");

-- CreateIndex
CREATE INDEX "trajectories_variantId_sourceType_idx" ON "trajectories"("variantId", "sourceType");

-- CreateIndex
CREATE INDEX "trajectories_variantId_lapTimeS_idx" ON "trajectories"("variantId", "lapTimeS");

-- CreateIndex
CREATE UNIQUE INDEX "solver_jobs_resultTrajectoryId_key" ON "solver_jobs"("resultTrajectoryId");

-- CreateIndex
CREATE INDEX "solver_jobs_status_idx" ON "solver_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "trajectory_comparisons_referenceTrajectoryId_comparedTrajec_key" ON "trajectory_comparisons"("referenceTrajectoryId", "comparedTrajectoryId");

-- CreateIndex
CREATE UNIQUE INDEX "rn_devices_deviceName_key" ON "rn_devices"("deviceName");

-- CreateIndex
CREATE UNIQUE INDEX "rn_track_variant_sources_processedVariantId_key" ON "rn_track_variant_sources"("processedVariantId");

-- CreateIndex
CREATE INDEX "rn_track_variant_sources_rnTrackId_idx" ON "rn_track_variant_sources"("rnTrackId");

-- CreateIndex
CREATE UNIQUE INDEX "rn_track_variant_sources_rnVariantId_versionNumber_key" ON "rn_track_variant_sources"("rnVariantId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rn_events_rnEventId_key" ON "rn_events"("rnEventId");

-- CreateIndex
CREATE UNIQUE INDEX "rn_drivers_rnDriverId_key" ON "rn_drivers"("rnDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "rn_laps_trajectoryId_key" ON "rn_laps"("trajectoryId");

-- CreateIndex
CREATE INDEX "rn_laps_rnVariantSourceId_idx" ON "rn_laps"("rnVariantSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "rn_laps_sourceDeviceId_eventId_rnSourceLapId_key" ON "rn_laps"("sourceDeviceId", "eventId", "rnSourceLapId");

-- CreateIndex
CREATE INDEX "rn_measurements_lapId_distanceMm_idx" ON "rn_measurements"("lapId", "distanceMm");

-- CreateIndex
CREATE INDEX "rn_measurements_lapId_measuredAt_idx" ON "rn_measurements"("lapId", "measuredAt");

-- CreateIndex
CREATE INDEX "rn_can_records_lapId_channelName_idx" ON "rn_can_records"("lapId", "channelName");

-- AddForeignKey
ALTER TABLE "track_variants" ADD CONSTRAINT "track_variants_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_corridors" ADD CONSTRAINT "track_corridors_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "track_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "track_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajectories" ADD CONSTRAINT "trajectories_vehiclePresetId_fkey" FOREIGN KEY ("vehiclePresetId") REFERENCES "vehicle_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solver_jobs" ADD CONSTRAINT "solver_jobs_vehiclePresetId_fkey" FOREIGN KEY ("vehiclePresetId") REFERENCES "vehicle_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solver_jobs" ADD CONSTRAINT "solver_jobs_resultTrajectoryId_fkey" FOREIGN KEY ("resultTrajectoryId") REFERENCES "trajectories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajectory_comparisons" ADD CONSTRAINT "trajectory_comparisons_referenceTrajectoryId_fkey" FOREIGN KEY ("referenceTrajectoryId") REFERENCES "trajectories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajectory_comparisons" ADD CONSTRAINT "trajectory_comparisons_comparedTrajectoryId_fkey" FOREIGN KEY ("comparedTrajectoryId") REFERENCES "trajectories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_track_variant_sources" ADD CONSTRAINT "rn_track_variant_sources_processedVariantId_fkey" FOREIGN KEY ("processedVariantId") REFERENCES "track_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_event_variants" ADD CONSTRAINT "rn_event_variants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "rn_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_event_variants" ADD CONSTRAINT "rn_event_variants_variantSourceId_fkey" FOREIGN KEY ("variantSourceId") REFERENCES "rn_track_variant_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_laps" ADD CONSTRAINT "rn_laps_sourceDeviceId_fkey" FOREIGN KEY ("sourceDeviceId") REFERENCES "rn_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_laps" ADD CONSTRAINT "rn_laps_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "rn_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_laps" ADD CONSTRAINT "rn_laps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "rn_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_laps" ADD CONSTRAINT "rn_laps_rnVariantSourceId_fkey" FOREIGN KEY ("rnVariantSourceId") REFERENCES "rn_track_variant_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_laps" ADD CONSTRAINT "rn_laps_trajectoryId_fkey" FOREIGN KEY ("trajectoryId") REFERENCES "trajectories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_measurements" ADD CONSTRAINT "rn_measurements_lapId_fkey" FOREIGN KEY ("lapId") REFERENCES "rn_laps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rn_can_records" ADD CONSTRAINT "rn_can_records_lapId_fkey" FOREIGN KEY ("lapId") REFERENCES "rn_laps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
