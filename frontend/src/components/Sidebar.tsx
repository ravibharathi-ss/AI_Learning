import React, { useState } from 'react';
import {
  MessageSquare,
  BookOpen,
  Search,
  AlertTriangle,
  Scale,
  Zap,
  Cpu,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Bot,
  ShieldCheck,
  Users
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  agent_type: string;
  created_at: string;
}

interface SidebarProps {
  currentView: 'chat' | 'kb' | 'debugger' | 'error_analysis' | 'judge_eval' | 'agent_loops' | 'agent_evals' | 'mcp_hub' | 'multi_agent';
  setCurrentView: (view: 'chat' | 'kb' | 'debugger' | 'error_analysis' | 'judge_eval' | 'agent_loops' | 'agent_evals' | 'mcp_hub' | 'multi_agent') => void;
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

  const navItems = [
    {
      id: 'chat' as const,
      label: 'Live Chat',
      icon: MessageSquare,
      title: 'Live Customer Support Chat'
    },
    {
      id: 'kb' as const,
      label: 'Knowledge Base',
      icon: BookOpen,
      title: 'RAG Vector Store Knowledge Base'
    },
    {
      id: 'debugger' as const,
      label: 'RAG Debugger',
      badge: 'W4',
      icon: Search,
      title: 'Week 4 Hybrid Retrieval & Chunk Debugger'
    },
    {
      id: 'error_analysis' as const,
      label: 'Error Analysis',
      badge: 'W5',
      icon: AlertTriangle,
      title: 'Week 5 Failure Taxonomy & Tracing'
    },
    {
      id: 'judge_eval' as const,
      label: 'Legal Judge',
      badge: 'W6',
      icon: Scale,
      title: 'Week 6 Legal Contract Clause Judge Validation'
    },
    {
      id: 'agent_loops' as const,
      label: 'Agent Loops',
      badge: 'W7',
      icon: Zap,
      title: 'Week 7 Agent vs Fixed Workflow Benchmark Race'
    },
    {
      id: 'agent_evals' as const,
      label: 'Agent Security',
      badge: 'W8',
      icon: ShieldAlert,
      title: 'Week 8 Agent Failure Modes & Security'
    },
    {
      id: 'mcp_hub' as const,
      label: 'MCP Studio',
      badge: 'W9',
      icon: Cpu,
      title: 'Week 9 MCP & Multi-Agent Studio'
    },
    {
      id: 'multi_agent' as const,
      label: 'Multi-Agent',
      badge: 'W10',
      icon: Users,
      title: 'Week 10 Multi-Agent Squad & A2A Race'
    }
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-logo">
            <Bot size={20} className="brand-logo-icon" />
          </div>
          {!collapsed && (
            <div className="sidebar-brand-info">
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
        {!collapsed && <div className="sidebar-section-title">Core Engine Modules</div>}
        <div className="nav-group">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentView(item.id)}
                title={item.title}
              >
                <div className="nav-item-left">
                  <Icon size={18} className="nav-item-icon" />
                  {!collapsed && <span className="nav-item-text">{item.label}</span>}
                </div>
                {!collapsed && item.badge && (
                  <span className={`nav-badge badge-${item.badge.toLowerCase()}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conversations History List */}
        {currentView === 'chat' && (
          <div className="sidebar-conversations-section">
            <div className="conversations-header">
              {!collapsed && <span className="sidebar-section-title">Conversations</span>}
              {!collapsed && (
                <button className="new-chat-btn" onClick={onNewConversation} title="Start new conversation">
                  <Plus size={13} />
                  <span>New</span>
                </button>
              )}
            </div>

            <div className="conv-list">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conv-item-btn ${activeConvId === conv.id ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                  title={conv.title || 'New Chat'}
                >
                  <div className="conv-item-left">
                    <MessageSquare size={14} className="conv-item-icon" />
                    {!collapsed && (
                      <span className="conv-item-text">
                        {conv.title || 'New Chat Session'}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <button
                      className="conv-item-delete-btn"
                      onClick={(e) => onConfirmDelete(e, conv.id)}
                      title="Delete chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-content">
          <div className="footer-status-row">
            <ShieldCheck size={14} className="footer-status-icon" />
            {!collapsed && <span>Agent Evals Active</span>}
          </div>
          {!collapsed && <div className="footer-subtext">Tracks A-F Trajectory Alignment</div>}
        </div>
      </div>
    </aside>
  );
};

