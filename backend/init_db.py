"""
Initialize database with 4 hours of mock metric data for 3 sensors.
Run this once to populate the database:
    python init_db.py

Generates realistic sensor data using random walk:
- Three sensors: THS No. 1, THS No. 2, THS No. 3 (Temperature and Humidity Sensors)
- One data point per second per sensor
- Temperature: 16°C - 26°C, random walk (±0.1 per second)
- Humidity: 40% - 70%, random walk (±0.1 per second)
- Each sensor starts with different initial values for variety
"""

import time
import random
from datetime import datetime, timedelta
from db import get_db, init_db

# Number of data points to generate (4 hours = 14,400 seconds)
HOURS = 4
DATA_POINTS = HOURS * 3600

# Sensor list: THS = Temperature and Humidity Sensor
SENSORS = ["THS No. 1", "THS No. 2", "THS No. 3"]

# Temperature range (Celsius)
TEMP_MIN = 16.0
TEMP_MAX = 26.0

# Humidity range (percentage)
HUMIDITY_MIN = 40.0
HUMIDITY_MAX = 70.0

# Initial values for each sensor (starting points for random walk)
INITIAL_VALUES = {
    "THS No. 1": {"temp": 21.0, "humidity": 55.0},
    "THS No. 2": {"temp": 22.0, "humidity": 58.0},
    "THS No. 3": {"temp": 20.5, "humidity": 52.0},
}


def generate_random_walk_value(sensor_id, metric_type, current_value):
    """
    Generate next value using random walk (current ± 0.1), keeping within bounds.
    
    Args:
        sensor_id: The sensor identifier
        metric_type: Either 'temp' or 'humidity'
        current_value: The current/last value
    
    Returns:
        New value with random walk applied and bounded
    """
    # Random walk: ±0.1 with small chance to stay same
    change = random.choice([-0.1, -0.05, 0, 0.05, 0.1])
    new_value = current_value + change
    
    # Keep within bounds
    if metric_type == "temp":
        new_value = max(TEMP_MIN, min(TEMP_MAX, new_value))
    else:  # humidity
        new_value = max(HUMIDITY_MIN, min(HUMIDITY_MAX, new_value))
    
    return new_value


def populate_database():
    """Generate and insert mock data into the database for all sensors using random walk."""
    print(f"Initializing database with {DATA_POINTS * len(SENSORS)} data points ({HOURS} hours × {len(SENSORS)} sensors)...")

    # Initialize schema
    init_db()

    conn = get_db()
    cursor = conn.cursor()

    # Start 4 hours ago
    start_time = int(time.time()) - (HOURS * 3600)

    # Keep track of current values for each sensor (for random walk)
    current_values = {sensor: INITIAL_VALUES[sensor].copy() for sensor in SENSORS}

    # Insert data points for each sensor
    for i in range(DATA_POINTS):
        timestamp = start_time + i
        
        for sensor_id in SENSORS:
            # Generate random walk values for this sensor
            temperature = generate_random_walk_value(
                sensor_id, "temp", current_values[sensor_id]["temp"]
            )
            humidity = generate_random_walk_value(
                sensor_id, "humidity", current_values[sensor_id]["humidity"]
            )
            
            # Store for next iteration
            current_values[sensor_id]["temp"] = temperature
            current_values[sensor_id]["humidity"] = humidity

            try:
                cursor.execute(
                    """
                    INSERT INTO metrics (timestamp, sensor_id, temperature, humidity)
                    VALUES (?, ?, ?, ?)
                    """,
                    (timestamp, sensor_id, temperature, humidity),
                )
            except Exception as e:
                print(f"Error inserting data point {i} for {sensor_id}: {e}")
                conn.rollback()
                conn.close()
                return

    conn.commit()
    conn.close()

    # Show info
    readable_start = datetime.fromtimestamp(start_time).strftime("%Y-%m-%d %H:%M:%S")
    print(f"✓ Database populated!")
    print(f"  Data range: {readable_start} → now")
    print(f"  Sensors: {', '.join(SENSORS)}")
    print(f"  Temperature: {TEMP_MIN}°C - {TEMP_MAX}°C (random walk)")
    print(f"  Humidity: {HUMIDITY_MIN}% - {HUMIDITY_MAX}% (random walk)")
    print(f"  Total records: {DATA_POINTS * len(SENSORS)}")


if __name__ == "__main__":
    populate_database()
