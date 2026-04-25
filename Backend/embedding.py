import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel, Image
from vertexai.language_models import TextEmbeddingModel
from google.oauth2 import service_account
import cv2
import fitz
from docx import Document
import os
from PIL import Image as PILImage
import numpy as np
from dotenv import load_dotenv
load_dotenv()

# Path to your JSON key file
SERVICE_ACCOUNT_KEY = os.getenv("Service_Account_Key")
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

def get_video_embedding(video_path):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    interval = int(fps * 3)
    if interval == 0:
        interval = 1
    frame_embeddings = []
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % interval == 0:
            temp_frame_path = f"temp/frame_{frame_count}.jpg"
            cv2.imwrite(temp_frame_path, frame)
            try:
                frame_embeddings.append(get_image_embedding(temp_frame_path))
            finally:
                if os.path.exists(temp_frame_path):
                    os.remove(temp_frame_path)
        frame_count+=1
    cap.release()
    if not frame_embeddings:
        raise ValueError("No frames could be extracted from video")

    return list(np.mean(frame_embeddings, axis=0))


def get_document_embedding(file_path):
    ext = file_path.split(".")[-1].lower()
    text = ""
    if ext == "pdf":
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text()
        doc.close()
    elif ext in ["docx", "doc"]:
        doc = Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif ext == "txt":
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    if not text.strip():
        raise ValueError("No text could be extracted from document")
    # Trim to 3000 chars — Vertex AI has input limits
    text = text[:3000]
    model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    embeddings = model.get_embeddings([text])
    return embeddings[0].values


def get_embedding(file_path: str):
    ext = file_path.split(".")[-1].lower()
    if ext in ["jpg", "jpeg", "png", "webp", "gif"]:
        return get_image_embedding(file_path),"image"
    elif ext in ["mp4", "mov", "avi", "mkv", "webm"]:
        return get_video_embedding(file_path),"video"
    elif ext in ["pdf", "docx", "doc", "txt"]:
        return get_document_embedding(file_path),"document"
    else:
        raise ValueError(f"Unsupported file type: .{ext}")
    

def embed_watermark(image_path,owner_id):
    img = PILImage.open(image_path).convert("RGB")
    img_array = np.array(img,dtype=np.float32)
    seed = sum(ord(c) for c in owner_id)
    np.random.seed(seed)
    watermark = np.random.normal(0,8,img_array.shape)
    watermarked = np.clip(img_array+watermark,0,255).astype(np.uint8)
    watermarked_img = PILImage.fromarray(watermarked)
    png_path = image_path.rsplit(".", 1)[0] + "_wm.png"
    watermarked_img.save(png_path,format="PNG")
    return png_path


def extract_watermark(image_path,claimer_owner_id):
    img = PILImage.open(image_path).convert("RGB")
    img_array = np.array(img,dtype=np.float32)
    seed = sum(ord(c) for c in claimer_owner_id)
    np.random.seed(seed)
    expected_watermark = np.random.normal(0,8,img_array.shape)
    correlation_matrix = np.corrcoef(img_array.flatten(),expected_watermark.flatten())
    r = correlation_matrix[0][1]
    return {"owner_id":claimer_owner_id,"correlation":float(r),"ownership_confirmed":bool(r>0.01)}