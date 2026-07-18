# 🖥️ Central PC Backend Server

The central controller backend is built in Python using Flask and SQLite. It receives incoming telemetry payloads from Raspberry Pi sensor nodes, calculates threat/risk indexes, manages alert dispatches, and powers a Retrieval-Augmented Generation (RAG) chatbot for disaster risk management.

---

## 🛠️ Key Endpoints

- **`POST /api/telemetry`**: Receives node sensor values and saves them to the DB. Triggers automatic Level 3 critical warnings if geological limits are breached.
- **`GET /api/nodes`**: Returns the list of active slope tracking nodes with their latest locations, risk levels, and status.
- **`GET /api/history/<node_id>`**: Returns chronological sensor array data (moisture, pressure, temp, tilt) for trend visualization.
- **`POST /api/send-alert`**: Manually dispatch warnings to area residents (via SMS broadcast, emails, or siren triggers).
- **`GET /api/alerts`**: Returns the history logs of manual and automatic dispatched notifications.
- **`POST /api/chat`**: Converses with the RAG chatbot to retrieve slope states, geological thresholds, safety action plans, or emergency numbers.

---

## ⚙️ Setup and Execution

### 1. Initialize virtual environment and dependencies
We use `pipenv` to manage python dependencies. Navigate to the root directory and activate the environment:
```bash
pipenv shell
```

### 2. Run the Backend API Server
Run the Flask server from the root of the project workspace:
```bash
python -m central_pc.backend.app
```
The server will start on `http://localhost:5000`.

### 3. Run the Multi-Node Telemetry Simulator
To test the server and populate the database without physical hardware, run the simulator script in a separate terminal:
```bash
pipenv run python -m central_pc.backend.simulate_pi
```
This script runs a continuous loop generating realistic geotechnical readings for three separate nodes:
1. `RPi-Node-01` (North Slope) - Simulates a deteriorating slope with rising moisture, pressure, and tilt.
2. `RPi-Node-02` (South Valley) - Simulates stable, moderately wet soil with active waterfall detections.
3. `RPi-Node-03` (East Gorge) - Simulates stable, dry geological conditions.

---

## 🤖 RAG Chatbot Integration

The backend RAG engine (`rag_engine.py`) searches:
1. Active real-time sensor parameters from the SQLite database.
2. Standard geotechnical landslide safety documentation.

### LLM Configurations
- **Standard Mode (Zero-Config):** The chatbot works **out of the box** without any API keys by using a local rule-based semantic parser. It provides precise factual summaries of live nodes, safety steps, emergency contacts, and hardware specs.
- **AI-Enhanced Mode:** To enable advanced natural language generation via Gemini, set the environment variable:
  ```bash
  $env:GEMINI_API_KEY="your-api-key"
  ```
  or on Linux/macOS:
  ```bash
  export GEMINI_API_KEY="your-api-key"
  ```
  The server will automatically detect the key and use the Google Gemini 2.5 Flash model for conversations.
