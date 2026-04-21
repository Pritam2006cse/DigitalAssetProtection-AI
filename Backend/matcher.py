import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from db import db

def find_matches(dna_vector):
    contents = db.collection("contents").stream()
    matches = []
    new_dna_vector = np.array(dna_vector).reshape(1,-1)
    for doc in contents:
        data = doc.to_dict()
        if "embedding" not in data:
            continue
        existing_dna_vector = np.array(data["embedding"]).reshape(1,-1)
        similarity = cosine_similarity(existing_dna_vector,new_dna_vector)[0][0]
    
        if similarity > 0.85:
            matches.append({
                "file_id": doc.id,
                "owner_id": data.get("owner_id"),
                "similarity": float(similarity),
                "timestamp": str(data.get("timestamp"))
            })
    
    return matches