"""
SQLite database connection and query helpers.
Kept minimal - just enough to connect and execute queries.
"""

import sqlite3
import os
from pathlib import Path

# Database file location (in the backend directory)
DB_PATH = Path(__file__).parent / "metrics.db"


def get_db():
    """
    Get a database connection.
    Each call returns a new connection (simple, no connection pooling needed for this use case).
    """
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Allow accessing columns by name
    return conn


def init_db():
    """Initialize database schema if it doesn't exist."""
    from models import CREATE_METRICS_TABLE, CREATE_TIMESTAMP_INDEX, CREATE_SENSOR_INDEX

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(CREATE_METRICS_TABLE)
    cursor.execute(CREATE_TIMESTAMP_INDEX)
    cursor.execute(CREATE_SENSOR_INDEX)
    conn.commit()
    conn.close()


def get_metrics_last_n_minutes(minutes=60):
    """
    Fetch metrics from the last N minutes for all sensors, ordered by timestamp ascending.
    
    Args:
        minutes: How many minutes back to fetch (default 60)
    
    Returns:
        List of dicts with keys: timestamp, sensor_id, temperature, humidity
    """
    import time

    conn = get_db()
    cursor = conn.cursor()

    # Calculate cutoff timestamp (Unix seconds)
    cutoff = int(time.time()) - (minutes * 60)

    cursor.execute(
        """
        SELECT timestamp, sensor_id, temperature, humidity
        FROM metrics
        WHERE timestamp > ?
        ORDER BY sensor_id, timestamp ASC
        """,
        (cutoff,),
    )

    rows = cursor.fetchall()
    conn.close()

    # Convert sqlite3.Row objects to plain dicts
    return [dict(row) for row in rows]
