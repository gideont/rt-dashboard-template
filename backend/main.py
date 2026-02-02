"""
FastAPI backend for real-time dashboard.
Single endpoint that returns the last 60 minutes of metrics data.
Frontend polls this endpoint every second.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db, get_metrics_last_n_minutes

# Initialize FastAPI app
app = FastAPI(title="Realtime Dashboard Backend")

# Enable CORS so the frontend (running on different port) can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Create database schema if it doesn't exist."""
    init_db()


@app.get("/api/metrics")
def get_metrics():
    """
    Get metrics for the last 60 minutes.
    
    Returns:
        {
            "timestamp": 1706745600,
            "data": [
                {"timestamp": 1706745600, "temperature": 20.5, "humidity": 55.2},
                ...
            ]
        }
    
    Frontend polls this endpoint every 1 second to get fresh data.
    The timestamp field contains the current server time for client display.
    """
    import time
    metrics = get_metrics_last_n_minutes(minutes=60)
    return {
        "timestamp": int(time.time()),
        "data": metrics
    }


@app.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
