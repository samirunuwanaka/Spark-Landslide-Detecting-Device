import os
import json
import time
import re
from .database import get_db_connection, get_active_nodes, get_telemetry_history

# Try importing Gemini API SDK
HAS_GEMINI_SDK = False
try:
    import google.generativeai as genai
    HAS_GEMINI_SDK = True
except ImportError:
    pass

# System Knowledge Base
KNOWLEDGE_BASE = {
    "system_overview": (
        "The Spark Landslide Detecting Device is an IoT slope failure forecasting and warning platform. "
        "It consists of Raspberry Pi sensor nodes buried in landslide-prone hills. Each node features: "
        "1) An 8-capacitor soil moisture sensor array mapping water saturation at 10cm intervals down to 80cm depth. "
        "2) An 8-sensor Force Sensitive Resistor (FSR) array mapping lateral soil pressure. "
        "3) An 8-channel DS18B20 digital thermometer chain. "
        "4) A PCB enclosure with an IR break-beam sensor for waterfall/flash-flood detection, an MPU6050 accelerometer for physical tilt, and a Neo-6M GPS module to track ground displacement."
    ),
    "risk_levels": (
        "The system calculates 4 risk levels:\n"
        "- Level 0 (Normal - Green): Moisture < 60%, Pressure < 30 kPa, Tilt < 3°. Everything is stable.\n"
        "- Level 1 (Warning - Yellow): Moisture 60-75%, Pressure 30-50 kPa, Tilt 3-8°, or IR waterfall detector triggered. Monitor weather closely.\n"
        "- Level 2 (Alert - Orange): Moisture 75-85%, Pressure 50-75 kPa, or Tilt 8-15°. Ground moving. Prepare for potential evacuation.\n"
        "- Level 3 (Critical - Red): Moisture > 85% + Pressure > 75 kPa, or Tilt >= 15°, or sudden GPS coordinate displacement (>0.0001°). Landslide imminent! Evacuate residents immediately."
    ),
    "safety_protocols": (
        "Action plan by risk level:\n"
        "- Risk Level 0: Maintain regular system checkups. Ensure solar panels and batteries are charging.\n"
        "- Risk Level 1: Send warning SMS to residents advising vigilance. Inspect local drains for debris blocking water flow.\n"
        "- Risk Level 2: Trigger amber sirens. Alert local emergency response teams. Tell residents to pack emergency bags and move away from steep slopes.\n"
        "- Risk Level 3: Dispatch immediate evacuation SMS. Activate physical sirens on the hills. Open designated local shelters (such as the community center and primary school)."
    ),
    "emergency_contacts": (
        "Emergency phone contacts:\n"
        "- Landslide Disaster Control: 119 or 011-2670000\n"
        "- Emergency Medical & Ambulance: 1990\n"
        "- Local Shelter Coordinator: 077-1234567\n"
        "- Red Cross Slopes Rescue: 081-9988776"
    ),
    "hardware_specs": (
        "Hardware wiring details:\n"
        "- MCP3008 ADC U1 is wired to SPI CS0 (GPIO 8) and measures the 8 capacitive soil moisture sensors.\n"
        "- MCP3008 ADC U2 is wired to SPI CS1 (GPIO 7) and measures the 8 soil pressure FSR sensors.\n"
        "- DS18B20 1-wire temperature chain is daisy-chained on GPIO 4.\n"
        "- IR detector is connected to GPIO 17.\n"
        "- MPU6050 Accelerometer communicates via I2C (GPIO 2 SDA, GPIO 3 SCL).\n"
        "- NEO-6M GPS communicates over UART (GPIO 14 TXD, GPIO 15 RXD)."
    )
}

def query_local_fallback(query_str, node_status_context):
    """
    Highly intelligent keyword matching fallback.
    Synthesizes custom factual responses without calling external LLM APIs.
    """
    query_lower = query_str.lower()
    
    # Check if user is asking about active nodes or live status
    if "status" in query_lower or "active" in query_lower or "current" in query_lower or "nodes" in query_lower or "slope" in query_lower:
        response = "### 📡 Live Sensor Status Dashboard\n\n"
        if not node_status_context:
            response += "No active sensor nodes are currently reporting to the central PC.\n"
        else:
            for node in node_status_context:
                color = "🟢 SAFE"
                if node['last_risk_level'] == 1: color = "🟡 WARNING"
                elif node['last_risk_level'] == 2: color = "🟠 ALERT"
                elif node['last_risk_level'] == 3: color = "🔴 CRITICAL EVACUATION"
                
                response += (
                    f"**📍 Node ID:** `{node['node_id']}` ({node['location_name']})\n"
                    f"- **Current Risk Level:** {color} (Level {node['last_risk_level']})\n"
                    f"- **Coordinates:** {node['lat']:.5f}, {node['lon']:.5f} (Alt: {node['alt']}m)\n"
                    f"- **Last Signal Seen:** {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(node['last_seen']))}\n\n"
                )
        response += "\nTo trigger evacuation alerts for any high-risk areas, use the **Alert Notification Panel** on the left menu."
        return response
        
    # Check for safety guidelines or protocols
    elif "safety" in query_lower or "protocol" in query_lower or "evacuate" in query_lower or "action" in query_lower or "what should i do" in query_lower or "what to do" in query_lower:
        return (
            "### 🚨 Standard Landslide Safety Protocols\n\n"
            f"{KNOWLEDGE_BASE['safety_protocols']}\n\n"
            f"### 📞 Key Contacts:\n{KNOWLEDGE_BASE['emergency_contacts']}"
        )
        
    # Check for thresholds or risk levels
    elif "threshold" in query_lower or "risk" in query_lower or "level" in query_lower or "limit" in query_lower or "moisture" in query_lower or "pressure" in query_lower:
        return (
            "### 📊 Geotechnical Risk Thresholds\n\n"
            f"{KNOWLEDGE_BASE['risk_levels']}\n\n"
            "The system continuously monitors the average moisture saturation and mechanical lateral force (pressure) of the 8 sensors down the vertical rod to compute these risk levels."
        )
        
    # Check for hardware specifications or circuitry
    elif "pin" in query_lower or "hardware" in query_lower or "gpio" in query_lower or "circuit" in query_lower or "sensor" in query_lower or "capacitor" in query_lower:
        return (
            "### 🔌 Hardware Pin and Array Architecture\n\n"
            f"{KNOWLEDGE_BASE['hardware_specs']}\n\n"
            f"{KNOWLEDGE_BASE['system_overview']}"
        )
        
    # Generic help
    else:
        return (
            "### 🤖 Landslide AI Assistant RAG Bot\n\n"
            "I can assist you with real-time operations, hazard diagnostics, and evacuation guidelines. "
            "Here are some questions you can ask me:\n"
            "1. *What is the current status of the active slopes?*\n"
            "2. *What are the safety protocols for Risk Level 2?*\n"
            "3. *What sensors are used to measure soil moisture and how are they wired?*\n"
            "4. *What are the emergency numbers for disaster control?*\n\n"
            "Please ask a specific query and I will parse our database and geological documentation to answer."
        )

def get_current_system_state_text(nodes):
    """Formats active nodes into a textual state summary for LLM context."""
    if not nodes:
        return "No active sensor nodes are currently reporting."
    
    text = "Current Live Slope Status:\n"
    for n in nodes:
        text += (
            f"- Node '{n['node_id']}' at location '{n['location_name']}' is at Risk Level {n['last_risk_level']}. "
            f"Coordinates: Lat {n['lat']:.5f}, Lon {n['lon']:.5f}. "
            f"Last updated: {time.strftime('%H:%M:%S', time.localtime(n['last_seen']))}.\n"
        )
    return text

def ask_rag_bot(user_query):
    """
    RAG bot main interface. Searches database and safety documentation.
    Uses Gemini API if API key is present in environment, else falls back to local query engine.
    """
    # Fetch latest system states
    nodes = get_active_nodes()
    system_state_text = get_current_system_state_text(nodes)
    
    # Configure Gemini if possible
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    
    if HAS_GEMINI_SDK and api_key:
        try:
            genai.configure(api_key=api_key)
            # Use gemini-2.5-flash or gemini-1.5-flash as default
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            # Construct context
            context_prompt = (
                "You are the Spark Landslide Detecting System RAG Chatbot. Your goal is to help the administrator "
                "make critical safety decisions based on real-time sensor data and standard safety procedures.\n\n"
                f"--- LIVE TELEMETRY STATE ---\n{system_state_text}\n\n"
                f"--- SYSTEM KNOWLEDGE BASE ---\n"
                f"System Overview: {KNOWLEDGE_BASE['system_overview']}\n\n"
                f"Risk Classification: {KNOWLEDGE_BASE['risk_levels']}\n\n"
                f"Safety Action Plans: {KNOWLEDGE_BASE['safety_protocols']}\n\n"
                f"Emergency Contacts: {KNOWLEDGE_BASE['emergency_contacts']}\n\n"
                "--- USER QUERY ---\n"
                f"The administrator asks: '{user_query}'\n\n"
                "Provide a clear, professional, structured response in Markdown. "
                "Ensure that if the live data indicates a threat (Risk Level 2 or 3), you highlight it immediately "
                "and recommend the correct evacuation protocol and emergency numbers."
            )
            
            response = model.generate_content(context_prompt)
            return response.text
        except Exception as e:
            # Fallback to local matching if API call fails
            return f"*Gemini API Call failed ({e}). Falling back to Local Knowledge Engine:*\n\n" + query_local_fallback(user_query, nodes)
    else:
        # No Gemini SDK or API key, run local intelligent matcher
        return query_local_fallback(user_query, nodes)
