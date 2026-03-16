#!/bin/bash
# Wet test part 2: multiple deliveries, failures, risk scoring
set -e

API="http://localhost:3030/api"

TOKEN=$(python3 -c "
import json, urllib.request
data = json.dumps({'email':'wettest6@homer.test','password':'WetTest1234'}).encode()
req = urllib.request.Request('$API/auth/login', data=data, headers={'Content-Type':'application/json'})
resp = json.loads(urllib.request.urlopen(req).read())
print(resp['accessToken'])
")
H="Authorization: Bearer $TOKEN"

DRV_ID=$(curl -s "$API/fleet/drivers?page=1&limit=1" -H "$H" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")

api_call() {
  local method=$1 path=$2 body=$3
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API$path" -H "$H" -H "Content-Type: application/json" -d "$body"
  else
    curl -s "$API$path" -H "$H"
  fi
}

# Same address as test 1 — different apartment
echo "=== Delivery 2: Same building, delivered ==="
ORD=$(api_call POST /orders '{"recipientName":"Bob Builder","deliveryAddress":{"street":"100 Broadway Apt 12","city":"Denver","state":"CO","zip":"80201","country":"US","coords":{"lat":39.7392,"lng":-104.9903}}}')
ORD_ID=$(echo "$ORD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ROUTE=$(api_call POST /routes "{\"name\":\"Test 2\",\"driverId\":\"$DRV_ID\",\"orderIds\":[\"$ORD_ID\"]}")
ROUTE_ID=$(echo "$ROUTE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"planned"}' > /dev/null
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"in_progress"}' > /dev/null
api_call POST "/routes/$ROUTE_ID/stops/$ORD_ID/complete" '{"status":"delivered"}' > /dev/null
echo "Completed delivery 2"

echo "=== Delivery 3: Same building, FAILED ==="
ORD=$(api_call POST /orders '{"recipientName":"Charlie Fail","deliveryAddress":{"street":"100 Broadway Suite 3","city":"Denver","state":"CO","zip":"80201","country":"US","coords":{"lat":39.7392,"lng":-104.9903}}}')
ORD_ID=$(echo "$ORD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ROUTE=$(api_call POST /routes "{\"name\":\"Test 3\",\"driverId\":\"$DRV_ID\",\"orderIds\":[\"$ORD_ID\"]}")
ROUTE_ID=$(echo "$ROUTE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"planned"}' > /dev/null
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"in_progress"}' > /dev/null
api_call POST "/routes/$ROUTE_ID/stops/$ORD_ID/complete" '{"status":"failed","failureReason":"Nobody home, rang bell"}' > /dev/null
echo "Completed delivery 3 (failed)"

echo "=== Delivery 4: Same building, FAILED ==="
ORD=$(api_call POST /orders '{"recipientName":"David Nope","deliveryAddress":{"street":"100 Broadway Unit 8","city":"Denver","state":"CO","zip":"80201","country":"US","coords":{"lat":39.7392,"lng":-104.9903}}}')
ORD_ID=$(echo "$ORD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ROUTE=$(api_call POST /routes "{\"name\":\"Test 4\",\"driverId\":\"$DRV_ID\",\"orderIds\":[\"$ORD_ID\"]}")
ROUTE_ID=$(echo "$ROUTE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"planned"}' > /dev/null
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"in_progress"}' > /dev/null
api_call POST "/routes/$ROUTE_ID/stops/$ORD_ID/complete" '{"status":"failed","failureReason":"Gate locked, access denied"}' > /dev/null
echo "Completed delivery 4 (failed)"

echo "=== Waiting 10s for worker ==="
sleep 10

echo "=== Intelligence Insights (should show 1 address, multiple deliveries) ==="
api_call GET /intelligence/insights | python3 -m json.tool

echo ""
echo "=== Risk Score for last route ==="
api_call GET "/intelligence/risk/$ROUTE_ID" | python3 -m json.tool

echo ""
echo "=== Worker logs ==="
pm2 logs homer-worker --lines 10 --nostream 2>&1 | grep "delivery-learning"

echo ""
echo "=== Check address_intelligence table directly ==="
docker exec homer-postgres psql -U homer -d homer -c "SELECT address_hash, total_deliveries, successful_deliveries, failed_deliveries, avg_service_time_seconds, common_failure_reasons FROM address_intelligence LIMIT 5;"

echo ""
echo "=== Check delivery_metrics table ==="
docker exec homer-postgres psql -U homer -d homer -c "SELECT order_id, delivery_status, failure_category, service_time_seconds FROM delivery_metrics ORDER BY created_at DESC LIMIT 10;"

echo "=== DONE ==="
