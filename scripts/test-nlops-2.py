import json, urllib.request, http.client

API = "http://localhost:3030/api"

# Login
data = json.dumps({"email":"wettest6@homer.test","password":"WetTest1234"}).encode()
req = urllib.request.Request(API + "/auth/login", data=data, headers={"Content-Type":"application/json"})
token = json.loads(urllib.request.urlopen(req).read())["accessToken"]

queries = [
    "Give me an operational summary",
    "What do we know about delivery intelligence and failure patterns?",
    "List all failed orders",
]

for q in queries:
    print(f"\n{'='*60}")
    print(f"Q: {q}")
    print('='*60)

    conn = http.client.HTTPConnection("localhost", 3030)
    body = json.dumps({"message": q})
    conn.request("POST", "/api/ai/ops", body, {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    })
    resp = conn.getresponse()
    raw = resp.read().decode()

    for line in raw.split("\n"):
        if line.startswith("data: "):
            try:
                evt = json.loads(line[6:])
                t = evt.get("type", "?")
                if t == "tool_start":
                    print(f"  [tool] {evt.get('name','?')}({json.dumps(evt.get('input',{}))[:100]})")
                elif t == "tool_result":
                    print(f"  [result] {evt.get('name','?')} -> {evt.get('summary','')[:100]}")
                elif t == "message":
                    print(f"  [reply] {evt.get('content','')[:400]}")
                elif t == "error":
                    print(f"  [ERROR] {evt.get('message','')}")
            except:
                pass
    conn.close()

print("\n=== ALL QUERIES DONE ===")
