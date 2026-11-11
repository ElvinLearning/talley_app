"""Add one repeatable synthetic example through the running local API."""
import http.cookiejar
import json
import os
import urllib.request

BASE = "http://127.0.0.1:8000/api"
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(path, data=None, method=None):
    request = urllib.request.Request(BASE+path, data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type":"application/json","X-Talley-Request":"1"}, method=method)
    with client.open(request) as response:
        return json.load(response)

def main():
    password=os.environ.get("TALLEY_DEMO_PASSWORD")
    if not password:
        raise SystemExit("Set TALLEY_DEMO_PASSWORD to the password used when seeding the demo accounts.")
    call("/auth/login",{"username":"admin.demo","password":password},"POST")
    name="Demo · South Philadelphia kitchen refresh"
    existing=next((j for j in call("/jobs") if j["name"]==name),None)
    if existing:
        print("Sample job already exists: #"+str(existing["id"]))
        return
    customer=call("/customers",{"name":"Demo homeowner","contact":"Jordan Example","email":"jordan@example.test","phone":"215-555-0100"},"POST")
    job=call("/jobs",{"customer_id":customer["id"],"name":name,
        "address":"100 Example Street, Philadelphia, PA (synthetic site)",
        "scope":"Demo only: prepare the kitchen, install 100 sq ft of tile and coordinate electrical work. Verify measurements before any real quote."},"POST")
    estimate=call(f"/jobs/{job['id']}/estimates",{},"POST")
    document={"version":estimate["version"],"markup_percent":"20","tax_percent":"6","tax_basis":"materials",
        "notes":"Synthetic prices for workflow demonstration only. Tax and markup are provisional, not approved business rules.",
        "sections":[{"name":"Kitchen preparation & tile","lines":[
            {"description":"Preparation and installation labor","kind":"labor","quantity":"8","unit":"hour","unit_cost":"65"},
            {"description":"Tile allowance","kind":"material","quantity":"100","unit":"sq ft","unit_cost":"3.25"}]},
            {"name":"Electrical","lines":[{"description":"Electrical subcontract allowance","kind":"subcontractor","quantity":"1","unit":"allowance","unit_cost":"250"}]}]}
    call(f"/estimates/{estimate['id']}",document,"PUT")
    call("/auth/logout",{},"POST")
    print(f"Sample job #{job['id']} and draft estimate #{estimate['id']} ready. Expected client total: $1,337.40.")

if __name__ == "__main__":
    main()
