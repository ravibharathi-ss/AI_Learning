import React, { useState, useEffect } from 'react';
import {
  Users,
  Zap,
  Coins,
  Award,
  RefreshCw,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export const MultiAgentHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'race' | 'squad' | 'resend_cost' | 'frameworks'>('race');
  const [selectedTrack, setSelectedTrack] = useState<string>('A');
  const [squadInfo, setSquadInfo] = useState<any>(null);
  const [agentCards, setAgentCards] = useState<any[]>([]);
  const [frameworksInfo, setFrameworksInfo] = useState<any>(null);

  // Race State
  const [raceQuery, setRaceQuery] = useState<string>('My payment failed on order #90214 with ERR-5001, but the amount was deducted from my bank. Can I get an immediate refund or activation under my Enterprise SLA?');
  const [executionMode, setExecutionMode] = useState<'parallel' | 'sequential'>('parallel');
  const [isRunningRace, setIsRunningRace] = useState<boolean>(false);
  const [raceResult, setRaceResult] = useState<any>(null);

  // A2A Task Simulator State
  const [a2aCaller, setA2aCaller] = useState<string>('support_triage_manager');
  const [a2aTarget, setA2aTarget] = useState<string>('tech_diagnostic_specialist');
  const [a2aTaskDesc, setA2aTaskDesc] = useState<string>('Diagnose stack trace and error code ERR-5001 payment token timeout.');
  const [isSimulatingA2A, setIsSimulatingA2A] = useState<boolean>(false);
  const [a2aTaskResult, setA2aTaskResult] = useState<any>(null);

  useEffect(() => {
    fetchSquadInfo(selectedTrack);
    fetchAgentCards(selectedTrack);
    fetchFrameworksInfo();
  }, [selectedTrack]);

  const fetchSquadInfo = async (track: string) => {
    try {
      const res = await fetch(`${API_BASE}/multi-agent/squad-info?track_code=${track}`);
      if (res.ok) {
        const data = await res.json();
        setSquadInfo(data);
        if (data.sample_benchmarks && data.sample_benchmarks.length > 0) {
          setRaceQuery(data.sample_benchmarks[0].query);
        }
      }
    } catch (e) {
      console.error("Failed to fetch squad info:", e);
    }
  };

  const fetchAgentCards = async (track: string) => {
    try {
      const res = await fetch(`${API_BASE}/a2a/agent-cards?track_code=${track}`);
      if (res.ok) {
        const data = await res.json();
        setAgentCards(data);
      }
    } catch (e) {
      console.error("Failed to fetch AgentCards:", e);
    }
  };

  const fetchFrameworksInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/multi-agent/frameworks-info`);
      if (res.ok) {
        const data = await res.json();
        setFrameworksInfo(data);
      }
    } catch (e) {
      console.error("Failed to fetch frameworks info:", e);
    }
  };

  const handleRunRace = async () => {
    if (!raceQuery.trim()) return;
    setIsRunningRace(true);
    setRaceResult(null);

    try {
      const res = await fetch(`${API_BASE}/multi-agent/race`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: raceQuery,
          track_code: selectedTrack,
          execution_mode: executionMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRaceResult(data);
      }
    } catch (e) {
      console.error("Failed to run race:", e);
    } finally {
      setIsRunningRace(false);
    }
  };

  const handleSimulateA2A = async () => {
    if (!a2aTaskDesc.trim()) return;
    setIsSimulatingA2A(true);
    setA2aTaskResult(null);

    try {
      const res = await fetch(`${API_BASE}/a2a/task/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_agent: a2aCaller,
          target_agent: a2aTarget,
          task_description: a2aTaskDesc
        })
      });

      if (res.ok) {
        const data = await res.json();
        setA2aTaskResult(data);
      }
    } catch (e) {
      console.error("Failed to simulate A2A task:", e);
    } finally {
      setIsSimulatingA2A(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 0' }}>
      
      {/* 1. Header Banner */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #CBD5E1',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #2563EB 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
          }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Week 10 Module 5 · Multi-Agent & A2A Studio
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#EEF2FF',
                color: '#4F46E5',
                border: '1px solid #C7D2FE'
              }}>
                Build Week Deliverable
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0' }}>
              Test whether a team of AIs beats a single one on Quality, Speed, Tokens, and Cost — with evidence, not fashion.
            </p>
          </div>
        </div>

        {/* Track Selector Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', marginRight: '4px' }}>Track:</span>
          {[
            { code: 'A', label: 'A: Support' },
            { code: 'B', label: 'B: Food' },
            { code: 'C', label: 'C: HR' },
            { code: 'D', label: 'D: Claims' },
            { code: 'E', label: 'E: Docs' },
            { code: 'F', label: 'F: Legal' }
          ].map((t) => (
            <button
              key={t.code}
              onClick={() => setSelectedTrack(t.code)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: selectedTrack === t.code ? '#2563EB' : '#FFFFFF',
                color: selectedTrack === t.code ? '#FFFFFF' : '#334155',
                border: selectedTrack === t.code ? '1px solid #2563EB' : '1px solid #CBD5E1',
                boxShadow: selectedTrack === t.code ? '0 2px 6px rgba(37,99,235,0.25)' : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1.5px solid #CBD5E1', paddingBottom: '12px' }}>
        {[
          { id: 'race', label: '1. Single vs Multi-Agent Race', icon: Zap },
          { id: 'squad', label: '2. Squad Architecture & AgentCards', icon: Users },
          { id: 'resend_cost', label: '3. Context Re-Send Cost Breakdown', icon: Coins },
          { id: 'frameworks', label: '4. MCP vs A2A & Frameworks', icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                background: isActive ? '#EEF2FF' : '#FFFFFF',
                color: isActive ? '#2563EB' : '#475569',
                border: isActive ? '1px solid #93C5FD' : '1px solid #CBD5E1',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} style={{ color: isActive ? '#2563EB' : '#64748B' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================
          TAB 1: SINGLE VS MULTI-AGENT RACE (CORE BUILD WEEK DELIVERABLE)
          ======================================================================== */}
      {activeTab === 'race' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Query Control Card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Empirical Benchmark Race: Single Agent vs Squad
                </h3>
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  {squadInfo ? squadInfo.track_name : 'Track'} · Manager plus Two Specialists Squad
                </span>
              </div>

              {/* Execution Mode Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', padding: '4px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', padding: '0 4px' }}>Worker Flow:</span>
                <button
                  onClick={() => setExecutionMode('parallel')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: executionMode === 'parallel' ? '#2563EB' : 'transparent',
                    color: executionMode === 'parallel' ? '#FFFFFF' : '#475569',
                    border: 'none'
                  }}
                >
                  Parallel Workers
                </button>
                <button
                  onClick={() => setExecutionMode('sequential')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    background: executionMode === 'sequential' ? '#2563EB' : 'transparent',
                    color: executionMode === 'sequential' ? '#FFFFFF' : '#475569',
                    border: 'none'
                  }}
                >
                  Sequential Workers
                </button>
              </div>
            </div>

            {/* Benchmark Input */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={raceQuery}
                onChange={(e) => setRaceQuery(e.target.value)}
                placeholder="Enter test customer ticket or domain question..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  border: '1.5px solid #CBD5E1',
                  color: '#0F172A',
                  fontSize: '13.5px'
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRunRace(); }}
              />
              <button
                onClick={handleRunRace}
                disabled={isRunningRace}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.35)'
                }}
              >
                {isRunningRace ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                Run Benchmark Race
              </button>
            </div>

            {/* Quick Sample Queries */}
            {squadInfo && squadInfo.sample_benchmarks && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Preset Benchmark Tickets:</span>
                {squadInfo.sample_benchmarks.map((b: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setRaceQuery(b.query)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    Ticket #{idx + 1}: {b.expected_domain}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Race Results Comparison */}
          {raceResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Verdict Banner Card */}
              <div style={{
                background: raceResult.comparison.winner === 'single_agent' ? '#F0FDF4' : '#EEF2FF',
                border: `1.5px solid ${raceResult.comparison.winner === 'single_agent' ? '#86EFAC' : '#A5B4FC'}`,
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Award size={22} style={{ color: raceResult.comparison.winner === 'single_agent' ? '#16A34A' : '#4F46E5' }} />
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                      Official Verdict: {raceResult.comparison.verdict_badge}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: raceResult.comparison.winner === 'single_agent' ? '#DCFCE7' : '#E0E7FF',
                    color: raceResult.comparison.winner === 'single_agent' ? '#15803D' : '#3730A3'
                  }}>
                    {raceResult.comparison.winner === 'single_agent' ? 'Single Agent Wins' : 'Squad Wins'}
                  </span>
                </div>
                <p style={{ fontSize: '13.5px', color: '#1E293B', lineHeight: '1.6', margin: '0 0 8px 0' }}>
                  {raceResult.comparison.verdict_explanation}
                </p>
                <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '8px' }}>
                  <strong>Mentor Takeaway:</strong> {raceResult.comparison.recommendation}
                </div>
              </div>

              {/* 4 Quantitative Scorecards Matrix */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                
                {/* 1. Quality */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                    1. Quality Score
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>{raceResult.single_agent.quality_score}%</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Single</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#2563EB' }}>{raceResult.multi_agent_team.quality_score}%</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Squad</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: raceResult.comparison.delta_quality_pct > 0 ? '#16A34A' : '#DC2626', fontWeight: '700', marginTop: '6px', display: 'block' }}>
                    Δ Quality: +{raceResult.comparison.delta_quality_pct}%
                  </span>
                </div>

                {/* 2. Speed / Latency */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                    2. Speed (Wall Latency)
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#16A34A' }}>{raceResult.single_agent.latency_sec}s</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Single</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#EA580C' }}>{raceResult.multi_agent_team.latency_sec}s</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Squad</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#EA580C', fontWeight: '700', marginTop: '6px', display: 'block' }}>
                    Overhead: +{raceResult.comparison.delta_latency_sec}s
                  </span>
                </div>

                {/* 3. Tokens Used */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                    3. Tokens Consumed
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>{raceResult.single_agent.total_tokens.toLocaleString()}</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Single</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#7C3AED' }}>{raceResult.multi_agent_team.total_tokens.toLocaleString()}</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Squad</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700', marginTop: '6px', display: 'block' }}>
                    Token Bloat: {raceResult.comparison.token_multiplier}× Re-send
                  </span>
                </div>

                {/* 4. Cost */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                    4. Query Cost ($)
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>${raceResult.single_agent.cost_usd}</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Single</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#DC2626' }}>${raceResult.multi_agent_team.cost_usd}</span>
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '4px' }}>Squad</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700', marginTop: '6px', display: 'block' }}>
                    Cost Ratio: {raceResult.comparison.cost_multiplier}× Expensive
                  </span>
                </div>

              </div>

              {/* Side-by-Side Execution Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                
                {/* Single Agent Column */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A' }}></div>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      Single Monolithic Agent Execution
                    </h4>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '8px', marginBottom: '12px', lineHeight: '1.6' }}>
                    {raceResult.single_agent.answer}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    • Invocations: <strong>1 LLM Call</strong><br />
                    • Input Tokens: {raceResult.single_agent.input_tokens} | Output Tokens: {raceResult.single_agent.output_tokens}
                  </div>
                </div>

                {/* Multi-Agent Squad Column */}
                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB' }}></div>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      Squad Trace (Manager + 2 Specialists)
                    </h4>
                  </div>
                  
                  {/* Step list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {raceResult.multi_agent_team.steps.map((st: any) => (
                      <div key={st.step} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563EB', fontWeight: '700', marginBottom: '2px' }}>
                          <span>Step {st.step}: {st.agent}</span>
                          <span style={{ color: '#64748B', fontSize: '11px' }}>{st.tokens_used} tokens</span>
                        </div>
                        <div style={{ color: '#334155' }}>{st.summary}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    • Invocations: <strong>4 Total Calls</strong> (1 Manager Decomp + 2 Specialists + 1 Manager Merge)<br />
                    • Execution Model: <strong>{raceResult.multi_agent_team.execution_mode.toUpperCase()}</strong>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================
          TAB 2: SQUAD ARCHITECTURE & A2A AGENTCARDS
          ======================================================================== */}
      {activeTab === 'squad' && squadInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Architecture Visual Diagram */}
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
              Orchestrator–Worker Squad Topology
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 20px 0' }}>
              One central manager splits work into narrow subtasks, delegates to specialists, and synthesizes the unified answer.
            </p>

            {/* Tree Diagram */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              
              {/* Manager Node */}
              <div style={{
                background: '#EEF2FF',
                border: '1.5px solid #818CF8',
                borderRadius: '12px',
                padding: '16px 24px',
                textAlign: 'center',
                maxWidth: '440px',
                boxShadow: '0 2px 6px rgba(99,102,241,0.15)'
              }}>
                <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4F46E5', display: 'block', marginBottom: '4px' }}>
                  Tier 1: Central Orchestrator
                </span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', display: 'block' }}>
                  {squadInfo.manager.role}
                </span>
                <p style={{ fontSize: '12px', color: '#475569', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  {squadInfo.manager.goal}
                </p>
              </div>

              {/* Connecting Arrows */}
              <div style={{ display: 'flex', width: '320px', justifyContent: 'space-around', color: '#818CF8' }}>
                <span>↙ A2A Protocol</span>
                <span>↘ A2A Protocol</span>
              </div>

              {/* Specialist Nodes Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%', maxWidth: '780px' }}>
                
                {/* Specialist 1 */}
                <div style={{ background: '#F0FDFA', border: '1.5px solid #5EEAD4', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#0D9488', display: 'block', marginBottom: '4px' }}>
                    Specialist 1: Domain Specialist
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'block' }}>
                    {squadInfo.specialist_1.role}
                  </span>
                  <p style={{ fontSize: '12px', color: '#475569', margin: '6px 0 10px 0', lineHeight: '1.4' }}>
                    {squadInfo.specialist_1.goal}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {squadInfo.specialist_1.tools.map((t: string) => (
                      <span key={t} style={{ fontSize: '10.5px', background: '#CCFBF1', color: '#115E59', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        {t}()
                      </span>
                    ))}
                  </div>
                </div>

                {/* Specialist 2 */}
                <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#D97706', display: 'block', marginBottom: '4px' }}>
                    Specialist 2: Policy & Compliance
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'block' }}>
                    {squadInfo.specialist_2.role}
                  </span>
                  <p style={{ fontSize: '12px', color: '#475569', margin: '6px 0 10px 0', lineHeight: '1.4' }}>
                    {squadInfo.specialist_2.goal}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {squadInfo.specialist_2.tools.map((t: string) => (
                      <span key={t} style={{ fontSize: '10.5px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        {t}()
                      </span>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* A2A AgentCard Discovery Inspector */}
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  A2A Protocol AgentCards (JSON Discovery Metadata)
                </h3>
                <p style={{ fontSize: '12.5px', color: '#475569', margin: '2px 0 0 0' }}>
                  Standardized AgentCards allow autonomous agents to discover capabilities, protocol version, and skills dynamically.
                </p>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#334155' }}>
                Standard: A2A/v1.0
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {agentCards.map((card, idx) => (
                <div key={idx} style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: '10px', padding: '14px', fontFamily: 'monospace', fontSize: '12px', color: '#E2E8F0', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: '700' }}>{card.name}.json</span>
                    <span style={{ color: '#A5B4FC', fontSize: '10.5px' }}>{card.protocol}</span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.45', color: '#94A3B8' }}>
                    {JSON.stringify(card, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* A2A Task Lifecycle Simulator */}
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
              A2A Task Lifecycle Simulator: submitted → working → completed
            </h3>
            <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 16px 0' }}>
              Test autonomous task delegation over the A2A wire protocol between the Orchestrator and a remote Specialist.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>Caller Agent:</label>
                <input
                  type="text"
                  value={a2aCaller}
                  onChange={(e) => setA2aCaller(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>Target Remote Agent:</label>
                <input
                  type="text"
                  value={a2aTarget}
                  onChange={(e) => setA2aTarget(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>Task Description Payload:</label>
              <input
                type="text"
                value={a2aTaskDesc}
                onChange={(e) => setA2aTaskDesc(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12.5px' }}
              />
            </div>

            <button
              onClick={handleSimulateA2A}
              disabled={isSimulatingA2A}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {isSimulatingA2A ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
              Simulate A2A Task Handshake
            </button>

            {/* A2A Logs Output */}
            {a2aTaskResult && (
              <div style={{ marginTop: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                    Task ID: {a2aTaskResult.task_id}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: '#DCFCE7', color: '#16A34A' }}>
                    State: {a2aTaskResult.final_state.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {a2aTaskResult.lifecycle_logs.map((log: any, i: number) => (
                    <div key={i} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563EB', fontWeight: '700', marginBottom: '2px' }}>
                        <span>Phase: {log.state.toUpperCase()}</span>
                        <span style={{ fontSize: '10px', color: '#64748B' }}>{log.timestamp}</span>
                      </div>
                      <div style={{ color: '#334155' }}>{log.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================
          TAB 3: CONTEXT RE-SEND COST BREAKDOWN
          ======================================================================== */}
      {activeTab === 'resend_cost' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px 0' }}>
              The Hidden Multi-Agent Cost: Context Re-Send Tax
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Why do teams of agents get expensive fast? Because every hand-off between agents re-sends the system instructions, conversation history, and prior outputs.
            </p>

            {/* Visual Token Multiplier Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              
              {/* Single Agent Bar */}
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#16A34A', display: 'block', marginBottom: '4px' }}>
                  Single Agent: 1 Invocations (~1,250 Tokens)
                </span>
                <div style={{ height: '32px', background: '#DCFCE7', borderRadius: '6px', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '12px', fontWeight: '700', color: '#15803D' }}>
                  Direct Single Prompt + Context (1× Baseline)
                </div>
                <p style={{ fontSize: '11.5px', color: '#64748B', marginTop: '8px', lineHeight: '1.4' }}>
                  Zero hand-off overhead. The LLM sees the prompt once and produces the answer directly.
                </p>
              </div>

              {/* Multi-Agent Squad Bar */}
              <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#DC2626', display: 'block', marginBottom: '4px' }}>
                  Squad Team: 4 Invocations (~4,650 Tokens — 3.7× Bloat!)
                </span>
                <div style={{ display: 'flex', gap: '3px', height: '32px' }}>
                  <div style={{ flex: 1, background: '#DDD6FE', borderRadius: '4px', border: '1px solid #C4B5FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#5B21B6' }}>
                    Manager (15%)
                  </div>
                  <div style={{ flex: 1.2, background: '#CCFBF1', borderRadius: '4px', border: '1px solid #99F6E4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#0F766E' }}>
                    Spec 1 (25%)
                  </div>
                  <div style={{ flex: 1.2, background: '#FEF3C7', borderRadius: '4px', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#B45309' }}>
                    Spec 2 (25%)
                  </div>
                  <div style={{ flex: 1.6, background: '#FED7AA', borderRadius: '4px', border: '1px solid #FDBA74', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#C2410C' }}>
                    Merge (35%)
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: '#64748B', marginTop: '8px', lineHeight: '1.4' }}>
                  The final manager merge call re-sends the original query + all Specialist 1 findings + all Specialist 2 findings.
                </p>
              </div>

            </div>

            {/* 3 Context Passing Strategies Table */}
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 10px 0' }}>
              Context Passing Strategies (How to Mitigate the Tax)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', borderBottom: '1.5px solid #CBD5E1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700' }}>Strategy</th>
                    <th style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700' }}>How It Works</th>
                    <th style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700' }}>Token Overhead</th>
                    <th style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700' }}>Risk / Trade-off</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#DC2626' }}>Full Context Re-Send</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>Passes full 50-message history & all prior tool outputs to every specialist.</td>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#DC2626' }}>Highest (3× to 6×)</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>Extreme cost, slow latency, context window exhaustion.</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#D97706' }}>Relevant Context Window</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>Orchestrator filters and passes only the specific paragraph needed by that specialist.</td>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#D97706' }}>Medium (1.8× to 2.5×)</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>Requires good routing prompt so critical clues aren't lost.</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#16A34A' }}>Structured State (Recommended)</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>Agents exchange clean JSON dictionaries with ID keys rather than conversational essays.</td>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#16A34A' }}>Lowest (1.2× to 1.5×)</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>Requires structured schema enforcement (Pydantic / Instructor).</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================
          TAB 4: MCP VS A2A & FRAMEWORKS (CREWAI VS AUTOGEN)
          ======================================================================== */}
      {activeTab === 'frameworks' && frameworksInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* MCP vs A2A Comparison Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
              {frameworksInfo.mcp_vs_a2a.title}
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0' }}>
              {frameworksInfo.mcp_vs_a2a.summary}
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', borderBottom: '1.5px solid #CBD5E1', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700' }}>Dimension</th>
                  <th style={{ padding: '10px 14px', color: '#0284C7', fontWeight: '700' }}>MCP (Model Context Protocol)</th>
                  <th style={{ padding: '10px 14px', color: '#7C3AED', fontWeight: '700' }}>A2A (Agent2Agent Protocol)</th>
                </tr>
              </thead>
              <tbody>
                {frameworksInfo.mcp_vs_a2a.rows.map((r: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0F172A' }}>{r.dimension}</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{r.mcp}</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{r.a2a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CrewAI vs AutoGen Comparison Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
              {frameworksInfo.crewai_vs_autogen.title}
            </h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0' }}>
              {frameworksInfo.crewai_vs_autogen.summary}
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', borderBottom: '1.5px solid #CBD5E1', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700' }}>Aspect</th>
                  <th style={{ padding: '10px 14px', color: '#EA580C', fontWeight: '700' }}>CrewAI</th>
                  <th style={{ padding: '10px 14px', color: '#2563EB', fontWeight: '700' }}>AutoGen</th>
                </tr>
              </thead>
              <tbody>
                {frameworksInfo.crewai_vs_autogen.rows.map((r: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0F172A' }}>{r.aspect}</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{r.crewai}</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{r.autogen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* When Multi-Agent Helps vs Hurts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '18px' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: '#166534', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> When Multi-Agent Genuinely Helps
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '12px', color: '#14532D', lineHeight: '1.6' }}>
                {frameworksInfo.when_multiagent_helps.map((h: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{h}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '18px' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: '#991B1B', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} /> When Multi-Agent Does NOT Help
              </h4>
              <ul style={{ paddingLeft: '18px', fontSize: '12px', color: '#7F1D1D', lineHeight: '1.6' }}>
                {frameworksInfo.when_multiagent_hurts.map((h: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{h}</li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
