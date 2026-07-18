import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  MapPin, 
  Compass, 
  MessageSquare, 
  Send, 
  RefreshCw, 
  Bell, 
  Zap, 
  Thermometer, 
  Droplets, 
  Activity, 
  ChevronRight, 
  Info,
  ShieldAlert,
  ListRestart
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const BACKEND_URL = 'http://localhost:5000';

function App() {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [chat, setChat] = useState([
    {
      sender: 'bot',
      text: '🤖 Welcome, Administrator. I am the **Spark Landslide Assistant**. I can query real-time sensor streams and local geological safety procedures to help you assess threats. Ask me anything!',
      time: new Date().toLocaleTimeString()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Alert Form States
  const [alertTargetNode, setAlertTargetNode] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertChannel, setAlertChannel] = useState('SMS Broadcast');
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [alertStatusMessage, setAlertStatusMessage] = useState(null);

  const chatEndRef = useRef(null);

  // Fetch active nodes and dispatched alerts
  const fetchData = async () => {
    try {
      const nodesRes = await fetch(`${BACKEND_URL}/api/nodes`);
      const nodesData = await nodesRes.json();
      setNodes(nodesData);
      
      if (nodesData.length > 0 && !selectedNodeId) {
        setSelectedNodeId(nodesData[0].node_id);
        setAlertTargetNode(nodesData[0].node_id);
        // Pre-fill default alert message
        setAlertMsg(`🚨 ALERT: Landslide warning level elevated for ${nodesData[0].location_name}. Please prepare for safety instructions.`);
      }

      const alertsRes = await fetch(`${BACKEND_URL}/api/alerts`);
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);
    } catch (error) {
      console.error("Error fetching dashboard telemetry data:", error);
    }
  };

  // Fetch history for selected node
  const fetchHistory = async (nodeId) => {
    if (!nodeId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${nodeId}?limit=25`);
      const data = await res.json();
      setHistory(data);
    } catch (error) {
      console.error(`Error fetching telemetry history for node ${nodeId}:`, error);
    }
  };

  // Auto-refresh hook
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchData();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedNodeId]);

  // Fetch history whenever selected node changes
  useEffect(() => {
    if (selectedNodeId) {
      fetchHistory(selectedNodeId);
      // Pre-fill target node details in the manual alert form
      const node = nodes.find(n => n.node_id === selectedNodeId);
      if (node) {
        setAlertTargetNode(node.node_id);
        setAlertMsg(`🚨 ALERT: Landslide warning level elevated for ${node.location_name}. Please prepare for safety instructions.`);
      }
    }
  }, [selectedNodeId]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, isChatLoading]);

  // Handle Chat Submit
  const handleChatSubmit = async (e, text = null) => {
    if (e) e.preventDefault();
    const queryText = text || chatInput;
    if (!queryText.trim()) return;

    // Add user message
    const userMsg = {
      sender: 'user',
      text: queryText,
      time: new Date().toLocaleTimeString()
    };
    setChat(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: queryText })
      });
      const data = await res.json();
      
      setChat(prev => [...prev, {
        sender: 'bot',
        text: data.response,
        time: new Date().toLocaleTimeString()
      }]);
    } catch (error) {
      setChat(prev => [...prev, {
        sender: 'bot',
        text: '❌ Connection failed. Could not communicate with the RAG backend server.',
        time: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Manual Alert Submit
  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    if (!alertTargetNode || !alertMsg.trim()) return;
    
    setIsSendingAlert(true);
    setAlertStatusMessage(null);
    const targetNode = nodes.find(n => n.node_id === alertTargetNode);

    try {
      const res = await fetch(`${BACKEND_URL}/api/send-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: alertTargetNode,
          location_name: targetNode ? targetNode.location_name : "General Area",
          risk_level: targetNode ? targetNode.last_risk_level : 1,
          message: alertMsg,
          sent_to: alertChannel
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setAlertStatusMessage({ type: 'success', text: `Message dispatched to residents via ${alertChannel}.` });
        fetchData(); // Reload alerts feed
      } else {
        setAlertStatusMessage({ type: 'error', text: `Dispatch failed: ${data.error}` });
      }
    } catch (error) {
      setAlertStatusMessage({ type: 'error', text: 'Error connecting to alert gateway.' });
    } finally {
      setIsSendingAlert(false);
    }
  };

  const getRiskMetadata = (level) => {
    switch(level) {
      case 3:
        return { name: "CRITICAL EVACUATION", color: "var(--color-critical)", bg: "rgba(239, 68, 68, 0.15)", border: "var(--color-critical)" };
      case 2:
        return { name: "HIGH DANGER", color: "var(--color-alert)", bg: "rgba(249, 115, 22, 0.15)", border: "var(--color-alert)" };
      case 1:
        return { name: "ELEVATED WARNING", color: "var(--color-warning)", bg: "rgba(245, 158, 11, 0.15)", border: "var(--color-warning)" };
      default:
        return { name: "NORMAL STABLE", color: "var(--color-safe)", bg: "rgba(16, 185, 129, 0.15)", border: "var(--color-safe)" };
    }
  };

  // Find selected node detail
  const currentNode = nodes.find(n => n.node_id === selectedNodeId);

  // Prepare chart data for history trends (taking the latest telemetry)
  const latestTelemetry = history[history.length - 1];
  
  // Format current moisture and pressure along the 8 depth levels
  const depthProfileData = latestTelemetry 
    ? latestTelemetry.moisture_array.map((m, idx) => {
        const depths = latestTelemetry.sensor_depths_cm || [10, 20, 30, 40, 50, 60, 70, 80];
        return {
          depth: `${depths[idx] !== undefined ? depths[idx] : (idx + 1) * 10} cm`,
          moisture: m,
          pressure: latestTelemetry.pressure_array[idx],
          temperature: latestTelemetry.temperature_array[idx]
        };
      })
    : [];

  // Format historical timeline values (averages of arrays over time)
  const timelineData = history.map(h => {
    const avgMoisture = h.moisture_array.reduce((a,b) => a+b, 0) / h.moisture_array.length;
    const avgPressure = h.pressure_array.reduce((a,b) => a+b, 0) / h.pressure_array.length;
    return {
      time: new Date(h.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
      avgMoisture: Math.round(avgMoisture * 10) / 10,
      avgPressure: Math.round(avgPressure * 10) / 10,
      maxTilt: Math.max(Math.abs(h.roll), Math.abs(h.pitch))
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '20px' }}>
      
      {/* 🚀 Header */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
        <div className="scanner-line"></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Activity size={28} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>SPARK Landslide & Flood Monitoring</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Central PC Operations Dashboard • Real-time Geological Risk Matrix</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="glass-panel" style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }}></span>
              <span>Active Nodes: <strong>{nodes.length}</strong></span>
            </div>
            {nodes.some(n => n.last_risk_level === 3) && (
              <div className="glass-panel fade-in" style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-critical)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <span className="pulsing-marker marker-critical" style={{ width: '8px', height: '8px' }}></span>
                <span style={{ color: 'var(--color-critical)', fontWeight: 600 }}>IMMINENT HAZARD DETECTED</span>
              </div>
            )}
          </div>

          <button 
            onClick={() => { setAutoRefresh(!autoRefresh); fetchData(); }} 
            className="glass-panel" 
            style={{ 
              background: 'transparent', 
              color: 'var(--text-main)', 
              border: '1px solid var(--border-color)', 
              padding: '8px 14px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            <RefreshCw size={14} className={autoRefresh ? "spin-icon" : ""} style={{ animation: autoRefresh ? 'spin 3s linear infinite' : 'none' }} />
            {autoRefresh ? "Live Auto Sync On" : "Auto Sync Paused"}
          </button>
        </div>
      </header>

      {/* 📊 Main Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr 340px', gap: '20px', flex: 1, alignItems: 'stretch' }}>
        
        {/* ===================== LEFT COLUMN: MAP & ALERTS ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 🗺️ Topological SVG Map */}
          <div className="glass-panel" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <MapPin size={16} color="var(--primary)" /> Topographic Elevation Grid Map
            </h3>

            {/* Custom stylized contour map */}
            <div style={{ flex: 1, position: 'relative', border: '1px solid var(--border-color)', borderRadius: '12px', background: '#020617', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg width="100%" height="100%" viewBox="0 0 300 280" style={{ position: 'absolute', top: 0, left: 0 }}>
                {/* Elevation Contours */}
                <path d="M -10,120 Q 80,100 150,150 T 310,180" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                <path d="M -10,150 Q 70,120 160,190 T 310,210" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                <path d="M -10,90 Q 90,70 140,110 T 310,140" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                <path d="M -10,60 Q 100,30 180,90 T 310,110" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                <path d="M 50,-10 Q 120,40 220,10 T 310,50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                
                {/* River Flow (Flood Monitoring Zone) */}
                <path d="M 0,220 C 100,210 120,270 300,240" fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="16" />
                <path d="M 0,220 C 100,210 120,270 300,240" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6,4" opacity="0.6" />
                
                <text x="10" y="245" fill="rgba(59, 130, 246, 0.4)" fontSize="9" fontWeight="bold">RIVER FLOODPLAIN CHANNEL</text>
                <text x="210" y="40" fill="rgba(255, 255, 255, 0.2)" fontSize="9">HIGH SLOPE CONTOUR (500m)</text>
                
                {/* Nodes Plot */}
                {nodes.map((node) => {
                  // Map geographical coordinate coordinates into SVG viewbox
                  // Sri Lanka coords range roughly lat: 6.91 - 6.94, lon: 80.64 - 80.67
                  const mapX = 30 + ((node.lon - 80.635) / 0.035) * 240;
                  const mapY = 250 - ((node.lat - 6.915) / 0.025) * 220;

                  const isSelected = node.node_id === selectedNodeId;
                  const statusMeta = getRiskMetadata(node.last_risk_level);
                  
                  let markerClass = "pulsing-marker marker-safe";
                  if (node.last_risk_level === 1) markerClass = "pulsing-marker marker-warning";
                  else if (node.last_risk_level === 2) markerClass = "pulsing-marker marker-alert";
                  else if (node.last_risk_level === 3) markerClass = "pulsing-marker marker-critical";

                  return (
                    <g key={node.node_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeId(node.node_id)}>
                      {/* Connection lines for UI styling */}
                      {isSelected && (
                        <line x1={mapX} y1={mapY} x2="150" y2="140" stroke={statusMeta.color} strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
                      )}
                      
                      {/* Outer Ring */}
                      <circle 
                        cx={mapX} 
                        cy={mapY} 
                        r={isSelected ? 16 : 10} 
                        fill="none" 
                        stroke={statusMeta.color} 
                        strokeWidth={isSelected ? 2 : 1}
                        style={{ transition: 'all 0.3s ease' }}
                        opacity={isSelected ? 0.9 : 0.4} 
                      />
                      
                      {/* Pulsing Core */}
                      <circle cx={mapX} cy={mapY} r="5" fill={statusMeta.color} />
                    </g>
                  );
                })}
              </svg>

              {/* Dynamic Overlay labels */}
              {nodes.map((node) => {
                const mapX = 30 + ((node.lon - 80.635) / 0.035) * 240;
                const mapY = 250 - ((node.lat - 6.915) / 0.025) * 220;
                const isSelected = node.node_id === selectedNodeId;

                return (
                  <div 
                    key={node.node_id} 
                    style={{ 
                      position: 'absolute', 
                      left: `${(mapX / 300) * 100}%`, 
                      top: `${(mapY / 280) * 100}%`,
                      transform: 'translate(-50%, -130%)',
                      background: 'rgba(3, 7, 18, 0.9)',
                      border: isSelected ? `1px solid ${getRiskMetadata(node.last_risk_level).color}` : '1px solid var(--border-color)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
                      zIndex: isSelected ? 10 : 1
                    }}
                  >
                    {node.node_id} (Lvl {node.last_risk_level})
                  </div>
                );
              })}

              {nodes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', zIndex: 1 }}>
                  <Info size={24} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No live telemetry feeds found.</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Launch python simulator to begin.</p>
                </div>
              )}
            </div>
          </div>

          {/* 📢 Evacuation Dispatcher Control */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Bell size={16} color="var(--color-critical)" /> Emergency Notification Dispatch
            </h3>
            
            <form onSubmit={handleAlertSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Select Target Slope Zone</label>
                <select 
                  value={alertTargetNode} 
                  onChange={(e) => {
                    setAlertTargetNode(e.target.value);
                    const matchedNode = nodes.find(n => n.node_id === e.target.value);
                    if (matchedNode) {
                      setAlertMsg(`🚨 ALERT: Landslide warning level elevated for ${matchedNode.location_name}. Please prepare for safety instructions.`);
                    }
                  }}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'white', fontSize: '13px' }}
                >
                  <option value="">-- Choose slope --</option>
                  {nodes.map(n => (
                    <option key={n.node_id} value={n.node_id}>{n.node_id} ({n.location_name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Broadcasting Channel</label>
                <select 
                  value={alertChannel} 
                  onChange={(e) => setAlertChannel(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'white', fontSize: '13px' }}
                >
                  <option value="SMS Broadcast">📲 SMS Broadcast (All Residents)</option>
                  <option value="Email Alert">📧 Disaster Agency Email Alert</option>
                  <option value="Local Sirens">🚨 Trigger Physical Danger Sirens</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Warning Message</label>
                <textarea 
                  rows="3" 
                  value={alertMsg} 
                  onChange={(e) => setAlertMsg(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'white', fontSize: '12px', resize: 'none', fontFamily: 'inherit' }}
                  placeholder="Enter message details..."
                />
              </div>

              <button 
                type="submit" 
                disabled={isSendingAlert || !alertTargetNode || !alertMsg.trim()}
                className="glow-btn" 
                style={{ 
                  background: 'linear-gradient(135deg, var(--color-critical), #b91c1c)',
                  boxShadow: '0 4px 14px var(--color-critical-glow)',
                  width: '100%', 
                  padding: '10px', 
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ShieldAlert size={16} />
                {isSendingAlert ? "Broadcasting..." : "Broadcast Alert Message"}
              </button>

              {alertStatusMessage && (
                <div style={{ 
                  fontSize: '12px', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  backgroundColor: alertStatusMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: alertStatusMessage.type === 'success' ? '1px solid var(--color-safe)' : '1px solid var(--color-critical)',
                  color: alertStatusMessage.type === 'success' ? 'var(--color-safe)' : 'var(--color-critical)'
                }}>
                  {alertStatusMessage.text}
                </div>
              )}
            </form>
          </div>

        </div>

        {/* ===================== CENTER COLUMN: GEOTECHNICAL TRENDS & DETAIL ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Node Selector Cards Header */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Select Active Slope Node to Inspect
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {nodes.map(n => {
                const isSelected = n.node_id === selectedNodeId;
                const statusMeta = getRiskMetadata(n.last_risk_level);
                return (
                  <div 
                    key={n.node_id}
                    onClick={() => setSelectedNodeId(n.node_id)}
                    className="glass-panel"
                    style={{ 
                      padding: '10px 14px', 
                      cursor: 'pointer',
                      borderColor: isSelected ? statusMeta.color : 'var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)',
                      boxShadow: isSelected ? `0 0 12px ${statusMeta.color}33` : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{n.node_id}</span>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusMeta.color, boxShadow: `0 0 6px ${statusMeta.color}` }}></span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.location_name}
                    </span>
                  </div>
                );
              })}
              {nodes.length === 0 && (
                <div style={{ gridColumn: 'span 3', padding: '10px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Waiting for telemetry broadcasts...
                </div>
              )}
            </div>
          </div>

          {/* Node Geological Overview */}
          {currentNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              
              {/* Telemetry Snapshot Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                
                {/* Risk Level Badge */}
                <div className="glass-panel" style={{ padding: '12px', borderLeft: `4px solid ${getRiskMetadata(currentNode.last_risk_level).color}` }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Threat Classification</span>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: getRiskMetadata(currentNode.last_risk_level).color, marginTop: '4px' }}>
                    {getRiskMetadata(currentNode.last_risk_level).name}
                  </div>
                </div>

                {/* Tilt status */}
                <div className="glass-panel" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Compass size={12} color="var(--text-accent)" /> 2-Axis Tilt
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>
                    X: {latestTelemetry ? latestTelemetry.roll : 0}° | Y: {latestTelemetry ? latestTelemetry.pitch : 0}°
                  </div>
                </div>

                {/* Waterfall status */}
                <div className="glass-panel" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} color="var(--color-warning)" /> IR Flow Monitor
                  </span>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: 'bold', 
                    marginTop: '4px',
                    color: latestTelemetry?.waterfall_detected ? 'var(--color-critical)' : 'var(--color-safe)' 
                  }}>
                    {latestTelemetry?.waterfall_detected ? "FLOW ALERT" : "DRY"}
                  </div>
                </div>

                {/* GPS Location */}
                <div className="glass-panel" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="var(--color-safe)" /> Lat / Lon
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                    {currentNode.lat.toFixed(4)}, {currentNode.lon.toFixed(4)}
                  </div>
                </div>

              </div>

              {/* Vertical Soil Profile (Sensors vs Depth) */}
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="var(--primary)" /> 8-Sensor Vertical Profiler (Real-time Depth Mapping)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
                  {/* Moisture Gradient Profile */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-accent)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Droplets size={12} /> Soil Moisture Saturation Array
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {depthProfileData.map((d, index) => {
                        let barColor = "var(--color-safe)";
                        if (d.moisture >= 85) barColor = "var(--color-critical)";
                        else if (d.moisture >= 75) barColor = "var(--color-alert)";
                        else if (d.moisture >= 60) barColor = "var(--color-warning)";

                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                            <span style={{ width: '45px', color: 'var(--text-muted)' }}>{d.depth}</span>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${d.moisture}%`, backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}` }}></div>
                            </div>
                            <span style={{ width: '35px', textAlign: 'right', fontWeight: 'bold' }}>{d.moisture}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pressure Gradient Profile */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', background: 'rgba(0,0,0,0.2)' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-alert)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Activity size={12} /> Lateral Soil Pressure Array
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {depthProfileData.map((d, index) => {
                        let barColor = "var(--color-safe)";
                        if (d.pressure >= 75) barColor = "var(--color-critical)";
                        else if (d.pressure >= 50) barColor = "var(--color-alert)";
                        else if (d.pressure >= 30) barColor = "var(--color-warning)";

                        // Scale pressure from 0-150 kPa for bar percentage visualization
                        const pressPct = Math.min(100, (d.pressure / 150) * 100);

                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px' }}>
                            <span style={{ width: '45px', color: 'var(--text-muted)' }}>{d.depth}</span>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pressPct}%`, backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}` }}></div>
                            </div>
                            <span style={{ width: '50px', textAlign: 'right', fontWeight: 'bold' }}>{d.pressure} kPa</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

              {/* Historic Time Trends Chart */}
              <div className="glass-panel" style={{ padding: '16px', flex: 1, minHeight: '220px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={16} color="var(--primary)" /> Average Saturation and Soil Pressure Timeline Trend
                </h3>
                <div style={{ flex: 1, width: '100%', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                      <YAxis yAxisId="left" stroke="var(--text-accent)" fontSize={10} label={{ value: 'Avg Moisture (%)', angle: -90, position: 'insideLeft', fill: 'var(--text-accent)', offset: 5 }} />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--color-alert)" fontSize={10} label={{ value: 'Avg Pressure (kPa)', angle: 90, position: 'insideRight', fill: 'var(--color-alert)', offset: 5 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.9)', borderColor: 'var(--border-color)', color: 'white' }} />
                      <Line yAxisId="left" type="monotone" dataKey="avgMoisture" name="Avg Moisture (%)" stroke="var(--text-accent)" strokeWidth={2.5} activeDot={{ r: 8 }} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="avgPressure" name="Avg Pressure (kPa)" stroke="var(--color-alert)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          ) : (
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' }}>
              <Activity size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Geotechnical Diagnostics Monitor</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '300px', marginTop: '6px' }}>
                Start simulating telemetry data from the Raspberry Pi server to map real-time soil mechanics.
              </p>
            </div>
          )}
        </div>

        {/* ===================== RIGHT COLUMN: CHATBOT & ALERTS HISTORY ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 🤖 RAG Chatbot Interface */}
          <div className="glass-panel" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '380px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <MessageSquare size={16} color="var(--primary)" /> Geological Decision RAG Bot
            </h3>
            
            {/* Quick Actions Prompts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              <button 
                onClick={(e) => handleChatSubmit(e, "What is the status of the active slopes?")}
                style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-accent)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                📋 Slope Status
              </button>
              <button 
                onClick={(e) => handleChatSubmit(e, "What should we do if tilt goes up?")}
                style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-accent)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                🚨 Safety Plan
              </button>
              <button 
                onClick={(e) => handleChatSubmit(e, "How are the sensors wired on Raspberry Pi?")}
                style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-accent)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                🔌 Wiring Pins
              </button>
            </div>

            {/* Chat Messages Feed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '10px' }}>
              {chat.map((msg, index) => (
                <div 
                  key={index} 
                  style={{ 
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: msg.sender === 'user' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                    border: msg.sender === 'user' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    padding: '8px 12px',
                    borderRadius: msg.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: '12px',
                    lineHeight: '1.5'
                  }}
                >
                  {/* Extremely basic markdown bold and bullet rendering inside fallback strings */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.text.split('\n').map((line, lidx) => {
                      let formattedLine = line;
                      // Replace **text** with bold span
                      const boldRegex = /\*\*(.*?)\*\*/g;
                      const parts = [];
                      let lastIndex = 0;
                      let match;
                      
                      while ((match = boldRegex.exec(line)) !== null) {
                        parts.push(line.substring(lastIndex, match.index));
                        parts.push(<strong key={match.index}>{match[1]}</strong>);
                        lastIndex = boldRegex.lastIndex;
                      }
                      parts.push(line.substring(lastIndex));
                      
                      return (
                        <div key={lidx} style={{ marginTop: line.startsWith('-') ? '4px' : '2px', marginLeft: line.startsWith('-') ? '10px' : '0' }}>
                          {parts.length > 1 ? parts : formattedLine}
                        </div>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', textAlign: 'right', marginTop: '4px' }}>
                    {msg.time}
                  </span>
                </div>
              ))}
              {isChatLoading && (
                <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  🤖 Analyzing geotechnical database...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Send Form */}
            <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask bot about safety levels or coordinates..."
                style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', color: 'white', fontSize: '13px' }}
              />
              <button 
                type="submit" 
                style={{ padding: '10px', borderRadius: '6px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>

          {/* 📜 Alerts History Log */}
          <div className="glass-panel" style={{ padding: '16px', height: '220px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Bell size={16} color="var(--primary)" /> Dispatched Warning Feed
            </h3>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alerts.map((alert) => {
                const color = alert.risk_level === 3 ? 'var(--color-critical)' : alert.risk_level === 2 ? 'var(--color-alert)' : 'var(--color-warning)';
                return (
                  <div 
                    key={alert.id} 
                    style={{ 
                      padding: '8px', 
                      borderRadius: '8px', 
                      background: 'rgba(0,0,0,0.2)', 
                      border: `1px solid var(--border-color)`,
                      borderLeft: `3px solid ${color}`,
                      fontSize: '11px' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 'bold' }}>
                      <span style={{ color: color }}>LEVEL {alert.risk_level} • {alert.sent_to}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(alert.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-main)', lineHeight: '1.4' }}>{alert.message}</p>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No warnings dispatched yet.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;
