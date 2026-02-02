# Real-time Dashboard Template

A minimal, clean, production-ready template for real-time data dashboards. Designed for fast prototyping and easy extension.

## Philosophy

This project is a **foundation**, not a demo toy. It follows these principles:

- **Minimal codebase** - ~500 lines total across backend and frontend
- **Clear structure** - Easy for new developers to understand and extend
- **No over-engineering** - Single responsibility per component, no unnecessary abstractions
- **Pragmatic** - Polling is simpler than WebSockets for small dashboards
- **Self-contained** - No Docker, no deployment complexity, just Python + Node

## Architecture

```
Browser                    Backend                  Database
   │                         │                         │
   ├─→ GET /api/metrics ────→ │                        │
   │                          ├─→ Query last 60min ───→│
   │                          │                        │
   │   ← JSON response ←──────┤ ← [temp, humidity] ←───┤
   │                          │
   └─ Repeat every 1 second ──┘
```

**Key design decisions:**

1. **Polling on client** - Frontend controls update frequency, backend stays stateless
2. **1-second poll interval** - Fast enough for dashboards, light enough for servers
3. **60-minute window** - Balance between data history and payload size
4. **SQLite** - Perfect for single-server deployments, no setup needed
5. **No state management lib** - React hooks are sufficient for this use case

## Project Structure

```
.
├── backend/                 # FastAPI + SQLite
│   ├── main.py             # API server (30 lines)
│   ├── db.py               # Database helpers
│   ├── models.py           # Schema definition
│   ├── init_db.py          # Populate database
│   └── requirements.txt
│
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── App.jsx         # Main component
│   │   ├── api.js          # Polling logic
│   │   ├── main.jsx
│   │   ├── index.css
│   │   └── components/
│   │       └── RealtimeChart.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md (this file)
```

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- (Optional) `make` command

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database with 4 hours of mock data
python init_db.py

# Start the API server
python main.py
```

Server runs at `http://localhost:8000`

**API endpoints:**
- `GET /api/metrics` - Returns last 60 minutes of data
- `GET /health` - Health check

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173 in your browser

You should see two charts:
1. **Temperature** (red line) - Last 60 minutes
2. **Humidity** (blue line) - Last 60 minutes

A timer shows "Last updated: X seconds ago" and updates every second.

## How It Works

### 1. Data Flow

```javascript
// Frontend: poll every 1 second
setInterval(async () => {
  const data = await fetch('/api/metrics')
  setMetrics(data)
}, 1000)
```

```python
# Backend: return last 60 minutes
@app.get('/api/metrics')
def get_metrics():
    data = db.query('SELECT * FROM metrics WHERE timestamp > ?', cutoff)
    return {'data': data}
```

### 2. Database Schema

```sql
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY,
    timestamp INTEGER NOT NULL UNIQUE,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL
)
```

- **timestamp** - Unix seconds, allows efficient time range queries
- **temperature** - Float in °C, range 16-26
- **humidity** - Float in %, range 40-70

### 3. Mock Data Generation

`init_db.py` populates 4 hours (14,400 seconds) of data:

```python
# Smooth oscillation using sine wave + small noise
temperature = 21 + 5 * sin(time) + small_random_noise
```

This creates **realistic fluctuations**, not random spikes.

### 4. Frontend Polling

The `useEffect` hook manages polling:

```javascript
useEffect(() => {
  // Poll immediately
  fetchMetrics()

  // Poll every 1 second
  const interval = setInterval(fetchMetrics, 1000)

  // Cleanup on unmount (stop polling)
  return () => clearInterval(interval)
}, [])
```

**Important:** Polling stops automatically when you leave the page. This is efficient and requires NO server-side changes.

## Extending This Template

### Add a New Metric

**1. Update database schema** (`backend/models.py`):
```python
CREATE_METRICS_TABLE = """
    CREATE TABLE IF NOT EXISTS metrics (
        ...
        pressure REAL NOT NULL  # New column
    )
"""
```

**2. Update mock data** (`backend/init_db.py`):
```python
pressure = 1013 + 2 * sin(time)
cursor.execute(..., (timestamp, temperature, humidity, pressure))
```

**3. Update frontend component** (`frontend/src/App.jsx`):
```jsx
<RealtimeChart
  data={metrics}
  dataKey="pressure"
  title="Pressure"
  color="#00cc00"
  unit="hPa"
/>
```

### Customize Poll Interval

Change the polling frequency in `frontend/src/App.jsx`:

```javascript
// Currently 1000ms, change to e.g. 5000ms for 5-second updates
const pollInterval = setInterval(fetchMetrics, 5000)
```

### Add Different Data Ranges

Backend already supports this. In `backend/main.py`:

```python
@app.get("/api/metrics")
def get_metrics(minutes: int = 60):  # Add query parameter
    return {"data": db.get_metrics_last_n_minutes(minutes)}
```

Then fetch from frontend: `fetch('/api/metrics?minutes=120')`

### Deploy to Production

**Backend:**
```bash
# Use gunicorn for production
pip install gunicorn
gunicorn main:app --workers 4 --bind 0.0.0.0:8000
```

**Frontend:**
```bash
npm run build
# Serve dist/ folder with any static server
npx serve dist
```

**Database:**
- Replace SQLite with PostgreSQL/MySQL for multi-server setups
- Only change: update connection string in `backend/db.py`

### Add Authentication

If needed, add a simple token check:

```python
@app.get("/api/metrics")
def get_metrics(token: str = Header(None)):
    if token != os.environ.get("API_TOKEN"):
        raise HTTPException(status_code=401)
    return {"data": get_metrics_from_db()}
```

### Add More Charts

Create a new chart component (copy `RealtimeChart.jsx`):
```jsx
function WindSpeedChart({ data }) {
  return <RealtimeChart data={data} dataKey="windSpeed" ... />
}
```

## Why Polling, Not WebSockets?

| Feature | Polling | WebSockets |
|---------|---------|-----------|
| Implementation | Simple (fetch loop) | Complex (library needed) |
| Server load | Predictable (1 req/sec) | Variable |
| Network use | Slightly higher | Slightly lower |
| Works everywhere | ✓ | ✗ (blocked by some proxies) |
| Scaling | Easy | Requires sticky sessions |
| Latency | 500ms average | 50ms average |

**For dashboards updating every 1 second, polling is ideal.** When you need sub-100ms updates, use WebSockets.

## Common Issues

### "Cannot connect to http://localhost:8000"

Backend not running. In `backend/`, run:
```bash
source venv/bin/activate
python main.py
```

### "CORS error" or "Access blocked"

Frontend is trying to call backend on different port. Ensure:
- Backend runs on `localhost:8000`
- Frontend runs on `localhost:5173`
- Backend enables CORS (`main.py` already does this)

### No data in charts

Database is empty. Run the init script:
```bash
cd backend
python init_db.py
```

### Charts show old data only

Backend is returning stale data. Check `db.get_metrics_last_n_minutes()` is querying the right time range.

## File Descriptions

| File | Lines | Purpose |
|------|-------|---------|
| `backend/main.py` | 32 | FastAPI app with single endpoint |
| `backend/db.py` | 60 | Database connection and queries |
| `backend/models.py` | 18 | SQL schema |
| `backend/init_db.py` | 95 | Populate database |
| `frontend/src/App.jsx` | 90 | Main React component, polling logic |
| `frontend/src/components/RealtimeChart.jsx` | 45 | Recharts wrapper |
| `frontend/src/api.js` | 50 | API helper functions |
| **Total** | **~390** | **Complete system** |

## Performance Notes

- **Backend**: FastAPI handles 100+ requests per second easily
- **Frontend**: Re-rendering every 1 second is negligible in React 18+
- **Database**: SQLite can handle millions of rows; index on timestamp helps
- **Network**: Each request is ~2-5KB, ~200-500 bytes per metric point

For production dashboards with 1000+ users, consider:
- Aggregating old data (1-minute averages after 24 hours)
- Using Redis to cache the last query result
- Distributing across multiple backend instances with a load balancer

## License

MIT - Use freely for any project.

## Next Steps

1. **Try it:** Start backend and frontend, watch the charts update
2. **Modify mock data:** Change temperature range, humidity fluctuation
3. **Add another metric:** Pressure, CO2, anything else
4. **Deploy:** Follow "Deploy to Production" section
5. **Scale:** When polling becomes a bottleneck, optimize query or switch to WebSockets

---

**Questions?** This template is designed to be self-explanatory. Read the code - it's only 400 lines, all with clear comments explaining the "why" not just the "what".
