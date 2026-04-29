from google.cloud import firestore
import os
from dotenv import load_dotenv
load_dotenv()

if os.getenv("GOOGLE_CREDENTIALS_JSON"):
    import json
    from google.oauth2 import service_account
    creds_dict = json.loads(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    credentials = service_account.Credentials.from_service_account_info(creds_dict)
    db = firestore.Client(credentials=credentials, database="digitalassetdb", project="digitalassetprotectionai")
elif os.getenv("Service_Account_Key"):
    db = firestore.Client.from_service_account_json(os.getenv("Service_Account_Key"), database="digitalassetdb")
else:
    db = firestore.Client(database="digitalassetdb")  # ← Cloud Run built-in

def save_content(data):
    doc_ref = db.collection("contents").add(data)
    return doc_ref[1].id