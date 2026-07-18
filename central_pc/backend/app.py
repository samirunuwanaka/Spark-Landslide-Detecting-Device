import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from .database import (
    init_db,
    save_telemetry,
    get_active_nodes,
    get_telemetry_history,
    log_dispatched_alert,
    get_dispatched_alerts
)
from .rag_engine import ask_rag_bot

app = Flask(__name__)
# Enable CORS for all routes, allowing local development of React dashboard
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Ensure database is initialized before serving requests
init_db()

@app.route("/api/telemetry", methods=["POST"])
def post_telemetry():
    """Receives data from Raspberry Pi sensor nodes."""
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided"}), 400
        
    required_fields = ["node_id", "location_name", "gps", "tilt", "waterfall_detected", "soil_moisture", "soil_pressure", "soil_temperature"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
            
    try:
        risk_level, risk_reason = save_telemetry(data)
        
        # If risk level is level 3, we log an automatic emergency alert dispatch
        if risk_level == 3:
            alert_msg = f"EMERGENCY: Immediate evacuation ordered for {data['location_name']} due to high landslide probability ({risk_reason})."
            log_dispatched_alert(
                node_id=data["node_id"],
                location_name=data["location_name"],
                risk_level=3,
                message=alert_msg,
                sent_to="All Area Residents (SMS & Sirens)",
                status="Dispatched (Auto)"
            )
            
        return jsonify({
            "status": "success",
            "risk_level": risk_level,
            "risk_reason": risk_reason
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/nodes", methods=["GET"])
def get_nodes():
    """Returns all active slope monitoring nodes and their current risk levels."""
    try:
        nodes = get_active_nodes()
        return jsonify(nodes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/history/<node_id>", methods=["GET"])
def get_node_history(node_id):
    """Returns historical telemetry data for a specific node to draw trend charts."""
    limit = request.args.get("limit", default=30, type=int)
    try:
        history = get_telemetry_history(node_id, limit)
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/send-alert", methods=["POST"])
def send_alert():
    """Manually dispatch alerts/messages to residents of risk areas."""
    data = request.json
    if not data:
        return jsonify({"error": "No payload provided"}), 400
        
    node_id = data.get("node_id")
    location_name = data.get("location_name", "Unknown Area")
    risk_level = data.get("risk_level", 1)
    message = data.get("message")
    sent_to = data.get("sent_to", "SMS Broadcast")
    
    if not node_id or not message:
        return jsonify({"error": "Missing node_id or message"}), 400
        
    try:
        log_dispatched_alert(
            node_id=node_id,
            location_name=location_name,
            risk_level=risk_level,
            message=message,
            sent_to=sent_to,
            status="Delivered"
        )
        return jsonify({
            "status": "success",
            "message": f"Alert broadcast sent successfully via {sent_to}."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    """Gets history of dispatched alerts."""
    try:
        alerts = get_dispatched_alerts(limit=50)
        return jsonify(alerts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    """Chatbot handler with local RAG mapping."""
    data = request.json
    if not data or "message" not in data:
        return jsonify({"error": "Missing message parameter"}), 400
        
    query = data["message"]
    try:
        response = ask_rag_bot(query)
        return jsonify({"response": response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # In production, run this as a package: python -m central_pc.backend.app
    app.run(host="0.0.0.0", port=5000, debug=True)
