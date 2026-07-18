# 🌍 Spark Landslide and Flood Detecting System

[![SPARK Challenge](https://img.shields.io/badge/Competition-SPARK_Challenge-red)](https://ent.uom.lk/spark-at-uom/)
[![Hardware](https://img.shields.io/badge/Hardware-Raspberry_Pi-A22846?logo=raspberrypi&logoColor=white)](https://www.raspberrypi.com/)
[![Target](https://img.shields.io/badge/Focus-Climate_Action_&_SDGs-green)](#)

An AI and IoT-powered geological slope failure forecasting and warning platform. The system uses a network of buried Raspberry Pi sensor nodes and a central PC monitoring console to predict slope failures hours or days before they happen.

<details>
  <summary>
    <!-- This acts as your "Click to Play" banner -->
    <img src="project overview.png" alt="Click to expand and watch video" width="600">
  </summary>
  
  <br>
  
  <!-- The actual video that plays when expanded -->
  <video src="central_pc/frontend/video.mp4" controls width="600" autoplay muted loop playsinline></video>
</details>
---

## 📂 Project Structure

This project is divided into dedicated modules for hardware acquisition, central server computation, and operator dashboard interfaces.

1. **[Circuitry](file:///D:/Ideas/Spark-Landslide-Detecting-Device/Circuitry/README.md)**
   - Technical specifications, hardware components, and Raspberry Pi GPIO/SPI pin layout schematics.
2. **[Hardware/rasberry_pi_code](file:///D:/Ideas/Spark-Landslide-Detecting-Device/Hardware/rasberry_pi_code/README.md)**
   - Client code running on Raspberry Pi edge nodes. Reads from the 8-capacitor moisture/pressure array, DS18B20 temperature probes, tilt sensors, IR waterfall monitors, and GPS. Includes an automatic virtual telemetry simulator if physical sensors are detached.
3. **[central_pc/backend](file:///D:/Ideas/Spark-Landslide-Detecting-Device/central_pc/backend/README.md)**
   - Flask API server and SQLite database database container. Houses the geological threat index algorithms, manual warning broadcaster, and a Retrieval-Augmented Generation (RAG) chatbot engine.
4. **[central_pc/frontend](file:///D:/Ideas/Spark-Landslide-Detecting-Device/central_pc/frontend/README.md)**
   - Colorful React/Vite dashboard console. Visualizes active nodes on a topographic contour map, overlays 8-sensor deep vertical profiles, charts history timelines, logs dispatched alerts, and hosts the RAG decision-support chatbot.

---

## ⚡ Quick Start Instructions

### 1. Initialize the Python Virtual Environment
This project uses `pipenv` to manage python dependencies. Install all packages:
```bash
pipenv install
```
Activate the environment:
```bash
pipenv shell
```

### 2. Run the Central PC Backend
Launch the Flask REST API server from the project root:
```bash
python -m central_pc.backend.app
```
The server will start on `http://localhost:5000` and automatically create the SQLite database `landslide_data.db`.

### 3. Run the React Dashboard
In a separate terminal, navigate to the React frontend folder:
```bash
cd central_pc/frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser to view the console.

### 4. Run Node Simulations (Demo Mode)
To populate the database and test risk transitions without physical sensor probes, start the multi-node simulation loop in a new terminal:
```bash
pipenv run python -m central_pc.backend.simulate_pi
```
This simulator feeds live readings for three separate zones, escalating North Slope moisture/pressure parameters over time to trigger alert and evacuation thresholds.

---

## 📈 Geotechnical Risk Matrix

Telemetry signals are parsed by the central controller to classify threat levels (0 to 3) and direct responses:

| Threat Level | Status Name | Criteria | Dispatch Action |
|:---:|:---|:---|:---|
| **Level 0** | Normal Stable | Moisture < 60%, Pressure < 30 kPa, Tilt < 3° | System heartbeat logging; standard background tracking. |
| **Level 1** | Elevated Warning | Moisture 60-75%, Pressure 30-50 kPa, Tilt 3-8°, or IR waterfall flow detected | Broadcast alert SMS to local residents to monitor rain; inspect drains. |
| **Level 2** | High Danger | Moisture 75-85%, Pressure 50-75 kPa, or Tilt 8-15° | Trigger amber sirens; alert response teams; suggest packing kits. |
| **Level 3** | Critical Evacuation | Moisture > 85% + Pressure > 75 kPa, Tilt >= 15°, or GPS displacement > 0.0001° | Broadcast evacuation orders via SMS; trigger high-decibel sirens on slope. |

---

## 🤖 RAG Decision-Support Chatbot

The integrated chatbot serves as an assistant for disaster response.
- **Data Integration:** The bot automatically aggregates current active node coordinates, live tilt, and computed risk statistics from the database.
- **Factual Fallback:** Works 100% offline or without API keys via a local rule-based matching engine.
- **AI-Enhanced Mode:** Add your Google Gemini API key to the environment variables (`GEMINI_API_KEY`) to run natural language reasoning via Gemini 2.5 Flash.