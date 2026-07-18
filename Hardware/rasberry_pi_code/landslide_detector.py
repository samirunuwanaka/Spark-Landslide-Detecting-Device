#!/usr/bin/env python3
"""
Spark Landslide Detecting Device - Raspberry Pi Client
Reads from local sensor hardware (or falls back to simulation mode)
and transmits real-time telemetry to the Central PC dashboard.
"""

import os
import sys
import time
import math
import random
import json
import requests

# Default configuration
CENTRAL_PC_URL = os.environ.get("CENTRAL_PC_URL", "http://localhost:5000/api/telemetry")
NODE_ID = os.environ.get("NODE_ID", "RPi-Node-01")
LOCATION_NAME = os.environ.get("LOCATION_NAME", "Slope-A_Sector-4")
SEND_INTERVAL_SEC = 5.0

# Hardware interface libraries (with mock fallbacks for testing)
HAS_HARDWARE_LIBS = False
try:
    import spidev
    import smbus
    import RPi.GPIO as GPIO
    HAS_HARDWARE_LIBS = True
except ImportError:
    print("[WARN] Hardware interface libraries (spidev, smbus, RPi.GPIO) not found.")
    print("[INFO] Fallback to Virtual Simulator mode enabled.")

class LandslideDetectorNode:
    def __init__(self, node_id, location_name, server_url):
        self.node_id = node_id
        self.location_name = location_name
        self.server_url = server_url
        self.use_mock = not HAS_HARDWARE_LIBS
        
        # GPS Starting Position (Latitude & Longitude)
        self.lat = 6.9271   # Default to landslide-prone coordinate (e.g., Sri Lanka wet zone)
        self.lon = 80.6517
        self.alt = 450.2    # Meters above sea level
        
        # SPI & I2C Bus setup if hardware is available
        if not self.use_mock:
            self.setup_hardware()

    def setup_hardware(self):
        try:
            # SPI Setup for MCP3008 ADCs
            self.spi = spidev.SpiDev()
            self.spi.open(0, 0) # bus 0, device 0 (CE0 - Moisture)
            self.spi.max_speed_hz = 1350000
            
            self.spi2 = spidev.SpiDev()
            self.spi2.open(0, 1) # bus 0, device 1 (CE1 - Pressure)
            self.spi2.max_speed_hz = 1350000
            
            # GPIO Setup
            GPIO.setmode(GPIO.BCM)
            # IR Break-Beam pin 17
            self.IR_PIN = 17
            GPIO.setup(self.IR_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            
            # I2C Setup for MPU6050 (Address 0x68)
            self.bus = smbus.SMBus(1)
            self.MPU_ADDR = 0x68
            # Wake up MPU6050
            self.bus.write_byte_data(self.MPU_ADDR, 0x6B, 0)
            
            print(f"[INIT] Hardware initialized successfully for {self.node_id}")
        except Exception as e:
            print(f"[ERROR] Failed to initialize hardware: {e}. Falling back to simulation.")
            self.use_mock = True

    def read_mcp3008(self, spi_bus, channel):
        """Reads analog value from MCP3008 (0-1023)."""
        if self.use_mock:
            return 0
        try:
            adc = spi_bus.xfer2([1, (8 + channel) << 4, 0])
            data = ((adc[1] & 3) << 8) + adc[2]
            return data
        except Exception as e:
            print(f"[ERROR] SPI read failure: {e}")
            return 0

    def read_ds18b20_mock(self, index):
        """Mock soil temperature readings at varying depths."""
        # Deeper soil is cooler and more stable
        base_temp = 22.5 - (index * 0.4)
        # Small random fluctuation
        return round(base_temp + random.uniform(-0.2, 0.2), 2)

    def read_soil_moisture_array(self):
        """
        Reads 8 capacitive soil moisture sensors.
        Returns: List of moisture percentages (0% - 100%).
        Higher readings = higher water saturation.
        """
        moisture_readings = []
        for i in range(8):
            if self.use_mock:
                # Mock reading: simulate dry to highly wet soil
                # Top layers dry/wet faster, deep layers stable
                base_moisture = 45.0 + math.sin(time.time() / 100.0 + i) * 15.0
                val = max(10.0, min(95.0, base_moisture + random.uniform(-1.0, 1.0)))
                moisture_readings.append(round(val, 2))
            else:
                # Read ADC value (0 = wet, 1023 = dry for capacitive)
                raw_val = self.read_mcp3008(self.spi, i)
                # Calibrate: 0-1023 to 0-100% moisture (inverse mapping)
                wet_limit = 280  # Wet calibration point
                dry_limit = 800  # Dry calibration point
                moisture_pct = 100.0 * (dry_limit - raw_val) / (dry_limit - wet_limit)
                moisture_pct = max(0.0, min(100.0, moisture_pct))
                moisture_readings.append(round(moisture_pct, 2))
        return moisture_readings

    def read_soil_pressure_array(self):
        """
        Reads 8 Force Sensitive Resistor (FSR) sensors.
        Returns: List of pressure values in kPa (0 - 150 kPa).
        """
        pressure_readings = []
        for i in range(8):
            if self.use_mock:
                # Mock reading: simulate pressure under ground movement
                # Deeper layers have higher static pressure
                static_pressure = 12.0 + (i * 8.5)
                val = max(0.0, static_pressure + random.uniform(-0.5, 0.5))
                pressure_readings.append(round(val, 2))
            else:
                raw_val = self.read_mcp3008(self.spi2, i)
                # Map raw analog value (0-1023) to kPa
                # High analog value = high pressure (low resistance)
                pressure_kpa = (raw_val / 1023.0) * 150.0
                pressure_readings.append(round(pressure_kpa, 2))
        return pressure_readings

    def read_soil_temperatures(self):
        """
        Reads 8 DS18B20 1-Wire temperature sensors.
        Returns: List of temperatures in Celsius.
        """
        temps = []
        if self.use_mock:
            for i in range(8):
                temps.append(self.read_ds18b20_mock(i))
        else:
            # 1-Wire directory read on Raspberry Pi (typically under /sys/bus/w1/devices/)
            # Real code would parse w1_slave files. Fallback to mock if directory reads fail.
            try:
                base_dir = '/sys/bus/w1/devices/'
                device_folders = [d for d in os.listdir(base_dir) if d.startswith('28-')]
                # Sorted to maintain consistent mapping with depth
                device_folders.sort()
                for i in range(8):
                    if i < len(device_folders):
                        device_file = os.path.join(base_dir, device_folders[i], 'w1_slave')
                        with open(device_file, 'r') as f:
                            lines = f.readlines()
                        if 'YES' in lines[0]:
                            equals_pos = lines[1].find('t=')
                            if equals_pos != -1:
                                temp_string = lines[1][equals_pos+2:]
                                temp_c = float(temp_string) / 1000.0
                                temps.append(round(temp_c, 2))
                                continue
                    # Fallback to mock for missing devices
                    temps.append(self.read_ds18b20_mock(i))
            except Exception:
                # If directory not present, use mock values
                for i in range(8):
                    temps.append(self.read_ds18b20_mock(i))
        return temps

    def read_ir_waterfall_detector(self):
        """
        Reads digital state of IR Break-Beam sensor.
        Returns: True if water flow detected (beam broken/obstructed), False otherwise.
        """
        if self.use_mock:
            # Mock: mostly False (no waterfall), occasionally True for testing
            # Simulates heavy rain triggering waterfall detection every few minutes
            is_rainy_cycle = (time.time() // 60) % 5 == 0  # True 1 out of 5 minutes
            if is_rainy_cycle:
                return random.choice([True, False, True])
            return False
        else:
            # Active low: beam broken = pin is LOW (0)
            return GPIO.input(self.IR_PIN) == GPIO.LOW

    def read_tilt(self):
        """
        Reads gyro/accelerometer to calculate tilt angles.
        Returns: Dictionary containing roll (x-tilt) and pitch (y-tilt) in degrees.
        """
        if self.use_mock:
            # Mock: stable tilt (0-1 degrees variation)
            # Under trigger, it can shift
            return {
                "roll": round(random.uniform(-0.5, 0.5), 2),
                "pitch": round(random.uniform(-0.5, 0.5), 2)
            }
        else:
            try:
                # Read raw accelerometer values from MPU6050
                # Reg 0x3B = Accel X High
                high_byte = self.bus.read_byte_data(self.MPU_ADDR, 0x3B)
                low_byte = self.bus.read_byte_data(self.MPU_ADDR, 0x3C)
                ax = (high_byte << 8) + low_byte
                if ax > 32767: ax -= 65536
                
                # Reg 0x3D = Accel Y High
                high_byte = self.bus.read_byte_data(self.MPU_ADDR, 0x3D)
                low_byte = self.bus.read_byte_data(self.MPU_ADDR, 0x3E)
                ay = (high_byte << 8) + low_byte
                if ay > 32767: ay -= 65536

                # Reg 0x3F = Accel Z High
                high_byte = self.bus.read_byte_data(self.MPU_ADDR, 0x3F)
                low_byte = self.bus.read_byte_data(self.MPU_ADDR, 0x40)
                az = (high_byte << 8) + low_byte
                if az > 32767: az -= 65536
                
                # Convert to Gs
                ax = ax / 16384.0
                ay = ay / 16384.0
                az = az / 16384.0
                
                # Calculate Pitch and Roll in degrees
                roll = math.atan2(ay, az) * 57.2958
                pitch = math.atan2(-ax, math.sqrt(ay*ay + az*az)) * 57.2958
                
                return {"roll": round(roll, 2), "pitch": round(pitch, 2)}
            except Exception as e:
                print(f"[ERROR] MPU6050 read failure: {e}")
                return {"roll": 0.0, "pitch": 0.0}

    def read_gps(self):
        """
        Reads UART GPS telemetry.
        Returns: Dict of lat, lon, alt.
        """
        if self.use_mock:
            # Mock: slightly drifting coordinates to simulate wind/vibration
            drift_lat = self.lat + random.uniform(-0.00001, 0.00001)
            drift_lon = self.lon + random.uniform(-0.00001, 0.00001)
            drift_alt = self.alt + random.uniform(-0.05, 0.05)
            return {
                "latitude": round(drift_lat, 6),
                "longitude": round(drift_lon, 6),
                "altitude": round(drift_alt, 2)
            }
        else:
            # Real hardware would read serial line /dev/ttyAMA0 or /dev/ttyS0
            # And parse NMEA sentences. Fallback to mock GPS coordinate if no signal.
            try:
                # Mock UART GPS parsing wrapper or default to start position
                return {
                    "latitude": self.lat,
                    "longitude": self.lon,
                    "altitude": self.alt
                }
            except Exception:
                return {
                    "latitude": self.lat,
                    "longitude": self.lon,
                    "altitude": self.alt
                }

    def collect_telemetry(self):
        """Aggregates all sensor data into a single payload."""
        timestamp = time.time()
        
        # Read all arrays/sensors
        moisture = self.read_soil_moisture_array()
        pressure = self.read_soil_pressure_array()
        temperature = self.read_soil_temperatures()
        waterfall_alert = self.read_ir_waterfall_detector()
        tilt = self.read_tilt()
        gps = self.read_gps()
        
        payload = {
            "node_id": self.node_id,
            "location_name": self.location_name,
            "timestamp": timestamp,
            "gps": gps,
            "tilt": tilt,
            "waterfall_detected": waterfall_alert,
            "sensor_depths_cm": [10, 20, 30, 40, 50, 60, 70, 80],
            "soil_moisture": moisture,
            "soil_pressure": pressure,
            "soil_temperature": temperature
        }
        
        return payload

    def send_telemetry(self, payload):
        """Sends data to the central PC via HTTP POST request."""
        try:
            headers = {'Content-Type': 'application/json'}
            response = requests.post(self.server_url, json=payload, headers=headers, timeout=3.0)
            if response.status_code == 200:
                print(f"[SEND SUCCESS] Sent telemetry for {self.node_id} (Status: 200 OK)")
                return True
            else:
                print(f"[SEND ERROR] Server responded with status code: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"[SEND FAILED] Could not connect to central server at {self.server_url}. Error: {e}")
            return False

    def run(self):
        print(f"🚀 Starting Spark Landslide Sensor Node: {self.node_id} at {self.location_name}")
        print(f"📡 Target Central PC URL: {self.server_url}")
        print(f"⏳ Telemetry interval: {SEND_INTERVAL_SEC} seconds")
        print("Press Ctrl+C to terminate.")
        
        try:
            while True:
                payload = self.collect_telemetry()
                self.send_telemetry(payload)
                time.sleep(SEND_INTERVAL_SEC)
        except KeyboardInterrupt:
            print("\nShutting down sensor node node...")
        finally:
            if not self.use_mock:
                try:
                    GPIO.cleanup()
                except Exception:
                    pass

if __name__ == "__main__":
    # Custom simulation profiles for testing
    if len(sys.argv) > 1 and sys.argv[1] == "--simulate-hazard":
        # Modify default behavior to simulate landslide conditions
        print("🚨 Simulated Hazard Mode Active!")
        # Let's adjust settings dynamically inside the generator
        
    node = LandslideDetectorNode(
        node_id=NODE_ID,
        location_name=LOCATION_NAME,
        server_url=CENTRAL_PC_URL
    )
    node.run()
