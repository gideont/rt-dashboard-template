"""
Continuous data generator for real-time dashboard with multiple sensors.
Run this script to keep the database updated with new data points.
It generates one data point per second per sensor indefinitely.

Sensors: THS No. 1, THS No. 2, THS No. 3
THS = Temperature and Humidity Sensor

Usage:
    python continuous_data.py

This will:
- Generate new data points every second for each sensor with random walk
- Insert them into the database with current timestamps
- Automatically clean up data older than 60 minutes
- Run indefinitely until you press Ctrl+C
"""

import time
import random
from db import get_db

# Sensor list
SENSORS = ["THS No. 1", "THS No. 2", "THS No. 3"]

# Temperature range (Celsius)
TEMP_MIN = 16.0
TEMP_MAX = 26.0

# Humidity range (percentage)
HUMIDITY_MIN = 40.0
HUMIDITY_MAX = 70.0

# Store last values for random walk per sensor
LAST_VALUES = {
    "THS No. 1": {"temp": 21.0, "humidity": 55.0},
    "THS No. 2": {"temp": 22.0, "humidity": 58.0},
    "THS No. 3": {"temp": 20.5, "humidity": 52.0},
}


def generate_random_walk_value(sensor_id, metric_type):
    """Generate next value using random walk (last value ± 0.1), keeping within bounds."""
    last_value = LAST_VALUES[sensor_id][metric_type]
    
    # Random walk: ±0.1 with small chance to stay same
    change = random.choice([-0.1, -0.05, 0, 0.05, 0.1])
    new_value = last_value + change
    
    # Keep within bounds
    if metric_type == "temp":
        new_value = max(TEMP_MIN, min(TEMP_MAX, new_value))
    else:  # humidity
        new_value = max(HUMIDITY_MIN, min(HUMIDITY_MAX, new_value))
    
    # Store for next iteration
    LAST_VALUES[sensor_id][metric_type] = new_value
    return new_value


def generate_and_insert_metric(time_index):
    """Generate a single metric for each sensor and insert into database."""
    timestamp = int(time.time())
    
    conn = get_db()
    cursor = conn.cursor()

    try:
        for sensor_id in SENSORS:
            # Generate random walk values for this sensor
            temperature = generate_random_walk_value(sensor_id, "temp")
            humidity = generate_random_walk_value(sensor_id, "humidity")

            cursor.execute(
                """
                INSERT INTO metrics (timestamp, sensor_id, temperature, humidity)
                VALUES (?, ?, ?, ?)
                """,
                (timestamp, sensor_id, temperature, humidity),
            )
        
        conn.commit()
        print(f"[{time.strftime('%H:%M:%S')}] Inserted metrics for 3 sensors")
    except Exception as e:
        if "UNIQUE constraint failed" not in str(e):
            print(f"Error inserting metric: {e}")
    finally:
        conn.close()

    # Also clean up old data (older than 60 minutes) to keep DB size manageable
    clean_old_data()


def clean_old_data(minutes=60):
    """Remove data older than N minutes to keep database size manageable."""
    cutoff = int(time.time()) - (minutes * 60)
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM metrics WHERE timestamp < ?", (cutoff,))
        conn.commit()
        deleted = cursor.rowcount
        if deleted > 0:
            print(f"  → Cleaned up {deleted} old records")
    except Exception as e:
        print(f"Error cleaning old data: {e}")
    finally:
        conn.close()


def run():
    """Main loop: generate a data point every second for all sensors."""
    print("Starting continuous data generator...")
    print("Sensors: THS No. 1, THS No. 2, THS No. 3")
    print("Press Ctrl+C to stop\n")
    
    time_index = 0
    
    try:
        while True:
            generate_and_insert_metric(time_index)
            time_index += 1
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    run()
