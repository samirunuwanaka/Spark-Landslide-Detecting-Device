# 🔌 Circuitry and Pin Layout

This directory documents the hardware components, wiring, and pin arrangement used in the **Spark Landslide Detecting Device**.

To monitor landslide and waterfall risks, each sensor node uses a Raspberry Pi connected to an array of environmental sensors. Since the Raspberry Pi does not have built-in analog-to-digital converters (ADCs), we use two **MCP3008** (8-channel 10-bit ADC) chips over the SPI bus to interface with the analog capacitive and force sensors.

---

## 🛠️ System Components

1. **Raspberry Pi (3 Model B+ / 4 / Zero 2 W)** - Main edge computing node.
2. **Capacitive Soil Moisture Sensors (8x)** - Installed along a rod at varying depths. Connected to **MCP3008 (U1)**.
3. **Force Sensitive Resistors / FSR Pressure Sensors (8x)** - Wrapped around the rod to measure mechanical soil displacement/pressure. Connected to **MCP3008 (U2)**.
4. **DS18B20 1-Wire Temperature Sensors (8x)** - Waterproof probes daisy-chained along the rod to measure soil temperature at different depths.
5. **IR Break-Beam / Photoelectric Detector** - Placed in the enclosure or near water paths for waterfall/flash-flood detection.
6. **MPU6050 6-Axis Gyro/Accelerometer** - Detects tilt and slope movement.
7. **NEO-6M GPS Module** - Provides node location (Latitude, Longitude, Altitude) and detects physical shifting.

---

## 📌 Raspberry Pi Pin Arrangement

Below is the complete wiring table mapping the Raspberry Pi GPIO headers to the sensor components.

| Raspberry Pi Pin | GPIO / Function | Component | Description |
|:---|:---|:---|:---|
| **Pin 1 / 17** | `3.3V Power` | All Sensors | VCC supply for low-power sensors |
| **Pin 2 / 4** | `5V Power` | GPS / MPU6050 | VCC supply for 5V compatible components |
| **Pin 6 / 9 / 14 / 20 / 25** | `GND` | All Sensors | Common Ground |
| **Pin 3** | `GPIO 2 (SDA)` | MPU6050 | I2C Data line for tilt detection |
| **Pin 5** | `GPIO 3 (SCL)` | MPU6050 | I2C Clock line for tilt detection |
| **Pin 7** | `GPIO 4 (GPCLK0)` | DS18B20 Sensors | 1-Wire bus (requires 4.7kΩ pull-up resistor to 3.3V) |
| **Pin 8** | `GPIO 14 (TXD)` | NEO-6M GPS | UART TX -> GPS RX |
| **Pin 10** | `GPIO 15 (RXD)` | NEO-6M GPS | UART RX -> GPS TX |
| **Pin 11** | `GPIO 17` | IR Detector | Digital input from IR Receiver (Active LOW on beam break) |
| **Pin 19** | `GPIO 10 (MOSI)`| MCP3008 (U1 & U2) | SPI Master Out Slave In |
| **Pin 21** | `GPIO 9 (MISO)` | MCP3008 (U1 & U2) | SPI Master In Slave Out |
| **Pin 23** | `GPIO 11 (SCLK)`| MCP3008 (U1 & U2) | SPI Clock |
| **Pin 24** | `GPIO 8 (CE0)`  | MCP3008 (U1) | SPI Chip Enable 0 (Capacitive Moisture Array) |
| **Pin 26** | `GPIO 7 (CE1)`  | MCP3008 (U2) | SPI Chip Enable 1 (Pressure Sensor Array) |

---

## 📐 Analog-to-Digital Converter (ADC) Channels

### **MCP3008 (U1) - Soil Moisture Capacitive Array**
*Selected via CE0 (GPIO 8)*

| Channel | Depth | Description |
|:---:|:---:|:---|
| **CH0** | 10 cm | Soil moisture sensor 1 (Top soil) |
| **CH1** | 20 cm | Soil moisture sensor 2 |
| **CH2** | 30 cm | Soil moisture sensor 3 |
| **CH3** | 40 cm | Soil moisture sensor 4 |
| **CH4** | 50 cm | Soil moisture sensor 5 |
| **CH5** | 60 cm | Soil moisture sensor 6 |
| **CH6** | 70 cm | Soil moisture sensor 7 |
| **CH7** | 80 cm | Soil moisture sensor 8 (Deep bed) |

### **MCP3008 (U2) - Soil Pressure Array (FSRs)**
*Selected via CE1 (GPIO 7)*

| Channel | Depth | Description |
|:---:|:---:|:---|
| **CH0** | 10 cm | Force sensor 1 (Top soil pressure) |
| **CH1** | 20 cm | Force sensor 2 |
| **CH2** | 30 cm | Force sensor 3 |
| **CH3** | 40 cm | Force sensor 4 |
| **CH4** | 50 cm | Force sensor 5 |
| **CH5** | 60 cm | Force sensor 6 |
| **CH6** | 70 cm | Force sensor 7 |
| **CH7** | 80 cm | Force sensor 8 (Deep bed pressure) |

---

## 📈 Sensor Working Principles

### 1. Capacitive Soil Moisture Sensor Array
Traditional resistive moisture sensors corrode quickly when buried. Capacitive sensors measure soil moisture by sensing dielectric permittivity changes rather than electrical resistance. The 8 sensors are spaced at 10cm intervals along a fiberglass rod.

### 2. Soil Pressure Array
Mechanical movement, shifting soil, or swelling clay creates lateral force on the rod. FSR (Force Sensitive Resistor) sensors are placed opposite to the slope direction. A decrease in resistance corresponds to an increase in pressure (force) exerted by shifting earth.

### 3. DS18B20 1-Wire Temperature
Because temperature changes the dielectric constant of water, soil temperature must be logged to calibrate the moisture readings. DS18B20 sensors are daisy-chained. The Pi queries each sensor using its unique 64-bit ROM address over a single pin.

### 4. IR Waterfall Monitor
An infrared transmitter and receiver face each other across a small open channel inside the PCB enclosure or at the mouth of a local drainage path. If water rises and blocks the IR beam (or refracts it), the sensor output switches from HIGH to LOW, flagging active water accumulation (waterfall/mudflow risk).

### 5. Tilt and GPS
A sudden change in physical tilt (detected via I2C MPU6050) combined with a shift in GPS coordinate data indicates that the ground hosting the sensor node is actively sliding, triggering an immediate level 3 (Critical) evacuation alert.
