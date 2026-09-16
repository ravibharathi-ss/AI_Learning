import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  Zap,
  Shield,
  Terminal,
  Plus,
  RefreshCw,
  HelpCircle,
  Server
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export const McpHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'arch' | 'servers' | 'agent_lab' | 'inspector' | 'safety'>('arch');

  // MCP Servers & Tools State
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [discoveredTools, setDiscoveredTools] = useState<any[]>([]);

  // Register Custom Server Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerTrack, setNewServerTrack] = useState('A');
  const [newServerDesc, setNewServerDesc] = useState('');
  const [newToolName, setNewToolName] = useState('custom_analytics_tool');
  const [newToolDesc, setNewToolDesc] = useState('Performs real-time analytics query over MCP');

  // Tool Call Test State
  const [selectedToolToCall, setSelectedToolToCall] = useState<string>('');
  const [toolArgsJson, setToolArgsJson] = useState<string>('{"order_id": "#90214"}');
  const [toolCallResult, setToolCallResult] = useState<any>(null);
  const [isCallingTool, setIsCallingTool] = useState(false);

  // Agent Lab State
  const [labTrackCode, setLabTrackCode] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F'>('A');
  const [labQuery, setLabQuery] = useState('My order #90214 custom headset is damaged and I want a full refund.');
  const [includeSecondServer, setIncludeSecondServer] = useState(true);
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentRunResult, setAgentRunResult] = useState<any>(null);

  // JSON-RPC Protocol Logs State
  const [protocolLogs, setProtocolLogs] = useState<any[]>([]);

  // Handshake State
  const [handshakeData, setHandshakeData] = useState<any>(null);

  useEffect(() => {
    fetchMcpServers();
    fetchDiscoveredTools();
  }, []);

  const fetchMcpServers = async () => {
    try {
      const res = await fetch(`${API_BASE}/mcp/servers`);
      if (res.ok) {
        const data = await res.json();
        setMcpServers(data);
      }
    } catch (e) {
      console.error("Failed to fetch MCP servers:", e);
    }
  };

  const fetchDiscoveredTools = async (trackCode?: string) => {
    try {
      const url = trackCode ? `${API_BASE}/mcp/tools?track_code=${trackCode}` : `${API_BASE}/mcp/tools`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredTools(data);
        if (data.length > 0 && !selectedToolToCall) {
          setSelectedToolToCall(data[0].name);
        }
      }
    } catch (e) {
      console.error("Failed to discover MCP tools:", e);
    }
  };

  const fetchProtocolLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/mcp/logs`);
      if (res.ok) {
        const data = await res.json();
        setProtocolLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch protocol logs:", e);
    }
  };

  const handleRegisterServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName) return;

    try {
      const res = await fetch(`${API_BASE}/mcp/servers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServerName,
          track_code: newServerTrack,
          description: newServerDesc || 'Custom registered third-party MCP Server.',
          transport_type: 'http',
          custom_tools: [
            {
              name: newToolName || 'custom_tool',
              description: newToolDesc || 'Custom operation exposed over MCP',
              inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
              mock_response: `CUSTOM_MCP_RESPONSE [${newServerName}]: Tool executed via MCP socket.`
            }
          ]
        })
      });

      if (res.ok) {
        setShowRegisterModal(false);
        setNewServerName('');
        setNewServerDesc('');
        fetchMcpServers();
        fetchDiscoveredTools();
      }
    } catch (e) {
      console.error("Failed to register server:", e);
    }
  };

  const handlePerformHandshake = async (serverId: string) => {
    try {
      const res = await fetch(`${API_BASE}/mcp/handshake/${serverId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setHandshakeData(data);
      }
    } catch (e) {
      console.error("Handshake failed:", e);
    }
  };

  const handleCallToolDirectly = async () => {
    if (!selectedToolToCall) return;
    setIsCallingTool(true);
    setToolCallResult(null);

    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(toolArgsJson);
    } catch {
      parsedArgs = { raw_input: toolArgsJson };
    }

    try {
      const res = await fetch(`${API_BASE}/mcp/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: selectedToolToCall,
          arguments: parsedArgs
        })
      });

      if (res.ok) {
        const data = await res.json();
        setToolCallResult(data);
        fetchProtocolLogs();
      }
    } catch (e) {
      console.error("Tool call failed:", e);
    } finally {
      setIsCallingTool(false);
    }
  };

  const handleRunAgentMcp = async () => {
    setIsExecutingAgent(true);
    setAgentRunResult(null);

    try {
      const res = await fetch(`${API_BASE}/mcp/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: labQuery,
          track_code: labTrackCode,
          include_second_server: includeSecondServer,
          max_steps: 5
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAgentRunResult(data);
        fetchMcpServers();
        fetchDiscoveredTools();
        fetchProtocolLogs();
      }
    } catch (e) {
      console.error("Agent execution failed:", e);
    } finally {
      setIsExecutingAgent(false);
    }
  };

  return (
    <div className="mcp-hub-container">
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '8px', borderRadius: '10px' }}>
              <Cpu size={24} style={{ color: '#06B6D4' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Week 9 Module 5 — MCP, Multi-Agent & A2A Studio
              </h1>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Model Context Protocol (v2024-11-05) standard socket plumbing, dynamic tool discovery over JSON-RPC, & server manager.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            fetchMcpServers();
            fetchDiscoveredTools();
            fetchProtocolLogs();
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} /> Refresh Protocol
        </button>
      </div>

      {/* Sub-Tab Navigation Pills */}
      <div className="mcp-nav-pills">
        <button
          className={`mcp-pill-btn ${activeTab === 'arch' ? 'active' : ''}`}
          onClick={() => setActiveTab('arch')}
        >
          <Layers size={15} /> 1. Architecture & Concepts
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'servers' ? 'active' : ''}`}
          onClick={() => setActiveTab('servers')}
        >
          <Server size={15} /> 2. MCP Servers & Discovery ({discoveredTools.length} Tools)
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'agent_lab' ? 'active' : ''}`}
          onClick={() => setActiveTab('agent_lab')}
        >
          <Zap size={15} /> 3. MCP Agent Lab (0 Code Changes)
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('inspector');
            fetchProtocolLogs();
          }}
        >
          <Terminal size={15} /> 4. Live JSON-RPC Inspector
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety')}
        >
          <Shield size={15} /> 5. Security & Safety Audit
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 1: ARCHITECTURE & CONCEPTS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'arch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Model Context Protocol (MCP) Roles & Execution Boundary
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              MCP is an open standard socket for connecting AI models to tools and data sources. It decouples the intelligence layer from external capabilities.
            </p>

            <div className="arch-card-grid">
              {/* Node 1: Host Application */}
              <div className="arch-node-card">
                <span className="arch-node-badge host">ROLE 1: HOST APPLICATION</span>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  AI Application & LLM Core
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Runs the AI Model (Ollama / Local model). Manages user interface, conversation history, decision reasoning loop, and context window.
                </p>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11.5px', color: '#818CF8' }}>
                  <strong>Key Fact:</strong> The AI model ALWAYS runs inside the Host.
                </div>
              </div>

              {/* Node 2: MCP Client */}
              <div className="arch-node-card">
                <span className="arch-node-badge client">ROLE 2: MCP CLIENT</span>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Protocol Socket Adapter
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Initiates transport connection (stdio / HTTP). Executes JSON-RPC <code>initialize</code> handshake, issues <code>tools/list</code> for dynamic discovery, and formats <code>tools/call</code> requests.
                </p>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11.5px', color: '#34D399' }}>
                  <strong>Protocol:</strong> JSON-RPC 2.0 messages over Stdio / SSE.
                </div>
              </div>

              {/* Node 3: MCP Server */}
              <div className="arch-node-card">
                <span className="arch-node-badge server">ROLE 3: MCP SERVER</span>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Domain Capability Provider
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Exposes tools, database access, and resources. Executes operations when called. <strong>Does NOT run the AI model.</strong>
                </p>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11.5px', color: '#22D3EE' }}>
                  <strong>Pluggable:</strong> Any team can expose an MCP server for reuse.
                </div>
              </div>
            </div>
          </div>

          {/* Mentor Q&A Box */}
          <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#06B6D4', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={18} /> Mentor Review Plain Explanation Guide
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Q1: Where does the AI actually run?
                </div>
                <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  On YOUR side (the Host), never on the tool server. The server just offers tools; it has no idea which AI is calling.
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Q2: Does MCP make my AI smarter?
                </div>
                <div style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  No — it is standard plumbing. It wins on reuse and easy swapping, not answer quality.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 2: MCP SERVERS & TOOL DISCOVERY */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'servers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active MCP Servers List */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active MCP Servers ({mcpServers.length})
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Connected servers hosting domain tools for Tracks A-F plus custom third-party sockets.
                </p>
              </div>

              <button
                onClick={() => setShowRegisterModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
                  color: '#FFF',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Register MCP Server
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {mcpServers.map((srv) => (
                <div key={srv.server_id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {srv.name}
                    </span>
                    <span style={{ fontSize: '10.5px', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {srv.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', height: '36px', overflow: 'hidden' }}>
                    {srv.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-dark)' }}>
                    <span>Track: {srv.track_code ? `Track ${srv.track_code}` : 'Custom'}</span>
                    <span>Tools: {srv.tools_count}</span>
                    <button
                      onClick={() => handlePerformHandshake(srv.server_id)}
                      style={{ background: 'transparent', border: 'none', color: '#06B6D4', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Handshake →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {handshakeData && (
              <div style={{ marginTop: '16px', background: '#06090E', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                <strong style={{ color: '#34D399' }}>RAW HANDSHAKE RESULT FOR {handshakeData.server_id}:</strong>
                <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap', color: '#60A5FA' }}>
                  {JSON.stringify(handshakeData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Dynamic Tool Discovery Table (tools/list) */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Dynamic Tool Discovery Table (JSON-RPC <code>tools/list</code>)
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Tools discovered dynamically at runtime without hardcoded schemas in agent code.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>Tool Name</th>
                    <th style={{ padding: '10px' }}>MCP Server</th>
                    <th style={{ padding: '10px' }}>Track</th>
                    <th style={{ padding: '10px' }}>Description</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {discoveredTools.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#06B6D4' }}>
                        {t.name}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{t.server_name}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                          {t.track_code ? `Track ${t.track_code}` : 'Custom'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{t.description}</td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => {
                            setSelectedToolToCall(t.name);
                            if (t.name.includes('ticket')) setToolArgsJson('{"order_id": "#90214"}');
                            else if (t.name.includes('allergen')) setToolArgsJson('{"ingredient": "Almond flour"}');
                            else if (t.name.includes('hr')) setToolArgsJson('{"policy_topic": "parental_leave"}');
                            else if (t.name.includes('coverage')) setToolArgsJson('{"policy_number": "POL-8821"}');
                            else setToolArgsJson('{"query": "ERR-4032"}');
                          }}
                          style={{
                            background: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            color: '#06B6D4',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            cursor: 'pointer'
                          }}
                        >
                          Select for Test
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Tool Execution Tester (tools/call) */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
              Direct MCP Tool Execution Tester (JSON-RPC <code>tools/call</code>)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Selected Discovered Tool:</label>
                <select
                  value={selectedToolToCall}
                  onChange={(e) => setSelectedToolToCall(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '12px'
                  }}
                >
                  {discoveredTools.map((t, idx) => (
                    <option key={idx} value={t.name} style={{ background: '#111827' }}>
                      {t.name} ({t.server_name})
                    </option>
                  ))}
                </select>

                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Tool Input Arguments (JSON):</label>
                <textarea
                  rows={4}
                  value={toolArgsJson}
                  onChange={(e) => setToolArgsJson(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#06090E',
                    border: '1px solid var(--border-subtle)',
                    color: '#34D399',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12.5px',
                    marginBottom: '12px'
                  }}
                />

                <button
                  onClick={handleCallToolDirectly}
                  disabled={isCallingTool}
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFF',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {isCallingTool ? 'Calling Tool over MCP...' : 'Execute tools/call over MCP'}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Raw MCP JSON-RPC Output:</label>
                <div style={{ background: '#06090E', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', minHeight: '180px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {toolCallResult ? (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#60A5FA' }}>
                      {JSON.stringify(toolCallResult, null, 2)}
                    </pre>
                  ) : (
                    <span style={{ color: 'var(--text-dark)' }}>No tool call executed yet. Click button to invoke over MCP socket.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 3: MCP REACT AGENT LAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'agent_lab' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              MCP Dynamic Tool Discovery Agent Lab
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Run ReAct Agent using tools discovered dynamically over MCP. Toggle 2nd server to verify zero agent code changes!
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Domain Track:</label>
                <select
                  value={labTrackCode}
                  onChange={(e: any) => setLabTrackCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontWeight: 600
                  }}
                >
                  <option value="A" style={{ background: '#111827' }}>Track A: Customer Support</option>
                  <option value="B" style={{ background: '#111827' }}>Track B: Recipes & Food</option>
                  <option value="C" style={{ background: '#111827' }}>Track C: HR Policy</option>
                  <option value="D" style={{ background: '#111827' }}>Track D: Insurance Claims</option>
                  <option value="E" style={{ background: '#111827' }}>Track E: Developer Docs</option>
                  <option value="F" style={{ background: '#111827' }}>Track F: Legal Contracts</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>User Query:</label>
                <input
                  type="text"
                  value={labQuery}
                  onChange={(e) => setLabQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Mentor Verification Checklist Toggle */}
            <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#EAB308' }}>
                  Mentor Check: Add 2nd MCP Server without changing Agent Code
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Plugs in 'Global Analytics & Compliance MCP Server' dynamically. Agent re-discovers tools over MCP and invokes it with 0 code change.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={includeSecondServer}
                  onChange={(e) => setIncludeSecondServer(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#06B6D4' }}
                />
                Plug 2nd Server
              </label>
            </div>

            <button
              onClick={handleRunAgentMcp}
              disabled={isExecutingAgent}
              style={{
                background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
                color: '#FFF',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <Zap size={16} /> {isExecutingAgent ? 'Running Agent over MCP Socket...' : 'Run Agent over MCP'}
            </button>
          </div>

          {/* Step Trajectory Viewer */}
          {agentRunResult && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Visible Agent Trajectory via MCP Sockets ({agentRunResult.total_steps} Steps)
                </h3>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Discovered Tools: <strong>{agentRunResult.discovered_tools_count}</strong></span>
                  <span>Latency: <strong>{agentRunResult.total_latency_ms}ms</strong></span>
                  <span>Cost: <strong>${agentRunResult.cost_dollars}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {agentRunResult.steps.map((step: any, idx: number) => (
                  <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#06B6D4' }}>Step {step.step_index} — MCP Server: {step.mcp_server}</span>
                      <span style={{ color: 'var(--text-dark)' }}>{step.timestamp} ({step.latency_ms}ms)</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <strong>Thought:</strong> {step.thought}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#818CF8', marginBottom: '4px' }}>
                      <strong>Action Tool:</strong> <code>{step.action_tool}</code> ({step.tool_input})
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#34D399', background: '#06090E', padding: '8px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}>
                      <strong>Observation:</strong> {step.observation}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '14px', fontSize: '13px' }}>
                <strong style={{ color: '#34D399' }}>[FINAL ANSWER]:</strong> {agentRunResult.final_answer}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 4: LIVE JSON-RPC INSPECTOR */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'inspector' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Live MCP JSON-RPC Protocol Message Inspector
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Real-time raw message stream showing initialize handshakes, tools/list discovery, and tools/call payloads.
              </p>
            </div>
            <button
              onClick={fetchProtocolLogs}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Refresh Log Stream
            </button>
          </div>

          <div className="protocol-inspector-box">
            {protocolLogs.length > 0 ? (
              protocolLogs.map((log, idx) => (
                <div key={idx} className="protocol-msg-entry">
                  <div className="protocol-msg-header">
                    <span className={`protocol-dir-tag ${log.direction.toLowerCase()}`}>
                      {log.direction} [{log.server_id}]
                    </span>
                    <span style={{ color: '#818CF8', fontWeight: 600 }}>Method: {log.method}</span>
                    <span style={{ color: 'var(--text-dark)' }}>{log.timestamp}</span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#E5E7EB' }}>
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              ))
            ) : (
              <span style={{ color: 'var(--text-dark)' }}>No protocol messages recorded yet. Execute a tool or run agent to populate live protocol stream.</span>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 5: SECURITY & SAFETY AUDIT */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'safety' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} style={{ color: '#10B981' }} /> MCP Security, Access Control & Safety Bounds
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Keeping it safe: Access control and checking a tool before trusting someone else's server.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  1. Tool Permission Bounds
                </h3>
                <ul style={{ fontSize: '12.5px', color: 'var(--text-muted)', paddingLeft: '18px', lineHeight: '1.7' }}>
                  <li>Read-Only Tools: Auto-approved for agent ReAct loop.</li>
                  <li>Mutating/Write Tools: Require explicit host confirmation.</li>
                  <li>Schema Validation: Input arguments strictly validated against JSON schema.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  2. Sandboxing & Isolation
                </h3>
                <ul style={{ fontSize: '12.5px', color: 'var(--text-muted)', paddingLeft: '18px', lineHeight: '1.7' }}>
                  <li>Process Isolation: Stdio servers run inside unprivileged subprocesses.</li>
                  <li>Host Safety: Server never accesses host LLM weights or memory state.</li>
                  <li>Audit Logging: All <code>tools/call</code> traffic recorded in protocol logs.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Custom Server Modal */}
      {showRegisterModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'left' }}>
            <h2 className="modal-title">Register Custom MCP Server</h2>
            <p className="modal-desc">
              Expose a new tool server to the host agent over MCP JSON-RPC protocol.
            </p>

            <form onSubmit={handleRegisterServer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Server Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regional Analytics Server"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#06090E', border: '1px solid var(--border-subtle)', color: '#FFF' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Track:</label>
                <select
                  value={newServerTrack}
                  onChange={(e) => setNewServerTrack(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#06090E', border: '1px solid var(--border-subtle)', color: '#FFF' }}
                >
                  <option value="A">Track A: Customer Support</option>
                  <option value="B">Track B: Recipes & Food</option>
                  <option value="C">Track C: HR Policy</option>
                  <option value="D">Track D: Insurance Claims</option>
                  <option value="E">Track E: Developer Docs</option>
                  <option value="F">Track F: Legal Contracts</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Description:</label>
                <input
                  type="text"
                  placeholder="Exposes custom domain tools"
                  value={newServerDesc}
                  onChange={(e) => setNewServerDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#06090E', border: '1px solid var(--border-subtle)', color: '#FFF' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Exposed Tool Name:</label>
                <input
                  type="text"
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#06090E', border: '1px solid var(--border-subtle)', color: '#FFF' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tool Description:</label>
                <input
                  type="text"
                  value={newToolDesc}
                  onChange={(e) => setNewToolDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: '#06090E', border: '1px solid var(--border-subtle)', color: '#FFF' }}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#06B6D4', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Register Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
