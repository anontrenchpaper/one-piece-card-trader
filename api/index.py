from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Minimal backend is working"}

@app.get("/api/test")
@app.get("/test")
def test_endpoint():
    return {"message": "Hello from Vercel Serverless Function!"}
