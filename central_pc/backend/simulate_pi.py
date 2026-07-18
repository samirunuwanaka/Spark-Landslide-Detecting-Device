import time
import random
import math
import requests
import sys

SERVER_URL = "http://localhost:5000/api/telemetry"

nodes_profile = {
    "RPi-Node-01": {
        "location": "North Slope, Sector 4 (High Risk)",
        "lat": 6.9271,
        "lon": 80.6517,
        "alt": 450.2,
        "base_moisture": 50.0,
        "base_pressure": 15.0,
        "roll": 0.2,
        "pitch": -0.1,
        "waterfall": False,
        "trend": "up" # Moisture/pressure trending up to show landslide hazard
    },
    "RPi-Node-02": {
        "location": "South Valley, Route 6 (Moderate Risk)",
        "lat": 6.9180,
        "lon": 80.6400,
        "alt": 380.5,
        "base_moisture": 62.0,
        "base_pressure": 32.0,
        "roll": 3.1,
        "pitch": 2.4,
        "waterfall": True, # Active waterfall detected
        "trend": "stable"
    },
    "RPi-Node-03": {
        "location": "East Gorge, Sector 9 (Stable)",
        "lat": 6.9350,
        "lon": 80.6650,
        "alt": 520.8,
        "base_moisture": 32.0,
        "base_pressure": 8.0,
        "roll": 0.5,
        "pitch": 0.5,
        "waterfall": False,
        "trend": "stable"
    }
}

def simulate():
    print("🛰️ Starting multi-node simulator...")
    print(f"📡 Sending telemetry updates to: {SERVER_URL}")
    print("Press Ctrl+C to stop simulation.\n")
    
    tick = 0
    try:
        while True:
            tick += 1
            for node_id, profile in nodes_profile.items():
                # Generate trend fluctuations
                if profile["trend"] == "up":
                    # Elevate parameters over time to trigger alert/critical
                    profile["base_moisture"] = min(98.0, profile["base_moisture"] + random.uniform(0.5, 2.5))
                    profile["base_pressure"] = min(120.0, profile["base_pressure"] + random.uniform(1.0, 4.0))
                    if profile["base_moisture"] > 80.0:
                        profile["roll"] += random.uniform(0.5, 1.8)
                        profile["pitch"] -= random.uniform(0.3, 1.2)
                    if tick > 15:
                        profile["waterfall"] = True
                else:
                    # Minor random walk around baseline
                    profile["base_moisture"] = max(10.0, min(95.0, profile["base_moisture"] + random.uniform(-1.0, 1.0)))
                    profile["base_pressure"] = max(0.0, min(150.0, profile["base_pressure"] + random.uniform(-0.5, 0.5)))
                    profile["roll"] += random.uniform(-0.05, 0.05)
                    profile["pitch"] += random.uniform(-0.05, 0.05)
                
                # Build 8-sensor arrays (simulating moisture/pressure decreasing with depth)
                moisture_array = []
                pressure_array = []
                temperature_array = []
                
                for depth in range(8):
                    # Moisture usually varies by depth layer
                    m_val = profile["base_moisture"] * (1.0 - (depth * 0.04)) + random.uniform(-1.0, 1.0)
                    moisture_array.append(round(max(0.0, min(100.0, m_val)), 2))
                    
                    # Pressure increases with depth due to overburden
                    p_val = profile["base_pressure"] + (depth * 6.5) + random.uniform(-0.5, 0.5)
                    pressure_array.append(round(max(0.0, p_val), 2))
                    
                    # Temperature decreases slightly with depth
                    t_val = 24.5 - (depth * 0.3) + random.uniform(-0.1, 0.1)
                    temperature_array.append(round(t_val, 2))
                
                payload = {
                    "node_id": node_id,
                    "location_name": profile["location"],
                    "timestamp": time.time(),
                    "gps": {
                        "latitude": profile["lat"],
                        "longitude": profile["lon"],
                        "altitude": profile["alt"]
                    },
                    "tilt": {
                        "roll": round(profile["roll"], 2),
                        "pitch": round(profile["pitch"], 2)
                    },
                    "waterfall_detected": profile["waterfall"],
                    "soil_moisture": moisture_array,
                    "soil_pressure": pressure_array,
                    "soil_temperature": temperature_array
                }
                
                try:
                    res = requests.post(SERVER_URL, json=payload, timeout=2.0)
                    if res.status_code == 200:
                        risk = res.json().get("risk_level", 0)
                        risk_str = ["SAFE", "WARNING", "ALERT", "CRITICAL"][risk]
                        print(f"[{time.strftime('%H:%M:%S')}] Node {node_id} -> {profile['location']} | Risk: {risk_str} ({risk})")
                    else:
                        print(f"Error sending node {node_id}: {res.status_code}")
                except Exception as e:
                    print(f"Failed to connect to server for {node_id}: {e}")
            
            print("-" * 60)
            time.sleep(4)
            
    except KeyboardInterrupt:
        print("\nSimulator stopped.")

if __name__ == "__main__":
    simulate()
