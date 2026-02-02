"""
Database schema for metrics.
Supports multiple sensors: THS No. 1, THS No. 2, THS No. 3
THS = Temperature and Humidity Sensor
"""

# SQL to create the metrics table
CREATE_METRICS_TABLE = """
    CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        sensor_id TEXT NOT NULL,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        UNIQUE(timestamp, sensor_id)
    )
"""

# Index for faster queries on timestamp and sensor_id
CREATE_TIMESTAMP_INDEX = """
    CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)
"""

CREATE_SENSOR_INDEX = """
    CREATE INDEX IF NOT EXISTS idx_metrics_sensor ON metrics(sensor_id)
"""
