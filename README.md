# DigitalAsset Protection AI

AI-Powered Content Guardian for protecting digital assets (images, videos, documents) against unauthorized use through watermarking and similarity matching.

---

## Overview

DigitalAsset Protection AI is a full-stack web application that:

- **Uploads & embeds watermarks** into digital content using AI-powered embedding
- **Detects unauthorized use** by matching new uploads against a database of protected assets
- **Alerts owners** when potential matches are found
- **Provides a dashboard** for managing uploads, results, and alerts

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Backend | FastAPI (Python) |
| Database | Google Cloud Firestore |
| Storage | Google Cloud Storage |
| AI Embedding | Google Vertex AI (MultiModal) |
| Auth | JWT (Python `jose`) |
| Frontend | Vanilla HTML/CSS/JS |

---

## Project Structure

```
DigitalAssetProtectionAI/
├── Backend/
│   ├── main.py              # FastAPI app & endpoints
│   ├── auth.py              # JWT authentication
│   ├── db.py                # Firestore client
│   ├── storage.py           # GCS upload utilities
│   ├── embedding.py         # Vertex AI embedding functions
│   ├── matcher.py           # Cosine similarity matching
│   ├── email_service.py     # Email notifications
│   ├── gemini.py            # Gemini AI integration
│   ├── clearDb.py           # Database cleanup utility
│   └── temp/                # Temporary file storage
│
├── frontend/
│   ├── index.html           # Login/Register page
│   ├── pages/
│   │   ├── upload.html      # Upload dashboard
│   │   ├── results.html     # Match results
│   │   ├── alerts.html      # Alert notifications
│   │   └── graph.html       # Similarity graph
│   ├── css/                 # Stylesheets
│   ├── js/                  # Client-side logic
│   └── credentials.sample.json
│
└── README.md
```

---

## Prerequisites

- Python 3.9+
- Google Cloud Platform account
- Firebase project with Firestore enabled
- Google Cloud Storage bucket

---

## Configuration

### 1. Environment Variables

Create a `.env` file in the `Backend/` folder:

```env
SECRET_KEY=your-jwt-secret-key
Service_Account_Key=path/to/your-service-account.json
```

### 2. Google Cloud Credentials

Place your service account JSON key in `Backend/digitalassetprotectionai-cfecbc992a5d.json` (or update the path in `embedding.py`).

### 3. Firebase Config

Update `db.py` with your Firebase project configuration.

---

## Running the Application

### Backend

```bash
cd Backend
uvicorn main:app --reload
# Runs at http://localhost:8000
```

### Frontend

Open `frontend/index.html` directly in a browser, **or** serve it:

```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```
 or run start index.html
---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/register` | Register new user |
| `POST` | `/token` | Login & get JWT |
| `POST` | `/upload` | Upload & embed watermark |
| `GET` | `/contents` | List user's contents |
| `GET` | `/matches/{content_id}` | Get matches for content |

---

## Features

### 🔐 Authentication
- JWT-based session management
- Register/Login with email

### 📤 Upload & Embed
- Supports images, videos, documents
- AI-generated watermark embeddings via Vertex AI

### 🔍 Similarity Matching
- Cosine similarity against stored embeddings
- Configurable thresholds per file type

### 📧 Notifications
- Email alerts when matches are found

### 📊 Dashboard
- Upload interface
- Match results view
- Alert history
- Similarity graph visualization
- Sending Takedown Notice
---
