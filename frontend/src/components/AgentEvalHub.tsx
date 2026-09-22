import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Target,
  Award,
  Zap,
  Lock,
  Unlock,
  Layers
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export const AgentEvalHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'security_lab' | 'taxonomy' | 'benchmark'>('inspector');

  // Trajectory Gap Inspector State
  const [trackCode, setTrackCode] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F'>('A');
  const [trajectoryMode, setTrajectoryMode] = useState<'aligned' | 'lucky_gap' | 'loop_failure'>('lucky_gap');
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  // Security Lab State
  const [attackType, setAttackType] = useState<'indirect' | 'direct'>('indirect');
  const [defenseEnabled, setDefenseEnabled] = useState(false);
  const [securityResult, setSecurityResult] = useState<any>(null);
  const [isTestingSecurity, setIsTestingSecurity] = useState(false);

  // Taxonomy State
  const [taxonomyData, setTaxonomyData] = useState<any[]>([]);

  // Benchmark State
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  useEffect(() => {
    fetchTaxonomy();
    handleInspectTrajectory();
  }, []);

  const fetchTaxonomy = async () => {
    try {
      const res = await fetch(`${API_BASE}/agent-eval/failure-modes`);
      if (res.ok) {
        const data = await res.json();
        setTaxonomyData(data);
      }
    } catch (e) {
      console.error("Failed to fetch taxonomy:", e);
    }
  };

  const handleInspectTrajectory = async () => {
    setIsInspecting(true);
    let trajectory: string[] = [];
    let answer = "";

    if (trackCode === "A") {
      trajectory = trajectoryMode === "aligned" 
        ? ["lookup_ticket_db", "check_return_policy", "calculate_refund_amount"]
        : trajectoryMode === "lucky_gap"
        ? ["calculate_refund_amount"] // Skipped checks
        : ["lookup_ticket_db", "lookup_ticket_db", "lookup_ticket_db"];
      answer = "Under Final Sale rules, refund amount is $0.00.";
    } else if (trackCode === "B") {
      trajectory = trajectoryMode === "aligned"
        ? ["check_ingredient_allergens", "search_substitutes", "scale_recipe"]
        : ["scale_recipe"];
      answer = "Direct 1:1 almond flour substitution fails; max recommended is 25% with binding agents.";
    } else {
      trajectory = trajectoryMode === "aligned"
        ? ["query_hr_policy_db", "check_tenure_eligibility", "calculate_parental_leave_days"]
        : ["calculate_parental_leave_days"];
      answer = "Full-time employees with 2 years tenure receive 60 paid business days (480 total paid hours).";
    }

    try {
      const res = await fetch(`${API_BASE}/agent-eval/inspect-trajectory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: "Verify request and compute entitlement or refund amount.",
          actual_trajectory: trajectory,
          final_answer: answer,
          track_code: trackCode
        })
      });

      if (res.ok) {
        const data = await res.json();
        setInspectResult(data);
      }
    } catch (e) {
      console.error("Trajectory inspection failed:", e);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleTestSecurity = async () => {
    setIsTestingSecurity(true);
    try {
      const res = await fetch(`${API_BASE}/agent-eval/prompt-injection/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attack_type: attackType,
          track_code: trackCode,
          defense_enabled: defenseEnabled
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSecurityResult(data);
      }
    } catch (e) {
      console.error("Security test failed:", e);
    } finally {
      setIsTestingSecurity(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true);
    try {
      const res = await fetch(`${API_BASE}/agent-eval/benchmark`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarkData(data);
      }
    } catch (e) {
      console.error("Benchmark failed:", e);
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  return (
    <div className="mcp-hub-container">
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px', borderRadius: '10px' }}>
            <AlertTriangle size={24} style={{ color: '#EF4444' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Week 8 Module 4 — Agent Failure Modes & Trajectory Evals
            </h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Detect Lucky Right Answers (Outcome vs Trajectory Gap), defend against Indirect Prompt Injections, & measure failure rate reduction.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunBenchmark}
          style={{
            background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
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
          <Zap size={14} /> {isRunningBenchmark ? 'Measuring Improvement...' : 'Run Mitigation Benchmark'}
        </button>
      </div>

      {/* Navigation Pills */}
      <div className="mcp-nav-pills">
        <button
          className={`mcp-pill-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspector')}
        >
          <Target size={15} /> 1. Trajectory & Gap Inspector
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'security_lab' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('security_lab');
            handleTestSecurity();
          }}
        >
          <ShieldAlert size={15} /> 2. Prompt Injection Security Lab
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'taxonomy' ? 'active' : ''}`}
          onClick={() => setActiveTab('taxonomy')}
        >
          <Layers size={15} /> 3. Failure Mode Taxonomy
        </button>
        <button
          className={`mcp-pill-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('benchmark');
            if (!benchmarkData) handleRunBenchmark();
          }}
        >
          <Award size={15} /> 4. Before-and-After Benchmark
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 1: TRAJECTORY & GAP INSPECTOR */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'inspector' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Outcome vs Trajectory Gap Inspector
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              "If the answer is right, why care how it got there? A right answer reached by luck won't stay right."
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Domain Track:</label>
                <select
                  value={trackCode}
                  onChange={(e: any) => setTrackCode(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-subtle)', color: 'FFF' }}
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
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Trajectory Simulation Mode:</label>
                <select
                  value={trajectoryMode}
                  onChange={(e: any) => setTrajectoryMode(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-subtle)', color: 'FFF' }}
                >
                  <option value="lucky_gap" style={{ background: '#111827' }}>Lucky Right Answer (Skipped Tools / Wrong Sequence)</option>
                  <option value="aligned" style={{ background: '#111827' }}>Valid Aligned Trajectory (3-Step Pipeline)</option>
                  <option value="loop_failure" style={{ background: '#111827' }}>Loop Failure (Repeated Tool Calls)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={handleInspectTrajectory}
                  disabled={isInspecting}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
                    color: '#FFF',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isInspecting ? 'Evaluating Trajectory...' : 'Inspect Outcome vs Trajectory'}
                </button>
              </div>
            </div>

            {/* Inspection Results Card */}
            {inspectResult && (
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Classification: <span style={{ color: inspectResult.outcome_vs_trajectory_gap ? '#EF4444' : '#10B981' }}>{inspectResult.gap_classification}</span>
                  </span>
                  <span style={{ fontSize: '12px', background: 'rgba(255, 255, 255, 0.08)', padding: '4px 10px', borderRadius: '6px' }}>
                    Tool Choice Accuracy: {inspectResult.tool_choice_accuracy_pct}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', marginBottom: '14px' }}>
                  <div style={{ background: '#06090E', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#818CF8', marginBottom: '4px' }}>Expected Tool Workflow:</div>
                    <code>{JSON.stringify(inspectResult.expected_sequence)}</code>
                  </div>
                  <div style={{ background: '#06090E', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: inspectResult.sequence_aligned ? '#34D399' : '#F87171', marginBottom: '4px' }}>
                      Actual Agent Trajectory:
                    </div>
                    <code>{JSON.stringify(inspectResult.actual_trajectory)}</code>
                  </div>
                </div>

                <div style={{ background: inspectResult.outcome_vs_trajectory_gap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${inspectResult.outcome_vs_trajectory_gap ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, borderRadius: '10px', padding: '14px', fontSize: '13px' }}>
                  <strong style={{ color: inspectResult.outcome_vs_trajectory_gap ? '#F87171' : '#34D399' }}>Analysis Verdict:</strong> {inspectResult.explanation}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 2: PROMPT INJECTION SECURITY LAB */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'security_lab' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Prompt Injection & Security Guardrails Lab
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Test Direct Prompt Hijacking and Indirect Prompt Injection hidden inside retrieved documents/notes.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Attack Vector:</label>
                <select
                  value={attackType}
                  onChange={(e: any) => setAttackType(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-subtle)', color: 'FFF' }}
                >
                  <option value="indirect" style={{ background: '#111827' }}>Indirect Document Injection (Malicious text inside docs)</option>
                  <option value="direct" style={{ background: '#111827' }}>Direct Prompt Hijacking (Malicious user query)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Defense Guardrails:</label>
                <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                  <button
                    onClick={() => setDefenseEnabled(!defenseEnabled)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      background: defenseEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${defenseEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      color: defenseEnabled ? '#34D399' : '#F87171',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {defenseEnabled ? <Lock size={16} /> : <Unlock size={16} />}
                    {defenseEnabled ? 'PROTECTED (Defense Active)' : 'UNPROTECTED (Vulnerable)'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={handleTestSecurity}
                  disabled={isTestingSecurity}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
                    color: '#FFF',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isTestingSecurity ? 'Simulating Attack...' : 'Simulate Attack Vector'}
                </button>
              </div>
            </div>

            {/* Security Simulation Result */}
            {securityResult && (
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Attack Outcome: <span style={{ color: securityResult.attack_successful ? '#EF4444' : '#10B981' }}>
                      {securityResult.attack_successful ? 'HIJACK SUCCESSFUL (Vulnerable)' : 'ATTACK BLOCKED (Protected)'}
                    </span>
                  </span>
                  <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '4px' }}>
                    {securityResult.owasp_category}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12.5px', marginBottom: '14px' }}>
                  <div style={{ background: '#06090E', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#F87171', marginBottom: '4px' }}>Retrieved Context (Contains Injection):</div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#E5E7EB', fontSize: '11.5px' }}>
                      {securityResult.retrieved_doc_context}
                    </pre>
                  </div>

                  <div style={{ background: '#06090E', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: securityResult.attack_successful ? '#F87171' : '#34D399', marginBottom: '4px' }}>
                      Final Agent Output Response:
                    </div>
                    <div style={{ color: '#E5E7EB', fontSize: '12px' }}>
                      {securityResult.final_agent_response}
                    </div>
                  </div>
                </div>

                <div style={{ background: securityResult.attack_successful ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${securityResult.attack_successful ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, borderRadius: '10px', padding: '12px', fontSize: '12.5px' }}>
                  <strong>Security Analysis:</strong> {securityResult.security_recommendation}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 3: FAILURE MODE TAXONOMY */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'taxonomy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Agent Failure Modes Taxonomy & Remedies
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              The 5 primary failure patterns observed in autonomous AI agents.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {taxonomyData.map((fm) => (
                <div key={fm.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {fm.name}
                    </span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, background: fm.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)', color: fm.severity === 'CRITICAL' ? '#F87171' : '#FBBF24' }}>
                      {fm.severity}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
                    {fm.description}
                  </p>

                  <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11.5px', color: '#06B6D4' }}>
                    <strong>Recommended Remedy:</strong> {fm.remedy}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SUB-TAB 4: BEFORE-AND-AFTER BENCHMARK */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'benchmark' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Before-and-After Improvement Benchmark
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Answers mentor review: "Is there a before-and-after number on their top failure?"
            </p>

            {benchmarkData && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#F87171', textTransform: 'uppercase', fontWeight: 700 }}>Baseline Failure Rate</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#F87171', marginTop: '4px' }}>{benchmarkData.baseline_failure_rate_pct}%</div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#34D399', textTransform: 'uppercase', fontWeight: 700 }}>Mitigated Failure Rate</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#34D399', marginTop: '4px' }}>{benchmarkData.post_mitigation_failure_rate_pct}%</div>
                  </div>

                  <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#22D3EE', textTransform: 'uppercase', fontWeight: 700 }}>Failure Reduction</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#22D3EE', marginTop: '4px' }}>-{benchmarkData.failure_rate_reduction_pct}%</div>
                  </div>

                  <div style={{ background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#818CF8', textTransform: 'uppercase', fontWeight: 700 }}>Total Cases Tested</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#818CF8', marginTop: '4px' }}>{benchmarkData.total_cases_tested}</div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px' }}>Track</th>
                        <th style={{ padding: '10px' }}>Domain Topic</th>
                        <th style={{ padding: '10px' }}>Baseline Fail %</th>
                        <th style={{ padding: '10px' }}>Mitigated Fail %</th>
                        <th style={{ padding: '10px' }}>Closed Failure Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkData.track_results.map((r: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px', fontWeight: 700, color: '#06B6D4' }}>Track {r.track_code}</td>
                          <td style={{ padding: '10px', color: 'var(--text-primary)' }}>{r.track_name}</td>
                          <td style={{ padding: '10px', color: '#F87171', fontWeight: 700 }}>{r.baseline_failure_rate_pct}%</td>
                          <td style={{ padding: '10px', color: '#34D399', fontWeight: 700 }}>{r.post_mitigation_failure_rate_pct}%</td>
                          <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>{r.top_mode_closed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
