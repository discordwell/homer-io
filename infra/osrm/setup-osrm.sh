#!/bin/bash
# Setup OSRM routing engine with Docker.
# Usage: ./setup-osrm.sh [REGION]
# Example: ./setup-osrm.sh us/new-york
#
# Requires: docker, wget, ~4GB disk, ~2GB RAM for a US state extract.

set -euo pipefail

REGION="${1:-us/new-york}"
DATA_DIR="/opt/osrm-data"
CONTAINER_NAME="osrm-homer"
OSRM_IMAGE="osrm/osrm-backend:v5.27.1"
PORT=5000

echo "=== OSRM Setup for Homer.io ==="
echo "Region: ${REGION}"
echo "Data dir: ${DATA_DIR}"

# Create data directory
sudo mkdir -p "${DATA_DIR}"

# Download OSM extract from Geofabrik
PBF_FILE="${DATA_DIR}/region.osm.pbf"
DOWNLOAD_URL="https://download.geofabrik.de/${REGION}-latest.osm.pbf"

echo "Downloading OSM extract from ${DOWNLOAD_URL}..."
sudo wget -q --show-progress -O "${PBF_FILE}" "${DOWNLOAD_URL}"

# Stop existing container if running
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

# Preprocess with MLD algorithm (faster table queries than CH)
echo "Extracting road network..."
docker run --rm -t -v "${DATA_DIR}:/data" "${OSRM_IMAGE}" \
  osrm-extract -p /opt/car.lua /data/region.osm.pbf

echo "Partitioning graph..."
docker run --rm -t -v "${DATA_DIR}:/data" "${OSRM_IMAGE}" \
  osrm-partition /data/region.osrm

echo "Customizing graph..."
docker run --rm -t -v "${DATA_DIR}:/data" "${OSRM_IMAGE}" \
  osrm-customize /data/region.osrm

# Start OSRM container
echo "Starting OSRM on port ${PORT}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --memory 2g \
  -p "127.0.0.1:${PORT}:5000" \
  -v "${DATA_DIR}:/data" \
  "${OSRM_IMAGE}" \
  osrm-routed --algorithm mld /data/region.osrm --max-table-size 200

# Health check
echo "Waiting for OSRM to start..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then
    echo "OSRM is running on port ${PORT}"
    curl -s "http://localhost:${PORT}/" | head -c 200
    echo ""
    echo "=== Setup complete ==="
    exit 0
  fi
  sleep 1
done

echo "ERROR: OSRM did not start within 30 seconds"
docker logs "${CONTAINER_NAME}"
exit 1
