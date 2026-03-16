#!/bin/bash
# Refresh OSRM data with latest OSM extract.
# Run monthly via cron: 0 3 1 * * /opt/homer-io/infra/osrm/refresh-osrm.sh us/new-york
#
# Downloads fresh extract, preprocesses in a staging directory,
# then swaps the container with zero downtime.

set -euo pipefail

REGION="${1:-us/new-york}"
DATA_DIR="/opt/osrm-data"
STAGING_DIR="/opt/osrm-staging"
CONTAINER_NAME="osrm-homer"
OSRM_IMAGE="osrm/osrm-backend:v5.27.1"
PORT=5000

echo "[$(date)] Starting OSRM data refresh for ${REGION}"

# Prepare staging directory
sudo rm -rf "${STAGING_DIR}"
sudo mkdir -p "${STAGING_DIR}"

# Download fresh extract
DOWNLOAD_URL="https://download.geofabrik.de/${REGION}-latest.osm.pbf"
echo "Downloading ${DOWNLOAD_URL}..."
sudo wget -q -O "${STAGING_DIR}/region.osm.pbf" "${DOWNLOAD_URL}"

# Preprocess in staging
echo "Extracting..."
docker run --rm -t -v "${STAGING_DIR}:/data" "${OSRM_IMAGE}" \
  osrm-extract -p /opt/car.lua /data/region.osm.pbf

echo "Partitioning..."
docker run --rm -t -v "${STAGING_DIR}:/data" "${OSRM_IMAGE}" \
  osrm-partition /data/region.osrm

echo "Customizing..."
docker run --rm -t -v "${STAGING_DIR}:/data" "${OSRM_IMAGE}" \
  osrm-customize /data/region.osrm

# Swap: stop old container, replace data, start new container
echo "Swapping data..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

sudo rm -rf "${DATA_DIR}.old"
sudo mv "${DATA_DIR}" "${DATA_DIR}.old" 2>/dev/null || true
sudo mv "${STAGING_DIR}" "${DATA_DIR}"

# Start with new data
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --memory 2g \
  -p "127.0.0.1:${PORT}:5000" \
  -v "${DATA_DIR}:/data" \
  "${OSRM_IMAGE}" \
  osrm-routed --algorithm mld /data/region.osrm --max-table-size 10000

# Verify with retry loop
STARTED=false
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then
    STARTED=true
    break
  fi
  sleep 1
done

if [ "$STARTED" = true ]; then
  echo "[$(date)] OSRM refresh complete — running on port ${PORT}"
  sudo rm -rf "${DATA_DIR}.old"
else
  echo "[$(date)] ERROR: OSRM failed to start with new data, rolling back"
  docker stop "${CONTAINER_NAME}" 2>/dev/null || true
  docker rm "${CONTAINER_NAME}" 2>/dev/null || true
  sudo rm -rf "${DATA_DIR}"
  sudo mv "${DATA_DIR}.old" "${DATA_DIR}"
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --memory 2g \
    -p "127.0.0.1:${PORT}:5000" \
    -v "${DATA_DIR}:/data" \
    "${OSRM_IMAGE}" \
    osrm-routed --algorithm mld /data/region.osrm --max-table-size 10000
  exit 1
fi
