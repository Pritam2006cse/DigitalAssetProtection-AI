from google.cloud import firestore
import os
from dotenv import load_dotenv
load_dotenv()

db = firestore.Client.from_service_account_json(os.getenv("Service_Account_Key"),database = "digitalassetdb")

def save_content(data):
    doc_ref = db.collection("contents").add(data)
    return doc_ref[1].id