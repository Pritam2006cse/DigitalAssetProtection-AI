from google.cloud import storage
client = storage.Client.from_service_account_json("digitalassetprotectionai-cfecbc992a5d.json")
def upload_to_gcs(file_path,filename):
    bucket = client.bucket("digitalasset-bucket")
    blob = bucket.blob(filename)
    blob.upload_from_filename(file_path)

    return blob.public_url