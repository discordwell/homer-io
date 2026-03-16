import json, urllib.request, http.client

API = "http://localhost:3030/api"

# Login
data = json.dumps({"email":"wettest6@homer.test","password":"WetTest1234"}).encode()
req = urllib.request.Request(API + "/auth/login", data=data, headers={"Content-Type":"application/json"})
token = json.loads(urllib.request.urlopen(req).read())["accessToken"]
print(f"Logged in, token: {token[:20]}...")

# Test NLOps SSE endpoint
conn = http.client.HTTPConnection("localhost", 3030)
body = json.dumps({"message":"How many orders failed this week and why?"})
conn.request("POST", "/api/ai/ops", body, {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "Accept": "text/event-stream"
})
resp = conn.getresponse()
print(f"Status: {resp.status}")

# Read SSE events
raw = resp.read().decode()
events = []
for line in raw.split("\n"):
    if line.startswith("data: "):
        try:
            evt = json.loads(line[6:])
            events.append(evt)
            t = evt.get("type", "?")
            if t == "message":
                print(f"  [{t}] {evt.get('content','')[:300]}")
            elif t == "tool_start":
                print(f"  [{t}] {evt.get('name','?')}({json.dumps(evt.get('input',{}))[:80]})")
            elif t == "tool_result":
                print(f"  [{t}] {evt.get('name','?')} -> {evt.get('summary','')[:80]}")
            elif t == "thinking":
                print(f"  [{t}] {evt.get('content','')[:150]}")
            elif t == "error":
                print(f"  [{t}] {evt.get('message','')}")
            elif t == "done":
                print(f"  [{t}]")
        except Exception as e:
            print(f"  [parse error] {e}")

print(f"\nTotal events: {len(events)}")
conn.close()
