import React, { useState } from 'react';
import {
  MessageSquare,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Bot,
  ShieldCheck,
  X
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
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  conversations,
  activeConvId,
  onSelectConversation,
  onNewConversation,
  onConfirmDelete,
  backendHealth,
  sidebarOpen,
  setSidebarOpen,
  mobileOpen,
  onMobileClose
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const isMobileOpen = sidebarOpen ?? mobileOpen ?? false;
  const closeMobile = () => {
    if (setSidebarOpen) setSidebarOpen(false);
    if (onMobileClose) onMobileClose();
  };

  const isHostAdmin = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const navItems = [
    {
      id: 'chat' as const,
      label: 'Legal Assistant',
      icon: MessageSquare,
      title: 'Legal Contract Intelligence & Chat'
    },
    ...(isHostAdmin ? [{
      id: 'kb' as const,
      label: 'Contracts & Documents',
      icon: BookOpen,
      title: 'Knowledge Base Contracts & Documents (Admin)'
    }] : [])
  ];

  const handleNavClick = (view: 'chat' | 'kb') => {
    setCurrentView(view);
    closeMobile();
  };

  const handleConvClick = (id: string) => {
    onSelectConversation(id);
    closeMobile();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-overlay active"
          onClick={closeMobile}
        />
      )}
      
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'open mobile-open' : ''}`}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Close button visible only on mobile */}
            <button
              className="sidebar-mobile-close-btn"
              onClick={closeMobile}
              title="Close sidebar"
            >
              <X size={18} />
            </button>
            
            <button
              className="sidebar-toggle-btn sidebar-desktop-toggle"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
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
                  onClick={() => handleNavClick(item.id)}
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
                  <button className="new-chat-btn" onClick={() => { onNewConversation(); closeMobile(); }} title="Start new conversation">
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
                    onClick={() => handleConvClick(conv.id)}
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
    </>
  );
};
