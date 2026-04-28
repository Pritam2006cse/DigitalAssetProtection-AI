from fastapi import FastAPI,File,UploadFile,Depends,BackgroundTasks,HTTPException
from auth import get_current_user, hash_password, verify_password, create_access_token
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from storage import upload_to_gcs
from dotenv import load_dotenv
from embedding import embed_watermark, extract_watermark, get_embedding
from google.cloud import storage as gcs_storage
from db import save_content
from db import db
from matcher import find_matches
from datetime import datetime,timezone
import shutil
from google.cloud import firestore
from email_service import send_email
import os
load_dotenv()
os.makedirs("temp", exist_ok=True)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace * with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel

class RegisterRequest(BaseModel):
    name: str      # expects "name" from frontend
    email: str     # expects "email" from frontend
    password: str  # expects "password" from frontend


@app.get("/")
def read_root():
    return {"message": "DigitalAssetProtection AI running"}


@app.post("/register")
def register(data: RegisterRequest):
    existing = db.collection("users").where("username","==",data.email).get()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    hashed = hash_password(data.password)
    db.collection("users").add({
        "username": data.email,   # store email as username
        "name": data.name,        # also store their name
        "password": hashed
    })
    return {"message": "User Registered Successfully"}


@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    users = db.collection("users").where("username", "==", form_data.username).get()
    if not users:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_data = users[0].to_dict()
    if not verify_password(form_data.password, user_data["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": form_data.username})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/upload")
def upload_file(file:UploadFile=File(...),background_tasks: BackgroundTasks = BackgroundTasks(),user_id: str = Depends(get_current_user)):
    file_location = f"temp/{file.filename}"

    with open(file_location,"wb") as buffer:
        shutil.copyfileobj(file.file,buffer)
    
    background_tasks.add_task(process_asset, file_location, file.filename, user_id)

    return {"message": "Upload received, please wait patiently",
            "filename":file.filename,
            "status": "Processing"}


def get_risk(similarity):
    if similarity > 0.90:
        return "HIGH"
    elif similarity > 0.75:
        return "MEDIUM"
    return "LOW"
#/*comment*

def process_asset(file_location: str, filename: str, user_id: str):
    file_type = None
    try:
        dna_vector,file_type = get_embedding(file_location)
        upload_location = file_location
        if file_type == "image":
            png_path = embed_watermark(file_location, user_id)
            upload_location = png_path
            safe_user = user_id.replace("@", "_").replace(".", "_")
            unique_filename = f"{safe_user}_{os.path.basename(png_path)}"
            filename = unique_filename
            print(f"DEBUG original file: {file_location}")
            print(f"DEBUG png_path returned: {png_path}")
            print(f"DEBUG upload_location: {upload_location}")
            print(f"DEBUG upload_location exists: {os.path.exists(upload_location)}")
            print(f"DEBUG new filename: {filename}")
        url = upload_to_gcs(upload_location, filename)
        print(f"DEBUG GCS url: {url}")
        matches = find_matches(dna_vector,file_type)
        current_time = datetime.now(timezone.utc)
        infringements = []

        for match in matches:
            if match["owner_id"] != user_id:
                if match["timestamp"] < str(current_time):
                    infringements.append(match)
                    alert = {
                        "owner_id": match["owner_id"],
                        "violator_id": user_id,
                        "content_id": match["file_id"],
                        "similarity": match["similarity"],
                        "risk": get_risk(match["similarity"]),
                        "timestamp": current_time
                    }
                    db.collection("alerts").add(alert)


        parent_id = None
        if matches:
            parent_id = matches[0]["file_id"]
        data = {
                "filename": filename,
                "url": url,
                "embedding": list(dna_vector),
                "owner_id": user_id,
                "file_type": file_type,
                "derived_from": parent_id,
                "timestamp": current_time
                }
        save_content(data)
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)
        if file_type == "image":
            png_path = file_location.rsplit(".", 1)[0] + "_wm.png"
            if os.path.exists(png_path):
                os.remove(png_path)


@app.get("/status/{filename}")
def get_status(filename: str, user_id: str = Depends(get_current_user)):
    results = db.collection("contents").where("filename","==",filename).where("owner_id","==",user_id).get()
    if not results:
        return {"status":"Processing"}
    else:
        return {"status":"Complete"}


@app.get("/graph")
def get_graph():
    contents = db.collection("contents").stream()

    nodes = []
    edges = []

    for doc in contents:
        data = doc.to_dict()
        node_id = doc.id

        nodes.append({
            "id": node_id,
            "label": data.get("filename")
        })

        if data.get("derived_from"):
            edges.append({
                "from": data["derived_from"],
                "to": node_id
            })

    return {
        "nodes": nodes,
        "edges": edges
    }

@app.post("/generate-takedown")
def generate_takedown(alert_id: str,user_id: str = Depends(get_current_user)):

    alert_doc = db.collection("alerts").document(alert_id).get()

    if not alert_doc.exists:
        return {"error": "Alert not found"}

    alert = alert_doc.to_dict()

    return {
        "notice": f"""
Subject: Unauthorized Use of Digital Asset

This is to notify that your content has been identified as unauthorized usage.

Original Owner: {alert['owner_id']}
Uploader: {alert['violator_id']}
Similarity Score: {alert['similarity']}
Risk Level: {alert['risk']}

Please remove this content immediately.

Generated by DigitalAssetProtection AI
"""
    }

@app.post("/send-takedown")
def send_takedown_email(to_email,alert_id,user_id: str = Depends(get_current_user)):
    alert_doc = db.collection("alerts").document(alert_id).get()
    if not alert_doc.exists:
        return {"error":"Alert Not Found"}
    alert = alert_doc.to_dict()
    notice = f"""
Subject: Unauthorized Use of Digital Asset

This content has been identified as unauthorized usage.

Original Owner: {alert['owner_id']}
Uploader: {alert['violator_id']}
Similarity Score: {alert['similarity']}
Risk Level: {alert['risk']}

Please remove this content immediately.

Generated by DigitalAssetProtection AI
"""
    success = send_email(to_email,"Takedown Notice: Digital Asset Infringement",notice)
    if success:
        return {"message":"Email sent successfully"}
    else:
        return {"error":"Email Failed"}
    

@app.get("/alerts")
def get_my_alerts(user_id: str = Depends(get_current_user)):
    alerts = db.collection("alerts")\
               .where("owner_id", "==", user_id)\
               .order_by("timestamp", direction=firestore.Query.DESCENDING)\
               .limit(50)\
               .stream()
    return [{"id": a.id, **a.to_dict()} for a in alerts]


@app.post("/verify-ownership")
async def verify_ownership(
    filename: str,
    claimed_owner_id: str = "",
    user_id: str = Depends(get_current_user)
):
    # ✅ Step 1 — Check Firestore who uploaded this filename first
    # Strip the user prefix to get the base filename
    # e.g. "john_gmail_com_SayanImg1_wm.png" → find all docs with same base
    base_name = "_".join(filename.split("_")[3:]) if filename.count("_") >= 3 else filename

    # Find all documents with this base filename pattern
    all_contents = db.collection("contents").stream()
    matching_docs = []

    for doc in all_contents:
        data = doc.to_dict()
        doc_filename = data.get("filename", "")
        doc_base = "_".join(doc_filename.split("_")[3:]) if doc_filename.count("_") >= 3 else doc_filename
        if doc_base == base_name:
            matching_docs.append({
                "owner_id": data.get("owner_id"),
                "timestamp": data.get("timestamp"),
                "filename": doc_filename
            })

    # ✅ Step 2 — Sort by timestamp to find who uploaded first
    if matching_docs:
        matching_docs.sort(key=lambda x: str(x["timestamp"]))
        first_uploader = matching_docs[0]["owner_id"]
        first_filename = matching_docs[0]["filename"]
    else:
        first_uploader = None
        first_filename = filename

    # ✅ Step 3 — If claimed owner is not the first uploader, reject immediately
    if first_uploader and claimed_owner_id != first_uploader:
        return {
            "owner_id": claimed_owner_id,
            "correlation": 0.0,
            "ownership_confirmed": False,
            "reason": f"Original owner is {first_uploader}. This file was uploaded first by them."
        }

    # ✅ Step 4 — Download the FIRST uploader's watermarked file from GCS
    client = gcs_storage.Client.from_service_account_json(
        os.getenv("Service_Account_Key")
    )
    bucket = client.bucket(os.getenv("STORAGE_BUCKET"))
    blob = bucket.blob(first_filename)

    file_location = f"temp/verify_{first_filename}"
    blob.download_to_filename(file_location)

    try:
        result = extract_watermark(file_location, claimed_owner_id)
        print(f"DEBUG first_uploader: {first_uploader}")
        print(f"DEBUG claimed_owner_id: {claimed_owner_id}")
        print(f"DEBUG correlation: {result['correlation']}")

        # ✅ Add reason to response
        result["reason"] = "Watermark matches original owner" if result["ownership_confirmed"] else "Watermark does not match"
        return result
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)