import React, { useState } from 'react';
import {
  MessageSquare,
  BookOpen,
  Search,
  AlertTriangle,
  Scale,
  Zap,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Bot,
  ShieldCheck
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  agent_type: string;
  created_at: string;
}

interface SidebarProps {
  currentView: 'chat' | 'kb' | 'debugger' | 'error_analysis' | 'judge_eval' | 'agent_loops' | 'mcp_hub';
  setCurrentView: (view: 'chat' | 'kb' | 'debugger' | 'error_analysis' | 'judge_eval' | 'agent_loops' | 'mcp_hub') => void;
  conversations: Conversation[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onConfirmDelete: (e: React.MouseEvent, id: string) => void;
  backendHealth: { status: string; mode?: string; model?: string } | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewConversation,
  onConfirmDelete,
  backendHealth
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-logo">
            <Bot size={20} className="text-indigo-600" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="sidebar-brand-title">AI Master Agent</h1>
              <div className="sidebar-brand-status">
                <span className="status-dot-pulse"></span>
                <span>{backendHealth?.status === 'healthy' ? 'Ollama Active' : 'Online'}</span>
              </div>
            </div>
          )}
        </div>

        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Modules Section */}
      <div className="sidebar-content">
        <div className="sidebar-section-title">Core Engine Modules</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          
          {/* 1. Live Chat */}
          <button
            className={`nav-item-btn ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentView('chat')}
            title="Live Customer Support Chat"
          >
            <MessageSquare size={18} />
            <span className="nav-item-text">Live Chat</span>
          </button>

          {/* 2. Knowledge Base */}
          <button
            className={`nav-item-btn ${currentView === 'kb' ? 'active' : ''}`}
            onClick={() => setCurrentView('kb')}
            title="RAG Vector Store Knowledge Base"
          >
            <BookOpen size={18} />
            <span className="nav-item-text">Knowledge Base</span>
          </button>

          {/* 3. RAG Debugger */}
          <button
            className={`nav-item-btn ${currentView === 'debugger' ? 'active' : ''}`}
            onClick={() => setCurrentView('debugger')}
            title="Week 4 Hybrid Retrieval & Chunk Debugger"
          >
            <Search size={18} />
            <span className="nav-item-text">RAG Debugger</span>
            <span className="nav-badge">W4</span>
          </button>

          {/* 4. Error Analysis */}
          <button
            className={`nav-item-btn ${currentView === 'error_analysis' ? 'active' : ''}`}
            onClick={() => setCurrentView('error_analysis')}
            title="Week 5 Failure Taxonomy & Tracing"
          >
            <AlertTriangle size={18} />
            <span className="nav-item-text">Error Analysis</span>
            <span className="nav-badge">W5</span>
          </button>

          {/* 5. Legal Clause Judge */}
          <button
            className={`nav-item-btn ${currentView === 'judge_eval' ? 'active' : ''}`}
            onClick={() => setCurrentView('judge_eval')}
            title="Week 6 Legal Contract Clause Judge Validation"
          >
            <Scale size={18} />
            <span className="nav-item-text">Legal Judge</span>
            <span className="nav-badge">W6</span>
          </button>

          {/* 6. Agent Loops & Race */}
          <button
            className={`nav-item-btn sidebar-nav-tab active-agent ${currentView === 'agent_loops' ? 'active' : ''}`}
            onClick={() => setCurrentView('agent_loops')}
            title="Week 7 Agent vs Fixed Workflow Benchmark Race"
          >
            <Zap size={18} />
            <span className="nav-item-text">Agent Loops</span>
            <span className="nav-badge">W7</span>
          </button>

          {/* 7. Week 9 MCP Studio */}
          <button
            className={`nav-item-btn sidebar-nav-tab active-mcp ${currentView === 'mcp_hub' ? 'active' : ''}`}
            onClick={() => setCurrentView('mcp_hub')}
            title="Week 9 MCP, Multi-Agent & A2A Tool Discovery Studio"
          >
            <Cpu size={18} />
            <span className="nav-item-text">MCP Studio</span>
            <span className="nav-badge" style={{ background: '#06B6D4', color: '#000' }}>W9 NEW</span>
          </button>
        </div>

        {/* Conversations History List (When Chat View is Active or Expanded) */}
        {currentView === 'chat' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="sidebar-section-title" style={{ margin: 0 }}>Conversations</div>
              {!collapsed && (
                <button
                  onClick={onNewConversation}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={12} /> New
                </button>
              )}
            </div>

            <div className="conv-list">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conv-item-btn ${activeConvId === conv.id ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <MessageSquare size={14} className="text-gray-400" />
                    <span className="conv-title" style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.title || 'New Chat'}
                    </span>
                  </div>
                  {!collapsed && (
                    <button
                      onClick={(e) => onConfirmDelete(e, conv.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Delete chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sidebar Footer Info */}
      <div style={{ padding: '14px', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="sidebar-footer-info" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>MCP Protocol v2024-11-05</span>
          </div>
          <div style={{ color: 'var(--text-dark)' }}>Tracks A-F Active Socket Support</div>
        </div>
      </div>
    </aside>
  );
};
