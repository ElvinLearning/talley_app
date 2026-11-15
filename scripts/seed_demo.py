"""Add repeatable synthetic examples through the running local API.

    python scripts/seed_demo.py              # the walkthrough job only
    python scripts/seed_demo.py --showcase   # plus one job at every stage

Every name, address, person and price here is invented. Existing jobs with the
same name are skipped, so the script is safe to run again.
Set TALLEY_API_URL to seed an API that is not on http://127.0.0.1:8000/api.
"""
import http.cookiejar
import json
import os
import sys
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("TALLEY_API_URL", "http://127.0.0.1:8000/api").rstrip("/")
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(path, data=None, method=None):
    request = urllib.request.Request(BASE+path, data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type":"application/json","X-Talley-Request":"1"}, method=method)
    with client.open(request) as response:
        return json.load(response)

RULES = {"markup_percent":"20","tax_percent":"6","tax_basis":"materials"}
NOTES = "Synthetic prices for workflow demonstration only. Tax and markup are provisional, not approved business rules."
APPROVAL = "Synthetic approval for the demo; no customer communication."
ADMIN, WORKER = "Demo administrator", "Demo field worker"

def line(description, kind, quantity, unit, unit_cost):
    return {"description":description,"kind":kind,"quantity":str(quantity),"unit":unit,"unit_cost":str(unit_cost)}

def day(offset):
    return (date.today() + timedelta(days=offset)).isoformat()

def new_job(name, customer, contact, phone, address, scope, email=""):
    made = call("/customers",{"name":customer,"contact":contact,"email":email,"phone":phone},"POST")
    return call("/jobs",{"customer_id":made["id"],"name":name,"address":address+" (synthetic site)","scope":"Demo only: "+scope},"POST")

def priced(job, sections):
    estimate = call(f"/jobs/{job['id']}/estimates",{},"POST")
    return call(f"/estimates/{estimate['id']}",{"version":estimate["version"],**RULES,"notes":NOTES,
        "sections":[{"name":name,"lines":lines} for name,lines in sections]},"PUT")

def approved(estimate, by):
    return call(f"/estimates/{estimate['id']}/approve",{"version":estimate["version"],"approved_by":by,"note":APPROVAL},"POST")

def project(estimate, tasks, crew=True):
    """Create the project, add (section, task, status, owner, due offset, note) rows and give the crew access."""
    board_id = call(f"/estimates/{estimate['id']}/convert",{},"POST")["board_id"]
    groups = {group["name"]: group["id"] for group in call(f"/boards/{board_id}")["groups"]}
    for section, name, status, owner, due, note in tasks:
        call(f"/groups/{groups[section]}/items",{"name":name,"status":status,"owner":owner,
            "due_date":day(due) if due is not None else None,"notes":note},"POST")
    if crew:
        worker = next(w for w in call("/workers") if w["name"] == WORKER)
        call(f"/boards/{board_id}/assignments",{"user_ids":[worker["id"]]},"PUT")

def walkthrough():
    """The draft used step by step in docs/DEMO.md. Expected client total: $1,337.40."""
    job = new_job("Demo · South Philadelphia kitchen refresh","Demo homeowner","Jordan Example","215-555-0100",
        "100 Example Street, Philadelphia, PA",
        "prepare the kitchen, install 100 sq ft of tile and coordinate electrical work. Verify measurements before any real quote.",
        "jordan@example.test")
    priced(job,[("Kitchen preparation & tile",[
            line("Preparation and installation labor","labor",8,"hour",65),
            line("Tile allowance","material",100,"sq ft","3.25")]),
        ("Electrical",[line("Electrical subcontract allowance","subcontractor",1,"allowance",250)])])

def lead():
    new_job("Demo · Fishtown bathroom refresh","Demo homeowner (Fishtown)","Riley Sample","215-555-0101",
        "210 Example Street, Philadelphia, PA",
        "replace the vanity, toilet and floor tile in a hall bathroom. Customer asked for a site visit before pricing.")

def awaiting_project():
    job = new_job("Demo · Camden storefront fit-out","Demo retail tenant","Morgan Sample","856-555-0102",
        "310 Example Avenue, Camden, NJ","demolish the old counter wall, frame a new partition, drywall, paint and lay new flooring.",
        "morgan@example.test")
    approved(priced(job,[("Demolition & framing",[
            line("Demolition labor","labor",24,"hour",58),
            line("Framing lumber and fasteners","material",1,"lot",1150)]),
        ("Finishes",[
            line("Drywall and paint subcontract","subcontractor",1,"allowance",3400),
            line("Flooring material","material",620,"sq ft","4.10"),
            line("Flooring installation labor","labor",30,"hour",62)])]),"Morgan Sample")

def blocked_and_late():
    job = new_job("Demo · Girard Avenue porch repair","Demo homeowner (Girard)","Casey Example","215-555-0103",
        "410 Example Avenue, Philadelphia, PA","rebuild the front porch deck and steps, repoint the brick piers and repaint.")
    estimate = approved(priced(job,[("Porch structure",[
            line("Carpentry labor","labor",32,"hour",60),
            line("Pressure-treated lumber","material",1,"lot",980)]),
        ("Masonry",[line("Masonry repair subcontract","subcontractor",1,"allowance",1800)]),
        ("Paint",[line("Painting labor","labor",10,"hour",55),line("Exterior paint","material",4,"gallon",48)])]),"Casey Example")
    project(estimate,[
        ("Porch structure","Pull the permit","blocked",ADMIN,-2,"Waiting on the city to confirm the inspection window."),
        ("Porch structure","Remove rotted decking","done",WORKER,-6,"Hauled away. Two joists also need replacing."),
        ("Porch structure","Frame and lay new decking","not_started",WORKER,3,""),
        ("Masonry","Schedule the mason","in_progress",ADMIN,1,""),
        ("Paint","Prime and paint","not_started","",9,"")])

def on_track():
    job = new_job("Demo · West Philadelphia basement waterproofing","Demo landlord","Taylor Sample","215-555-0104",
        "510 Example Street, Philadelphia, PA","install an interior perimeter drain and sump pump, then seal the foundation walls.",
        "taylor@example.test")
    estimate = approved(priced(job,[("Drainage",[
            line("Trenching and drain labor","labor",40,"hour",58),
            line("Drain pipe and stone","material",1,"lot",1420),
            line("Sump pump","material",1,"each",385)]),
        ("Sealing",[line("Wall sealant","material",12,"gallon",42),line("Sealing labor","labor",16,"hour",58)])]),"Taylor Sample")
    project(estimate,[
        ("Drainage","Walk the basement with the customer","done",ADMIN,-4,""),
        ("Drainage","Trench and set the drain","in_progress",WORKER,2,""),
        ("Drainage","Install the sump pump","not_started",WORKER,5,""),
        ("Sealing","Seal the walls","not_started",WORKER,8,"")])

def on_hold():
    job = new_job("Demo · Cherry Hill deck replacement","Demo homeowner (Cherry Hill)","Jamie Example","856-555-0105",
        "610 Example Lane, Cherry Hill, NJ","remove the existing deck and build a new 12 x 16 ft deck. Customer is deciding on materials.")
    priced(job,[("Deck",[line("Carpentry labor","labor",48,"hour",60),line("Decking and framing material","material",1,"lot",3900)])])
    call(f"/jobs/{job['id']}/status",{"status":"on_hold"},"PATCH")

def complete():
    job = new_job("Demo · Germantown roof patch","Demo property manager","Alex Sample","215-555-0106",
        "710 Example Street, Philadelphia, PA","patch the flat roof at the rear addition and replace the flashing.")
    estimate = approved(priced(job,[("Roof",[
        line("Roofing subcontract","subcontractor",1,"allowance",2250),
        line("Flashing material","material",1,"lot",180),
        line("Supervision labor","labor",4,"hour",65)])]),"Alex Sample")
    project(estimate,[
        ("Roof","Meet the roofer on site","done",ADMIN,-12,""),
        ("Roof","Check the patch after rain","done",WORKER,-8,"Dry after two storms.")],crew=False)
    call(f"/jobs/{job['id']}/status",{"status":"complete"},"PATCH")

SHOWCASE = {
    "Demo · Germantown roof patch": complete,
    "Demo · Cherry Hill deck replacement": on_hold,
    "Demo · West Philadelphia basement waterproofing": on_track,
    "Demo · Girard Avenue porch repair": blocked_and_late,
    "Demo · Camden storefront fit-out": awaiting_project,
    "Demo · Fishtown bathroom refresh": lead,
}
WALKTHROUGH = {"Demo · South Philadelphia kitchen refresh": walkthrough}

def main():
    password=os.environ.get("TALLEY_DEMO_PASSWORD")
    if not password:
        raise SystemExit("Set TALLEY_DEMO_PASSWORD to the password used when seeding the demo accounts.")
    call("/auth/login",{"username":"admin.demo","password":password},"POST")
    existing={job["name"] for job in call("/jobs")}
    wanted={**(SHOWCASE if "--showcase" in sys.argv else {}),**WALKTHROUGH}
    for name, build in wanted.items():
        if name in existing:
            print("Already there: "+name)
            continue
        build()
        print("Added: "+name)
    call("/auth/logout",{},"POST")
    print("Done. The walkthrough draft's expected client total is $1,337.40.")

if __name__ == "__main__":
    main()
