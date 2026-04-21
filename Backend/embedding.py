import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel, Image
from google.oauth2 import service_account

# Path to your JSON key file
SERVICE_ACCOUNT_KEY = "digitalassetprotectionai-cfecbc992a5d.json"

# Load credentials explicitly for Vertex AI
credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_KEY)

# Initialize Vertex AI with the project, location, and credentials
vertexai.init(
    project="digitalassetprotectionai", 
    location="us-central1", 
    credentials=credentials
)

def get_image_embedding(image_path):
    # Model remains the same
    model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    
    image = Image(image_bytes=image_bytes)
    embeddings = model.get_embeddings(image=image)
    
    return embeddings.image_embedding