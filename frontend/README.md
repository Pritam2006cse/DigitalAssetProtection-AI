# Frontend — DigitalAsset Protection AI

This folder contains the complete static frontend for the DigitalAsset Protection AI dashboard.
No build tools required — pure HTML, CSS, and JavaScript.

---

## Folder Structure

```
frontend/
├── index.html                  ← Login page (entry point)
├── credentials.sample.json     ← Sample credentials file for testing
├── pages/
│   ├── upload.html             ← Upload dashboard (after login)
│   └── results.html            ← Match results dashboard
├── css/
│   ├── global.css              ← Shared styles (topbar, tokens, badges)
│   ├── login.css               ← Login page styles
│   ├── dashboard.css           ← Upload page styles
│   └── results.css             ← Results page styles
└── js/
    ├── auth.js                 ← Session management, login logic, logout
    ├── upload.js               ← File handling, API call to POST /upload
    ├── results.js              ← Renders match cards from API response
    └── bg-effect.js            ← Animated canvas background (login page)
```

---

## How to Use

### 1. Add CORS to your FastAPI backend

Open `Backend/main.py` and add these lines right after `app = FastAPI()`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Run the backend

```bash
cd Backend
uvicorn main:app --reload
# Runs at http://localhost:8000
```

### 3. Open the frontend

Open `frontend/index.html` directly in a browser,
**or** serve it with a simple HTTP server to avoid CORS issues:

```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

### 4. Prepare your credentials JSON

Create a `.json` file with user records:

```json
[
  { "name": "Your Name", "email": "you@example.com" }
]
```

Upload this file on the login page to authenticate.

---

## Page Flow

```
index.html (Login)
    ↓  name + email validated against uploaded JSON
pages/upload.html (Upload Dashboard)
    ↓  POST /upload  →  FastAPI returns { url, matches, dna_length, status }
pages/results.html (Match Results)
    Shows each match with filename, URL, and similarity %
```

---

## API Contract

The frontend calls `POST {API_BASE_URL}/upload` with `multipart/form-data`:

| Field | Type   | Description        |
|-------|--------|--------------------|
| file  | File   | The image to scan  |

Expected response shape:

```json
{
  "message": "Asset Protected",
  "url": "https://storage.googleapis.com/...",
  "dna_length": 128,
  "matches": [
    { "file": "original.jpg", "score": 0.97, "url": "https://..." },
    { "file": "copy.png",     "score": 0.61, "url": "https://..." }
  ],
  "status": "Success"
}
```

The `score` field is expected as a **0–1 float** (e.g. `0.97` = 97%).
If your `find_matches()` returns 0–100 integers, the frontend handles that too.

---

## Pushing to GitHub

From the repo root:

```bash
git add frontend/
git commit -m "Add frontend dashboard (login, upload, results)"
git push origin main
```
