import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Bot, 
  User, 
  Send, 
  Volume2, 
  VolumeX, 
  Mic, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  Check, 
  HelpCircle, 
  CreditCard, 
  Wrench, 
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface Feedback {
  id?: number;
  rating: 'thumbs_up' | 'thumbs_down';
  comment?: string;
}

interface Message {
  id: number;
  conversation_id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: string;
  feedback?: Feedback | null;
}

interface Conversation {
  id: string;
  title: string;
  agent_type: 'general' | 'technical' | 'billing';
  created_at: string;
}

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  // App State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<'general' | 'technical' | 'billing'>('general');
  const [backendHealth, setBackendHealth] = useState<{ status: string; mock_mode: boolean } | null>(null);
  
  // TTS State
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  
  // STT State (Speech to Text)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Copy feedback state
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Custom Delete Confirm Modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convIdToDelete, setConvIdToDelete] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load initial data
  useEffect(() => {
    checkBackendHealth();
    fetchConversations();
    
    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      
      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInputText(prev => prev + (prev ? ' ' : '') + text);
        setIsListening(false);
      };
      
      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      rec.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = rec;
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle textarea autosize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      } else {
        setBackendHealth(null);
      }
    } catch (e) {
      console.error('Error connecting to backend:', e);
      setBackendHealth(null);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      setActiveConvId(id);
      // Stop speech if speaking
      window.speechSynthesis?.cancel();
      setSpeakingMessageId(null);
      
      const res = await fetch(`${API_BASE}/conversations/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // Find conversation details
        const conv = conversations.find(c => c.id === id);
        if (conv) {
          setSelectedAgent(conv.agent_type);
        }
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  const handleStartChat = async (agent: 'general' | 'technical' | 'billing') => {
    try {
      const agentNames = {
        general: 'General Support',
        technical: 'Tech Support Helpdesk',
        billing: 'Billing & Invoice Support'
      };

      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${agentNames[agent]} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          agent_type: agent
        })
      });

      if (res.ok) {
        const newConv = await res.json();
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setSelectedAgent(agent);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConvIdToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!convIdToDelete) return;
    
    try {
      const res = await fetch(`${API_BASE}/conversations/${convIdToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== convIdToDelete));
        if (activeConvId === convIdToDelete) {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    } finally {
      setShowDeleteConfirm(false);
      setConvIdToDelete(null);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = textToSend || inputText;
    if (!messageContent.trim() || !activeConvId || isGenerating) return;

    setInputText('');
    setIsGenerating(true);

    // Save scroll state before adding message
    const tempUserMsgId = Date.now();
    const tempBotMsgId = Date.now() + 1;

    // Append local messages optimistically
    const localUserMsg: Message = {
      id: tempUserMsgId,
      conversation_id: activeConvId,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    };
    
    const localBotMsg: Message = {
      id: tempBotMsgId,
      conversation_id: activeConvId,
      sender: 'bot',
      content: '',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, localUserMsg, localBotMsg]);

    try {
      // POST message to get back persistent database IDs
      const response = await fetch(`${API_BASE}/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent })
      });

      if (!response.ok) {
        throw new Error('Failed to register message with server');
      }

      const { user_message, bot_message } = await response.json();

      // Update message state with actual database IDs
      setMessages(prev => 
        prev.map(m => {
          if (m.id === tempUserMsgId) return user_message;
          if (m.id === tempBotMsgId) return bot_message;
          return m;
        })
      );

      // Open SSE connection to stream response
      const streamUrl = `${API_BASE}/conversations/${activeConvId}/messages/${bot_message.id}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          eventSource.close();
          setIsGenerating(false);
          // Refetch conversations to update title if it changed
          fetchConversations();
          return;
        }

        // Standard chunk processing
        const chunk = event.data;
        setMessages(prev => 
          prev.map(m => {
            if (m.id === bot_message.id) {
              return { ...m, content: m.content + chunk };
            }
            return m;
          })
        );
      };

      eventSource.onerror = (error) => {
        console.error('SSE Stream error:', error);
        eventSource.close();
        setIsGenerating(false);
      };

    } catch (e) {
      console.error('Send message failed:', e);
      setIsGenerating(false);
      setMessages(prev => 
        prev.filter(m => m.id !== tempUserMsgId && m.id !== tempBotMsgId)
      );
      alert('Error connecting to chatbot server. Please check that backend is running.');
    }
  };

  const handleFeedback = async (messageId: number, rating: 'thumbs_up' | 'thumbs_down') => {
    try {
      const res = await fetch(`${API_BASE}/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: '' })
      });
      if (res.ok) {
        const updatedFeedback = await res.json();
        setMessages(prev => 
          prev.map(m => {
            if (m.id === messageId) {
              return { ...m, feedback: updatedFeedback };
            }
            return m;
          })
        );
      }
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };

  // Text to Speech
  const toggleSpeech = (message: Message) => {
    if (!window.speechSynthesis) return;

    if (speakingMessageId === message.id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
      
      // Clean up markdown before speaking
      const plainText = message.content
        .replace(/```[\s\S]*?```/g, '[code block omitted]')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*#_\-]/g, '');

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.onend = () => {
        setSpeakingMessageId(null);
      };
      utterance.onerror = () => {
        setSpeakingMessageId(null);
      };
      
      setSpeakingMessageId(message.id);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speech to Text dictation
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // Code Copy
  const copyToClipboard = (text: string, index: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCodeId(index);
      setTimeout(() => setCopiedCodeId(null), 2000);
    });
  };

  // Custom regex-based Markdown-like Renderer with Copy button
  const renderMessageContent = (content: string, msgId: number) => {
    if (!content) return <div className="typing-dots"><span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span></div>;

    // Detect code blocks: ```language ... ```
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
      <div className="markdown-content">
        {parts.map((part, i) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            // Code block
            const lines = part.slice(3, -3).trim().split('\n');
            const firstLine = lines[0] || '';
            const language = ['python', 'javascript', 'html', 'css', 'bash', 'sql'].includes(firstLine.toLowerCase()) ? firstLine : 'code';
            const codeText = language !== 'code' ? lines.slice(1).join('\n') : lines.join('\n');
            const blockId = `${msgId}-${i}`;

            return (
              <div key={i} className="code-block-wrapper animate-scale-in">
                <div className="code-block-header">
                  <span>{language.toUpperCase()}</span>
                  <button 
                    onClick={() => copyToClipboard(codeText, blockId)}
                    className="copy-code-btn"
                  >
                    {copiedCodeId === blockId ? <Check size={11} style={{ color: '#FFFFFF' }} /> : <Copy size={11} />}
                    {copiedCodeId === blockId ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre>
                  <code className={`language-${language}`}>{codeText}</code>
                </pre>
              </div>
            );
          } else {
            // Text block with inline formatting
            const textLines = part.split('\n');
            return textLines.map((line, j) => {
              if (line.startsWith('### ')) {
                return <h3 key={`${i}-${j}`} style={{ fontSize: '15px', fontWeight: '800', margin: '12px 0 6px 0', color: '#FFFFFF' }}>{line.slice(4)}</h3>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={`${i}-${j}`} style={{ fontSize: '17px', fontWeight: '800', margin: '16px 0 8px 0', color: '#FFFFFF' }}>{line.slice(3)}</h2>;
              }
              if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ')) {
                return (
                  <div key={`${i}-${j}`} className="custom-list-item">
                    <span style={{ color: '#FFFFFF', fontWeight: '700' }}>{line.slice(0, 3)}</span>
                    <span>{line.slice(3)}</span>
                  </div>
                );
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={`${i}-${j}`} className="custom-list-item">
                    <span style={{ color: '#A3A3A3', marginRight: '6px' }}>✦</span>
                    <span>{line.slice(2)}</span>
                  </div>
                );
              }
              
              let formattedLine: any = line;
              if (line.includes('**')) {
                const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
                formattedLine = boldParts.map((bp, k) => {
                  if (bp.startsWith('**') && bp.endsWith('**')) {
                    return <strong key={k} style={{ color: '#FFFFFF', fontWeight: '700' }}>{bp.slice(2, -2)}</strong>;
                  }
                  return bp;
                });
              }

              return <p key={`${i}-${j}`} style={{ margin: '4px 0', color: '#E2E8F0' }}>{formattedLine}</p>;
            });
          }
        })}
      </div>
    );
  };

  // Agent profiles (Clean Monochromatic icons and details)
  const agents = {
    general: {
      title: 'General Support',
      desc: 'Get answers to queries about general policies, account operations, and overall services.',
      icon: <HelpCircle style={{ color: '#FFFFFF' }} size={22} />,
      classKey: 'general',
      badgeColor: { backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.2)' },
      suggestions: [
        'How do I reset my account password?',
        'What is your refund policy?',
        'How can I contact a manager?'
      ]
    },
    technical: {
      title: 'Tech Helpdesk',
      desc: 'Expert troubleshooting on configuration errors, code integrations, and API systems.',
      icon: <Wrench style={{ color: '#CCCCCC' }} size={22} />,
      classKey: 'technical',
      badgeColor: { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#E5E5E5', borderColor: 'rgba(255, 255, 255, 0.15)' },
      suggestions: [
        'How to make an async API status fetch in Python?',
        'I am getting a network console connection error.',
        'Show me how to format code output.'
      ]
    },
    billing: {
      title: 'Billing & Invoice',
      desc: 'Questions about invoices, package plans, cancellations, or secure subscription updates.',
      icon: <CreditCard style={{ color: '#888888' }} size={22} />,
      classKey: 'billing',
      badgeColor: { backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#A3A3A3', borderColor: 'rgba(255, 255, 255, 0.1)' },
      suggestions: [
        'What are the pricing plans for the chatbot service?',
        'Where can I find and download my PDF invoices?',
        'Can I upgrade my monthly subscription plan?'
      ]
    }
  };

  return (
    <div className="app-container">
      {/* BACKGROUND FLOATING GRADIENT BLOBS */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      {/* 1. SIDEBAR */}
      <aside className="sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-wrapper">
            <div className="sidebar-logo">
              <Sparkles style={{ color: '#000000' }} size={20} />
            </div>
            <div>
              <h2 className="sidebar-brand-title">SupportAI</h2>
              <span className="sidebar-brand-status">
                <span className="status-dot-pulse"></span>
                {backendHealth?.mock_mode ? 'Offline' : 'Online'}
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => setActiveConvId(null)}
            className="btn-3d btn-3d-secondary"
            style={{ padding: '8px', borderRadius: '10px' }}
            title="New Conversation"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* History List */}
        <div className="sidebar-content">
          <div className="sidebar-section-title">
            Conversations
          </div>
          {conversations.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#525252', textAlign: 'center', padding: '30px 10px', lineHeight: '1.6' }}>
              No chats found.<br />Launch an agent to start!
            </div>
          ) : (
            <div className="conv-list">
              {conversations.map(c => {
                const isActive = activeConvId === c.id;
                const agentIcon = c.agent_type === 'technical' ? <Wrench size={13} style={{ color: '#E5E5E5' }} /> :
                                  c.agent_type === 'billing' ? <CreditCard size={13} style={{ color: '#A3A3A3' }} /> :
                                  <HelpCircle size={13} style={{ color: '#FFFFFF' }} />;

                return (
                  <div
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={`conv-item-btn ${isActive ? 'active' : ''}`}
                  >
                    <div className="conv-item-left">
                      <div className="conv-item-icon">
                        {agentIcon}
                      </div>
                      <span className="conv-item-text">{c.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="conv-item-delete-btn"
                      title="Delete Chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-left">
            Connection: <span className="sidebar-footer-status" style={{ color: backendHealth ? '#FFFFFF' : '#EF4444' }}>
              {backendHealth ? 'Online' : 'Offline'}
            </span>
          </div>
          {backendHealth && (
            <button 
              onClick={checkBackendHealth} 
              className="btn-3d btn-3d-secondary"
              style={{ padding: '6px', borderRadius: '8px', marginLeft: 'auto' }}
              title="Refresh connection"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN CHAT AREA */}
      <main className="chat-main">
        
        {/* Active Chat Header */}
        {activeConvId && (
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-header-avatar">
                {selectedAgent === 'technical' ? <Wrench size={18} style={{ color: '#E5E5E5' }} /> :
                 selectedAgent === 'billing' ? <CreditCard size={18} style={{ color: '#A3A3A3' }} /> :
                 <HelpCircle size={18} style={{ color: '#FFFFFF' }} />}
              </div>
              <div>
                <h3 className="chat-header-title">{agents[selectedAgent].title} Desk</h3>
                <span className="chat-header-subtitle">{agents[selectedAgent].desc}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="chat-header-badge" style={agents[selectedAgent].badgeColor}>
                Support Active
              </span>
              <button 
                onClick={(e) => handleDeleteConversation(e, activeConvId)}
                className="btn-3d btn-3d-secondary"
                style={{ 
                  padding: '6px 10px', 
                  borderRadius: '8px', 
                  color: '#EF4444', 
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px'
                }}
                title="Delete Conversation"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        )}

        {/* Message Window */}
        <div className="chat-scroll-container">
          <div className="chat-content-width">
            {!activeConvId ? (
              /* 3D LANDING HERO PAGE */
              <div className="landing-container">
                <div className="landing-hero">
                  <div className="landing-badge">
                    <Sparkles size={11} /> Classy Monochromatic UI
                  </div>
                  <h1 className="landing-title">
                    Empowering user answers with <br />
                    <span className="landing-title-gradient">intelligent AI Desks.</span>
                  </h1>
                  <p className="landing-desc">
                    Choose one of the specialized support representatives below to launch an optimized 3D chat workspace designed to solve your accounts, invoices, or technical systems issues.
                  </p>
                </div>

                {/* 3D Card Selection Grid */}
                <div className="landing-grid">
                  {(Object.keys(agents) as Array<'general' | 'technical' | 'billing'>).map(key => {
                    const agent = agents[key];
                    return (
                      <div 
                        key={key}
                        onClick={() => handleStartChat(key)}
                        className={`agent-card-3d ${agent.classKey}`}
                      >
                        <div className="agent-card-header">
                          <div className="agent-card-icon-container">
                            {agent.icon}
                          </div>
                          <div>
                            <h3 className="agent-card-title">{agent.title}</h3>
                            <p className="agent-card-desc">{agent.desc}</p>
                          </div>
                        </div>

                        <div className="agent-card-action">
                          <span>Initialize Desk</span>
                          <ArrowRight size={14} className="agent-card-action-icon" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* CONVERSATION THREAD */
              <>
                {messages.length === 0 ? (
                  /* Welcome view with interactive suggestion chips */
                  <div className="chat-welcome-container">
                    <div className="welcome-avatar-wrapper">
                      {selectedAgent === 'technical' ? <Wrench size={22} style={{ color: '#E5E5E5' }} /> :
                       selectedAgent === 'billing' ? <CreditCard size={22} style={{ color: '#A3A3A3' }} /> :
                       <HelpCircle size={22} style={{ color: '#FFFFFF' }} />}
                    </div>
                    <div>
                      <h3 className="welcome-title">Initialize {agents[selectedAgent].title} Desk</h3>
                      <p className="welcome-desc">
                        Interact with the assistant by selecting a prompt category below or write a custom prompt to start the session.
                      </p>
                    </div>

                    <div className="welcome-suggestions-list">
                      {agents[selectedAgent].suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(s)}
                          className="suggestion-chip"
                        >
                          💡 "{s}"
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Message logs mapping */
                  messages.map((m) => {
                    const isUser = m.sender === 'user';
                    const botRibbonClass = selectedAgent === 'technical' ? 'ribbon-technical' :
                                           selectedAgent === 'billing' ? 'ribbon-billing' :
                                           'ribbon-general';

                    return (
                      <div 
                        key={m.id} 
                        className={`message-row ${isUser ? 'user' : 'bot'}`}
                      >
                        {/* AI avatar */}
                        {!isUser && (
                          <div className="message-avatar">
                            <Bot size={15} style={{ color: '#000000' }} />
                          </div>
                        )}

                        <div className="message-bubble-wrapper">
                          {/* Bubble Container */}
                          <div className={`message-bubble ${isUser ? '' : botRibbonClass}`}>
                            {isUser ? (
                              <p style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
                            ) : (
                              renderMessageContent(m.content, m.id)
                            )}
                          </div>

                          {/* Bot Message Actions */}
                          {!isUser && m.content && (
                            <div className="message-meta">
                              <div className="message-meta-left">
                                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <button 
                                  onClick={() => toggleSpeech(m)}
                                  className="meta-action-btn"
                                  title={speakingMessageId === m.id ? 'Stop audio' : 'Listen'}
                                >
                                  {speakingMessageId === m.id ? <VolumeX size={12} className="stop" /> : <Volume2 size={12} />}
                                  {speakingMessageId === m.id ? 'Stop' : 'Listen'}
                                </button>
                              </div>

                              {/* Feedback Ratings */}
                              <div className="feedback-group">
                                <button
                                  onClick={() => handleFeedback(m.id, 'thumbs_up')}
                                  className={`feedback-btn ${m.feedback?.rating === 'thumbs_up' ? 'up-active' : ''}`}
                                  title="Helpful response"
                                >
                                  <ThumbsUp size={12} />
                                </button>
                                <button
                                  onClick={() => handleFeedback(m.id, 'thumbs_down')}
                                  className={`feedback-btn ${m.feedback?.rating === 'thumbs_down' ? 'down-active' : ''}`}
                                  title="Unhelpful response"
                                >
                                  <ThumbsDown size={12} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* User Timestamp */}
                          {isUser && (
                            <div style={{ textAlign: 'right', fontSize: '10px', color: '#525252', paddingRight: '4px', fontWeight: '500' }}>
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>

                        {/* User avatar */}
                        {isUser && (
                          <div className="message-avatar">
                            <User size={15} style={{ color: '#FFFFFF' }} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>

        {/* 3D FLOATING INPUT PANEL */}
        {activeConvId && (
          <div className="input-panel-floating">
            <div className="input-container-row">
              
              {/* Dictation Microphone */}
              <button
                type="button"
                onClick={toggleListening}
                className={`btn-3d btn-3d-secondary ${isListening ? 'listening' : ''}`}
                title={isListening ? 'Stop listening' : 'Start speaking'}
              >
                {isListening ? (
                  <div className="soundwaves">
                    <span className="soundwave-bar"></span>
                    <span className="soundwave-bar"></span>
                    <span className="soundwave-bar"></span>
                    <span className="soundwave-bar"></span>
                  </div>
                ) : (
                  <Mic size={18} />
                )}
              </button>

              {/* Text Input Block */}
              <div className="textarea-wrapper">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={isListening ? 'Voice detection active... Speak clearly.' : 'Type message here... (Shift+Enter for newline)'}
                  className="chat-textarea"
                  disabled={isListening || isGenerating}
                />

                {/* Send Button */}
                <div className="absolute-send-btn">
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isGenerating || isListening}
                    className="btn-3d btn-3d-primary"
                    style={{ padding: '8px 12px', borderRadius: '10px' }}
                    title="Send Message"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* 3. CUSTOM 3D MONOCHROME DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <h3 className="modal-title">Delete Session</h3>
            <p className="modal-desc">
              Are you sure you want to permanently erase this chat logs? This action is irreversible.
            </p>
            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConvIdToDelete(null);
                }} 
                className="btn-3d btn-3d-secondary"
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="btn-3d btn-3d-primary"
                style={{ 
                  padding: '8px 16px', 
                  borderRadius: '10px', 
                  fontSize: '12px',
                  background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  borderColor: '#EF4444',
                  boxShadow: '0 4px 0px #991B1B, 0 8px 15px rgba(239, 68, 68, 0.2)'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
