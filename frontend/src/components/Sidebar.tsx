import React, { useState } from 'react';
import {
  MessageSquare,
  BookOpen,
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
  currentView: 'chat' | 'kb';
  setCurrentView: (view: 'chat' | 'kb') => void;
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
      label: 'Legal Assistant',
      icon: MessageSquare,
      title: 'Legal Contract Intelligence & Chat'
    },
    {
      id: 'kb' as const,
      label: 'Contracts & Documents',
      icon: BookOpen,
      title: 'Knowledge Base Contracts & Documents'
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
              <h1 className="sidebar-brand-title">Legal RAG Intelligence</h1>
              <div className="sidebar-brand-status">
                <span className="status-dot-pulse"></span>
                <span>{backendHealth?.status === 'healthy' ? 'Platform Online' : 'Active'}</span>
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
        {!collapsed && <div className="sidebar-section-title">Navigation</div>}
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
                        {conv.title || 'Legal Inquiries'}
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
            {!collapsed && <span>Enterprise Security</span>}
          </div>
          {!collapsed && <div className="footer-subtext">Grounded RAG & Citations</div>}
        </div>
      </div>
    </aside>
  );
};
