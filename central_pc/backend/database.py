import sqlite3
import os
import json
import time

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "landslide_data.db")

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Telemetry table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        location_name TEXT NOT NULL,
        timestamp REAL NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        alt REAL NOT NULL,
        roll REAL NOT NULL,
        pitch REAL NOT NULL,
        waterfall_detected INTEGER NOT NULL,
        moisture_array TEXT NOT NULL,  -- JSON list of 8 floats
        pressure_array TEXT NOT NULL,  -- JSON list of 8 floats
        temperature_array TEXT NOT NULL, -- JSON list of 8 floats
        calculated_risk_level INTEGER NOT NULL,
        calculated_risk_reason TEXT NOT NULL
    )
    """)
    
    # Node Metadata table to keep track of active nodes and their status
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS active_nodes (
        node_id TEXT PRIMARY KEY,
        location_name TEXT NOT NULL,
        last_seen REAL NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        alt REAL NOT NULL,
        last_risk_level INTEGER NOT NULL
    )
    """)

    # Alerts dispatched history (to residents)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dispatched_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL NOT NULL,
        node_id TEXT NOT NULL,
        location_name TEXT NOT NULL,
        risk_level INTEGER NOT NULL,
        message TEXT NOT NULL,
        sent_to TEXT NOT NULL, -- "SMS Broadcast", "Email Alert", or "Local Alarm"
        delivery_status TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()

def calculate_risk(moisture, pressure, tilt, gps_shift, waterfall_detected):
    """
    Calculates landslide risk index (0 to 3) based on telemetry inputs.
    0 = Safe (Green)
    1 = Elevated Warning (Yellow)
    2 = High Danger (Orange)
    3 = Critical Evacuation (Red)
    """
    # Use average values across 8 depths for general classification
    avg_moisture = sum(moisture) / len(moisture)
    avg_pressure = sum(pressure) / len(pressure)
    max_tilt = max(abs(tilt.get("roll", 0)), abs(tilt.get("pitch", 0)))
    
    reasons = []
    
    # Critical criteria
    if max_tilt >= 15.0 or gps_shift > 0.0001:
        reasons.append(f"Critical land displacement (Tilt: {max_tilt:.1f}°, GPS displacement: {gps_shift:.6f})")
        return 3, " | ".join(reasons)
        
    if avg_moisture >= 85.0 and avg_pressure >= 75.0:
        reasons.append(f"Extreme moisture ({avg_moisture:.1f}%) and pressure ({avg_pressure:.1f} kPa) saturation")
        return 3, " | ".join(reasons)

    # High Danger criteria
    if max_tilt >= 8.0 or (avg_moisture >= 75.0 and avg_pressure >= 50.0):
        if max_tilt >= 8.0:
            reasons.append(f"Significant slope tilt ({max_tilt:.1f}°)")
        else:
            reasons.append(f"High soil moisture ({avg_moisture:.1f}%) and pressure ({avg_pressure:.1f} kPa)")
        return 2, " | ".join(reasons)
        
    # Elevated Warning criteria
    if waterfall_detected:
        reasons.append("Waterfall/flash-flood flow detected by IR sensor")
        return 1, " | ".join(reasons)
        
    if avg_moisture >= 60.0 or avg_pressure >= 30.0 or max_tilt >= 3.0:
        if avg_moisture >= 60.0:
            reasons.append(f"Elevated moisture ({avg_moisture:.1f}%)")
        if avg_pressure >= 30.0:
            reasons.append(f"Elevated soil pressure ({avg_pressure:.1f} kPa)")
        if max_tilt >= 3.0:
            reasons.append(f"Minor tilt movement ({max_tilt:.1f}°)")
        return 1, " | ".join(reasons)
        
    return 0, "All geological parameters normal."

def save_telemetry(data):
    """Saves telemetry payload from RPi node and updates active node metadata."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    node_id = data["node_id"]
    location_name = data["location_name"]
    ts = data.get("timestamp", time.time())
    gps = data["gps"]
    tilt = data["tilt"]
    waterfall = 1 if data["waterfall_detected"] else 0
    moisture = data["soil_moisture"]
    pressure = data["soil_pressure"]
    temp = data["soil_temperature"]
    
    # Calculate GPS displacement from last reading to detect physical shifts
    gps_shift = 0.0
    cursor.execute("SELECT lat, lon FROM active_nodes WHERE node_id = ?", (node_id,))
    last_node = cursor.fetchone()
    if last_node:
        last_lat, last_lon = last_node["lat"], last_node["lon"]
        gps_shift = math.sqrt((gps["latitude"] - last_lat)**2 + (gps["longitude"] - last_lon)**2)
        
    # Determine risk level
    risk_level, risk_reason = calculate_risk(moisture, pressure, tilt, gps_shift, waterfall)
    
    # Write to telemetry history
    cursor.execute("""
    INSERT INTO telemetry (
        node_id, location_name, timestamp, lat, lon, alt, roll, pitch, waterfall_detected,
        moisture_array, pressure_array, temperature_array, calculated_risk_level, calculated_risk_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        node_id, location_name, ts, gps["latitude"], gps["longitude"], gps["altitude"],
        tilt["roll"], tilt["pitch"], waterfall,
        json.dumps(moisture), json.dumps(pressure), json.dumps(temp),
        risk_level, risk_reason
    ))
    
    # Update active_nodes registry
    cursor.execute("""
    INSERT INTO active_nodes (node_id, location_name, last_seen, lat, lon, alt, last_risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET
        location_name = excluded.location_name,
        last_seen = excluded.last_seen,
        lat = excluded.lat,
        lon = excluded.lon,
        alt = excluded.alt,
        last_risk_level = excluded.last_risk_level
    """, (node_id, location_name, ts, gps["latitude"], gps["longitude"], gps["altitude"], risk_level))
    
    conn.commit()
    conn.close()
    
    return risk_level, risk_reason

def get_active_nodes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM active_nodes ORDER BY last_seen DESC")
    nodes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return nodes

def get_telemetry_history(node_id, limit=30):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM telemetry 
        WHERE node_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    """, (node_id, limit))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Unpack JSON fields
    for row in rows:
        row["moisture_array"] = json.loads(row["moisture_array"])
        row["pressure_array"] = json.loads(row["pressure_array"])
        row["temperature_array"] = json.loads(row["temperature_array"])
        row["waterfall_detected"] = bool(row["waterfall_detected"])
    
    # Return chronologically (oldest first for graphing)
    return rows[::-1]

def log_dispatched_alert(node_id, location_name, risk_level, message, sent_to, status="Delivered"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dispatched_alerts (timestamp, node_id, location_name, risk_level, message, sent_to, delivery_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (time.time(), node_id, location_name, risk_level, message, sent_to, status))
    conn.commit()
    conn.close()

def get_dispatched_alerts(limit=50):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dispatched_alerts ORDER BY timestamp DESC LIMIT ?", (limit,))
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts
