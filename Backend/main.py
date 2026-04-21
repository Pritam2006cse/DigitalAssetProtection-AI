from fastapi import FastAPI,File,UploadFile
from storage import upload_to_gcs
from embedding import get_image_embedding
from db import save_content
from db import db
from matcher import find_matches
import os
os.makedirs("temp", exist_ok=True)

import shutil
app = FastAPI()
@app.get("/")
def read_root():
    return {"message": "DigitalAssetProtection AI running"}
@app.post("/upload")
def upload_file(file:UploadFile=File(...)):
    file_location = f"temp/{file.filename}"

    with open(file_location,"wb") as buffer:
        shutil.copyfileobj(file.file,buffer)
    
    url = upload_to_gcs(file_location, file.filename)
    dna_vector = get_image_embedding(file_location)
    #dna_vector = [0.1] * 128
    matches = find_matches(dna_vector)
    parent_id = None
    if matches:
        parent_id = matches[0]["file"]
    data = {
            "filename": file.filename,
            "url": url,
            "embedding": list(dna_vector),
            "derived_from": parent_id
            }
    save_content(data)
    return {"message": "Asset Protected",
            "url": url,
            "dna_length": len(dna_vector),
            "matches": matches,
            "status": "Success"}
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