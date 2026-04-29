from google.cloud import storage
import os
from dotenv import load_dotenv
load_dotenv()

# ✅ No JSON file needed on Cloud Run — uses built-in credentials
if os.getenv("GOOGLE_CREDENTIALS_JSON"):
    import json
    from google.oauth2 import service_account
    creds_dict = json.loads(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    credentials = service_account.Credentials.from_service_account_info(creds_dict)
    client = storage.Client(credentials=credentials, project="digitalassetprotectionai")
elif os.getenv("Service_Account_Key"):
    client = storage.Client.from_service_account_json(os.getenv("Service_Account_Key"))
else:
    client = storage.Client()  # ← uses Cloud Run built-in credentials

def upload_to_gcs(file_path, filename):
    bucket = client.bucket(os.getenv("STORAGE_BUCKET", "digitalasset-bucket"))
    blob = bucket.blob(filename)
    blob.upload_from_filename(file_path)
    return blob.public_url