from db import db
def clear_contents():
    for collection in ["contents", "alerts"]:
        docs = db.collection(collection).stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        print(f"Deleted {count} documents from {collection}")

clear_contents()