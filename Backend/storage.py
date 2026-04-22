from google.cloud import storage
import os
from dotenv import load_dotenv
load_dotenv()
client = storage.Client.from_service_account_json(os.getenv("Service_Account_Key"))
def upload_to_gcs(file_path,filename):
    bucket = client.bucket(os.getenv("STORAGE_BUCKET"))
    blob = bucket.blob(filename)
    blob.upload_from_filename(file_path)

    return blob.public_url