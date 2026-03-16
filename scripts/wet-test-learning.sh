#!/bin/bash
# Wet test: end-to-end learning pipeline
set -e

API="http://localhost:3030/api"

# Login
TOKEN=$(python3 -c "
import json, urllib.request
data = json.dumps({'email':'wettest6@homer.test','password':'WetTest1234'}).encode()
req = urllib.request.Request('$API/auth/login', data=data, headers={'Content-Type':'application/json'})
resp = json.loads(urllib.request.urlopen(req).read())
print(resp['accessToken'])
")
echo "TOKEN: ${TOKEN:0:20}..."

H="Authorization: Bearer $TOKEN"

# Get existing vehicle
VEH_ID=$(python3 -c "
import json, urllib.request
req = urllib.request.Request('$API/fleet/vehicles?page=1&limit=1', headers={'$H'.split(': ')[0]: '$H'.split(': ')[1]})
resp = json.loads(urllib.request.urlopen(req).read())
print(resp['items'][0]['id'] if resp['items'] else 'NONE')
")
echo "Vehicle: $VEH_ID"

# Get existing driver
DRV_ID=$(python3 -c "
import json, urllib.request
req = urllib.request.Request('$API/fleet/drivers?page=1&limit=1', headers={'$H'.split(': ')[0]: '$H'.split(': ')[1]})
resp = json.loads(urllib.request.urlopen(req).read())
print(resp['items'][0]['id'] if resp['items'] else 'NONE')
")
echo "Driver: $DRV_ID"

api_call() {
  local method=$1 path=$2 body=$3
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API$path" -H "$H" -H "Content-Type: application/json" -d "$body"
  else
    curl -s "$API$path" -H "$H"
  fi
}

# Create order
echo "=== Creating order ==="
ORD=$(api_call POST /orders '{"recipientName":"Test Learning","recipientPhone":"+15559999999","deliveryAddress":{"street":"100 Broadway Fl 5","city":"Denver","state":"CO","zip":"80201","country":"US","coords":{"lat":39.7392,"lng":-104.9903}}}')
ORD_ID=$(echo "$ORD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Order: $ORD_ID"

# Create route (no vehicleId since driver may not have one)
echo "=== Creating route ==="
ROUTE=$(api_call POST /routes "{\"name\":\"Learning Test\",\"driverId\":\"$DRV_ID\",\"orderIds\":[\"$ORD_ID\"]}")
ROUTE_ID=$(echo "$ROUTE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Route: $ROUTE_ID"

# Transition to in_progress
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"planned"}' > /dev/null
api_call PATCH "/routes/$ROUTE_ID/status" '{"status":"in_progress"}' > /dev/null
echo "Route in_progress"

# Complete stop
echo "=== Completing stop (delivered) ==="
COMP=$(api_call POST "/routes/$ROUTE_ID/stops/$ORD_ID/complete" '{"status":"delivered"}')
echo "$COMP"

# Wait for worker
echo "=== Waiting 8s for worker ==="
sleep 8

# Check intelligence
echo "=== Intelligence Insights ==="
api_call GET /intelligence/insights | python3 -m json.tool

echo "=== DONE ==="
