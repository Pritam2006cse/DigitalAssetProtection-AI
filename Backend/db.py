from google.cloud import firestore

db = firestore.Client.from_service_account_json("digitalassetprotectionai-cfecbc992a5d.json",database = "digitalassetdb")

def save_content(data):
    doc_ref = db.collection("contents").add(data)
    return doc_ref[1].id