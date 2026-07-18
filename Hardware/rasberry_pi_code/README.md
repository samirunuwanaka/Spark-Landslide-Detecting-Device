# 🍓 Raspberry Pi Landslide Monitoring Code

This directory contains the Python client software that runs on each Raspberry Pi edge node deployed on monitoring slopes.

---

## 🛠️ Features

- **Telemetry Aggregation:** Collects real-time telemetry from multiple sensors:
  - 8x Capacitive Soil Moisture sensors (depth-mapped from 10cm to 80cm)
  - 8x FSR Soil Pressure sensors (depth-mapped from 10cm to 80cm)
  - 8x DS18B20 1-Wire Soil Temperature probes (depth-mapped from 10cm to 80cm)
  - 1x IR Break-beam sensor (waterfall and flash flood detector)
  - 1x MPU6050 (tilt and inclination accelerometer)
  - 1x NEO-6M GPS Module (node position coordinates)
- **Automatic Fallback Simulator:** If run on a non-Pi machine or without active GPIO/SPI chips, the script automatically enters a telemetry simulator mode. This allows testing of the central dashboard server without needing physical hardware.
- **REST Telemetry Posting:** Periodically POSTs telemetry JSON data to the Central PC API server.

---

## 🔌 Pin Configuration and Schematic

Refer to the [Circuitry/README.md](file:///D:/Ideas/Spark-Landslide-Detecting-Device/Circuitry/README.md) file at the project root for full pin mapping and wiring instructions.

---

## 📦 Prerequisites and Installation

### 1. Enable Hardware Interfaces on Raspberry Pi

Run the Raspberry Pi Configuration tool:
```bash
sudo raspi-config
```
Navigate to **Interface Options** and enable:
- **SPI** (for MCP3008 ADC)
- **I2C** (for MPU6050)
- **1-Wire** (for DS18B20 Temperature)
- **Serial Port** (for GPS, enable serial port, disable login shell over serial)

Reboot the Raspberry Pi:
```bash
sudo reboot
```

### 2. Connect 1-Wire Temperature Sensors
Ensure you place a **4.7kΩ pull-up resistor** between the 3.3V power line and the 1-Wire Data line (GPIO 4) to read the DS18B20 temperature sensors.

### 3. Install Software Dependencies
Install the required packages using pip:
```bash
pip3 install requests spidev smbus RPi.GPIO
```

---

## 🚀 Running the Script

You can run the script directly:
```bash
python3 landslide_detector.py
```

### Environment Variables
You can configure the node's settings using environment variables:
- `CENTRAL_PC_URL`: Destination URL of the Central PC backend server. (Default: `http://localhost:5000/api/telemetry`)
- `NODE_ID`: Unique name/identifier of this sensor node. (Default: `RPi-Node-01`)
- `LOCATION_NAME`: Description of the physical slope location. (Default: `Slope-A_Sector-4`)
- `SEND_INTERVAL_SEC`: Period in seconds between data readings and transmissions. (Default: `5.0` seconds)

**Example with Custom Environment Configuration:**
```bash
NODE_ID="Node-SouthSlope" LOCATION_NAME="Ella-Pass-KM45" CENTRAL_PC_URL="http://192.168.1.100:5000/api/telemetry" python3 landslide_detector.py
```
