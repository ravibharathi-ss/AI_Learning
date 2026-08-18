import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import ThreeBackground from './components/ThreeBackground';
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
  RefreshCw,
  BookOpen,
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle
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
  sources?: any;
  feedback?: Feedback;
}

interface Conversation {
  id: string;
  title: string;
  agent_type: string;
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
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
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

  // Agent selector modal state for starting a new chat from sidebar
  const [showAgentModal, setShowAgentModal] = useState(false);

  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitializingRef = useRef(false);

  // RAG / Knowledge Base State
  const [currentView, setCurrentView] = useState<'chat' | 'kb' | 'debugger'>('chat');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});

  // Week 4 RAG Debugger State
  const [inspectQuery, setInspectQuery] = useState('ERR-4032');
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [evalMetrics, setEvalMetrics] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleInspectQuery = async (queryToTest?: string) => {
    const query = queryToTest || inspectQuery;
    if (!query.trim()) return;
    setIsInspecting(true);
    try {
      const res = await fetch(`${API_BASE}/rag/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, agent_type: selectedAgent })
      });
      if (res.ok) {
        const data = await res.json();
        setInspectResult(data);
      }
    } catch (e) {
      console.error("Inspection error:", e);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const testCases = [
        { query: "ERR-4032", expected_keyword: "ERR-4032" },
        { query: "What is your refund policy?", expected_keyword: "refund" },
        { query: "Rocket launch date", expected_keyword: "2028" },
        { query: "How to reset password", expected_keyword: "password" }
      ];
      const res = await fetch(`${API_BASE}/rag/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_cases: testCases })
      });
      if (res.ok) {
        const data = await res.json();
        setEvalMetrics(data);
      }
    } catch (e) {
      console.error("Evaluation error:", e);
    } finally {
      setIsEvaluating(false);
    }
  };

  const toggleSources = (msgId: number) => {
    setExpandedSources(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const getSourcesArray = (sources: any) => {
    if (!sources) return null;
    if (Array.isArray(sources)) return sources;
    if (typeof sources === 'string') {
      try {
        return JSON.parse(sources);
      } catch (e) {
        console.error('Failed to parse sources JSON:', e);
        return null;
      }
    }
    return null;
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Failed to fetch documents:', e);
    }
  };

  const handleUploadDocument = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchDocuments();
      } else {
        const err = await res.json();
        alert(err.detail || 'Upload failed');
      }
    } catch (e) {
      console.error('Document upload failed:', e);
      alert('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (e) {
      console.error('Failed to delete document:', e);
    }
  };

  const loadConversation = async (id: string, currentConvs?: Conversation[]) => {
    try {
      setIsLoadingMessages(true);
      setActiveConvId(id);
      window.speechSynthesis?.cancel();
      setSpeakingMessageId(null);
      
      const res = await fetch(`${API_BASE}/conversations/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        
        const convList = currentConvs || conversations;
        const conv = convList.find(c => c.id === id);
        if (conv) {
          setSelectedAgent((conv.agent_type as any) || 'general');
        }
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleStartChat = async (agent: 'general' | 'technical' | 'billing' = 'general', initialPrompt?: string) => {
    const titles = {
      general: 'General Support Session',
      technical: 'Tech Helpdesk Session',
      billing: 'Billing & Invoice Session'
    };

    try {
      setIsLoadingMessages(true);
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titles[agent],
          agent_type: agent
        })
      });

      if (res.ok) {
        const newConv = await res.json();
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setSelectedAgent(agent);
        setMessages([]);
        setShowAgentModal(false);

        if (initialPrompt) {
          setTimeout(() => {
            handleSendMessageWithConvId(newConv.id, initialPrompt);
          }, 100);
        }
      }
    } catch (e) {
      console.error('Failed to create conversation:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0) {
          await loadConversation(data[0].id, data);
        } else {
          if (!isInitializingRef.current) {
            isInitializingRef.current = true;
            await handleStartChat('general');
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
      setIsLoadingMessages(false);
    }
  };

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

  // Load initial data
  useEffect(() => {
    checkBackendHealth();
    fetchConversations();
    fetchDocuments();
    
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronous scroll positioning BEFORE paint to prevent top-to-bottom crawling animation
  useLayoutEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoadingMessages, activeConvId]);

  // Handle textarea autosize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

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
        const remaining = conversations.filter(c => c.id !== convIdToDelete);
        setConversations(remaining);
        if (activeConvId === convIdToDelete) {
          if (remaining.length > 0) {
            loadConversation(remaining[0].id, remaining);
          } else {
            setActiveConvId(null);
            setMessages([]);
            handleStartChat('general');
          }
        }
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    } finally {
      setShowDeleteConfirm(false);
      setConvIdToDelete(null);
    }
  };

  const handleSendMessageWithConvId = async (targetConvId: string, messageContent: string) => {
    if (!messageContent.trim() || !targetConvId || isGenerating) return;

    setInputText('');
    setIsGenerating(true);

    const tempUserMsgId = Date.now();
    const tempBotMsgId = Date.now() + 1;

    const localUserMsg: Message = {
      id: tempUserMsgId,
      conversation_id: targetConvId,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    };
    
    const localBotMsg: Message = {
      id: tempBotMsgId,
      conversation_id: targetConvId,
      sender: 'bot',
      content: '',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, localUserMsg, localBotMsg]);

    try {
      const response = await fetch(`${API_BASE}/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent })
      });

      if (!response.ok) {
        throw new Error('Failed to register message with server');
      }

      const { user_message, bot_message } = await response.json();

      setMessages(prev => 
        prev.map(m => {
          if (m.id === tempUserMsgId) return user_message;
          if (m.id === tempBotMsgId) return bot_message;
          return m;
        })
      );

      const streamUrl = `${API_BASE}/conversations/${targetConvId}/messages/${bot_message.id}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          eventSource.close();
          setIsGenerating(false);
          fetchConversations();
          return;
        }

        const chunk = event.data;
        if (chunk.startsWith('[SOURCES]')) {
          try {
            const sourcesJson = chunk.replace('[SOURCES]', '');
            const parsedSources = JSON.parse(sourcesJson);
            setMessages(prev =>
              prev.map(m => {
                if (m.id === bot_message.id) {
                  return { ...m, sources: parsedSources };
                }
                return m;
              })
            );
          } catch (e) {
            console.error('Error parsing sources from stream:', e);
          }
        } else {
          setMessages(prev => 
            prev.map(m => {
              if (m.id === bot_message.id) {
                return { ...m, content: m.content + chunk };
              }
              return m;
            })
          );
        }
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

  const handleSendMessage = async (textToSend?: string) => {
    if (!activeConvId) return;
    const messageContent = textToSend || inputText;
    await handleSendMessageWithConvId(activeConvId, messageContent);
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
      
      const plainText = message.content
        .replace(/```[\s\S]*?```/g, '[code block omitted]')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*#_-]/g, '');

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

    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
      <div className="markdown-content">
        {parts.map((part, i) => {
          if (part.startsWith('```') && part.endsWith('```')) {
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

  // Agent profiles
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
        'How can I contact support?'
      ]
    },
    technical: {
      title: 'Tech Helpdesk',
      desc: 'Expert troubleshooting on configuration errors, code integrations, and API systems.',
      icon: <Wrench style={{ color: '#CCCCCC' }} size={22} />,
      classKey: 'technical',
      badgeColor: { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#E5E5E5', borderColor: 'rgba(255, 255, 255, 0.15)' },
      suggestions: [
        'How to make an async API call in Python?',
        'I am getting a CORS connection error.',
        'Show me how to setup Docker container.'
      ]
    },
    billing: {
      title: 'Billing & Invoice',
      desc: 'Questions about invoices, package plans, cancellations, or secure subscription updates.',
      icon: <CreditCard style={{ color: '#888888' }} size={22} />,
      classKey: 'billing',
      badgeColor: { backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#A3A3A3', borderColor: 'rgba(255, 255, 255, 0.1)' },
      suggestions: [
        'What are the subscription plans available?',
        'Where can I download my billing invoices?',
        'How do I update my payment method?'
      ]
    }
  };

  const currentAgentInfo = agents[selectedAgent] || agents.general;

  return (
    <div className="app-container">
      {/* REAL THREE.JS 3D WEBGL BACKGROUND SCENE */}
      <ThreeBackground scrollRef={chatScrollRef} agentType={selectedAgent} />

      {/* BACKGROUND FLOATING 3D GRADIENT ORBS */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* 1. SIDEBAR */}
      <aside className="sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-wrapper">
            <div className="sidebar-logo">
              <Bot style={{ color: '#000000' }} size={20} />
            </div>
            <div>
              <h2 className="sidebar-brand-title">AI Assistant</h2>
              <span className="sidebar-brand-status">
                <span className="status-dot-pulse"></span>
                {backendHealth?.mock_mode ? 'Offline' : 'Online'}
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => setShowAgentModal(true)}
            className="btn-3d btn-3d-secondary"
            style={{ padding: '8px', borderRadius: '10px' }}
            title="New Chat Session"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* View Toggle Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 8px 12px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <button
            onClick={() => setCurrentView('chat')}
            className={`btn-3d ${currentView === 'chat' ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
            style={{ flex: 1, padding: '6px 8px', borderRadius: '8px', fontSize: '10.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
          >
            <Bot size={12} /> Chat
          </button>
          <button
            onClick={() => {
              setCurrentView('kb');
              fetchDocuments();
            }}
            className={`btn-3d ${currentView === 'kb' ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
            style={{ flex: 1, padding: '6px 8px', borderRadius: '8px', fontSize: '10.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
          >
            <BookOpen size={12} /> Knowledge
          </button>
          <button
            onClick={() => {
              setCurrentView('debugger');
              if (!inspectResult) handleInspectQuery("ERR-4032");
            }}
            className={`btn-3d ${currentView === 'debugger' ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
            style={{ flex: 1, padding: '6px 8px', borderRadius: '8px', fontSize: '10.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
          >
            <Wrench size={12} /> RAG Debugger
          </button>
        </div>

        {/* History List */}
        <div className="sidebar-content">
          <div className="sidebar-section-title">
            Conversations
          </div>
          {conversations.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#525252', textAlign: 'center', padding: '30px 10px', lineHeight: '1.6' }}>
              No chats found.<br />Start a new session!
            </div>
          ) : (
            <div className="conv-list">
              {conversations.map(c => {
                const isActive = activeConvId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setCurrentView('chat');
                      loadConversation(c.id);
                    }}
                    className={`conv-item-btn ${isActive && currentView === 'chat' ? 'active' : ''}`}
                  >
                    <div className="conv-item-left">
                      <div className="conv-item-icon">
                        <Bot size={13} style={{ color: '#FFFFFF' }} />
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
        {currentView === 'kb' ? (
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-header-avatar">
                <BookOpen size={18} style={{ color: '#FFFFFF' }} />
              </div>
              <div>
                <h3 className="chat-header-title">Knowledge Base</h3>
                <span className="chat-header-subtitle">Manage documents for local RAG query indexing</span>
              </div>
            </div>
          </div>
        ) : (
          activeConvId && (
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="chat-header-avatar">
                  {currentAgentInfo.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="chat-header-title">AI Assistant</h3>
                    <span 
                      className="chat-header-badge"
                      style={currentAgentInfo.badgeColor}
                    >
                      {currentAgentInfo.title}
                    </span>
                  </div>
                  <span className="chat-header-subtitle">Ask questions and get instant answers</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          )
        )}

        {/* Message Window / KB Window */}
        <div className="chat-scroll-container" ref={chatScrollRef}>
          <div className="chat-content-width">
            {currentView === 'kb' ? (
              /* KNOWLEDGE BASE VIEW */
              <div className="kb-container animate-scale-in" style={{ padding: '24px 0' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#FFFFFF' }}>Upload Reference Document</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#A3A3A3', lineHeight: '1.5' }}>
                    Select a text (`.txt`), markdown (`.md`), or JSON (`.json`) file. Its content will be chunked and indexed into the local SQLite embedding database automatically.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input 
                      type="file" 
                      accept=".txt,.md,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUploadDocument(file);
                        }
                      }}
                      style={{ display: 'none' }}
                      id="kb-file-upload-input"
                    />
                    <label 
                      htmlFor="kb-file-upload-input"
                      className="btn-3d btn-3d-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      <Upload size={16} /> Select & Upload File
                    </label>
                    
                    {isUploading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#A3A3A3' }}>
                        <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Indexing file...</span>
                      </div>
                    )}
                  </div>
                </div>

                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', color: '#FFFFFF' }}>Indexed Documents</h4>
                {documents.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#525252', fontSize: '13px', background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
                    No documents indexed yet. Upload a document to start using RAG!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {documents.map((doc) => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={18} style={{ color: '#FFFFFF' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#E2E8F0' }}>{doc.filename}</span>
                            <span style={{ fontSize: '11px', color: '#525252', marginTop: '2px' }}>Uploaded: {new Date(doc.uploaded_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="conv-item-delete-btn"
                          style={{ marginLeft: 'auto', padding: '6px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', background: 'rgba(239, 68, 68, 0.05)' }}
                          title="Delete Document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentView === 'debugger' ? (
              /* WEEK 4 RAG DEBUGGER & INSPECTION VIEW */
              <div className="debugger-container animate-scale-in" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. QUERY TEST & INSPECTOR CONTROL BAR */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={16} /> RAG Retrieval Inspector
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#A3A3A3', lineHeight: '1.5' }}>
                    Test any user prompt or code (e.g. <code>ERR-4032</code>) to inspect exact BM25 keyword ranks, vector similarity, RRF fusion, and failure classification.
                  </p>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="text"
                      value={inspectQuery}
                      onChange={(e) => setInspectQuery(e.target.value)}
                      placeholder="Enter question or code (e.g. ERR-4032, return policy)..."
                      style={{ flex: 1, padding: '12px 16px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#FFFFFF', fontSize: '13px', fontFamily: 'inherit' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleInspectQuery(); }}
                    />
                    <button
                      onClick={() => handleInspectQuery()}
                      disabled={isInspecting}
                      className="btn-3d btn-3d-primary"
                      style={{ padding: '12px 20px', borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isInspecting ? <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                      Inspect Pipeline
                    </button>
                  </div>

                  {/* Preset Test Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600' }}>Quick Test Cases:</span>
                    {["ERR-4032", "What is your refund policy?", "Rocket launch date"].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setInspectQuery(preset);
                          handleInspectQuery(preset);
                        }}
                        style={{ padding: '4px 10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#E2E8F0', fontSize: '11px', cursor: 'pointer' }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. RETRIEVAL BENCHMARK EVALUATION METRICS PANEL */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#FFFFFF' }}>Hit-Rate@3 & MRR Benchmark</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#A3A3A3' }}>Measure retrieval accuracy with quantitative numbers before vs after Hybrid Search.</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {evalMetrics && (
                      <div style={{ display: 'flex', gap: '16px', textTransform: 'uppercase' }}>
                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 14px', borderRadius: '10px', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '10px', color: '#38BDF8', fontWeight: 'bold' }}>Hit-Rate@3</span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>{evalMetrics.hit_rate_at_3}%</span>
                        </div>
                        <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '6px 14px', borderRadius: '10px', textAlign: 'center' }}>
                          <span style={{ display: 'block', fontSize: '10px', color: '#A855F7', fontWeight: 'bold' }}>MRR Score</span>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>{evalMetrics.mrr}</span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleRunEvaluation}
                      disabled={isEvaluating}
                      className="btn-3d btn-3d-secondary"
                      style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isEvaluating ? <RefreshCw size={13} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                      Run Benchmark
                    </button>
                  </div>
                </div>

                {/* 3. INSPECTION PIPELINE RESULTS */}
                {inspectResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* A. Failure Diagnostic Classifier Box */}
                    <div style={{
                      padding: '16px 20px',
                      borderRadius: '14px',
                      border: inspectResult.failure_diagnostic.classification === 'SUCCESS'
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : inspectResult.failure_diagnostic.classification === 'RETRIEVAL_FAILURE'
                        ? '1px solid rgba(239, 68, 68, 0.5)'
                        : '1px solid rgba(245, 158, 11, 0.5)',
                      background: inspectResult.failure_diagnostic.classification === 'SUCCESS'
                        ? 'rgba(16, 185, 129, 0.08)'
                        : inspectResult.failure_diagnostic.classification === 'RETRIEVAL_FAILURE'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(245, 158, 11, 0.1)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={18} style={{
                            color: inspectResult.failure_diagnostic.classification === 'SUCCESS' ? '#10B981' : inspectResult.failure_diagnostic.classification === 'RETRIEVAL_FAILURE' ? '#EF4444' : '#F59E0B'
                          }} />
                          <span style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#FFFFFF' }}>
                            Diagnostic: {inspectResult.failure_diagnostic.classification}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#E2E8F0', fontWeight: 'bold' }}>
                          {inspectResult.failure_diagnostic.subtype}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#E2E8F0', lineHeight: '1.5' }}>
                        <strong>Reason:</strong> {inspectResult.failure_diagnostic.reason}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#A3A3A3' }}>
                        <strong>Recommended Remedy:</strong> {inspectResult.failure_diagnostic.remedy}
                      </p>
                    </div>

                    {/* B. Step 1: Query Rewriting & Tokens */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '14px', padding: '16px' }}>
                      <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#38BDF8' }}>1. Query Rewriting & Keyword Tokens</h5>
                      <div style={{ fontSize: '12px', color: '#E2E8F0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div><strong>Original Query:</strong> "{inspectResult.query_info.original_query}"</div>
                        <div><strong>Rewritten Search Query:</strong> "{inspectResult.query_info.rewritten_query}"</div>
                        <div><strong>Extracted Keyword Tokens:</strong> {inspectResult.query_info.tokens.map((t: string) => <span key={t} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', margin: '0 3px', fontFamily: 'monospace' }}>{t}</span>)}</div>
                        {inspectResult.query_info.exact_codes.length > 0 && (
                          <div><strong>Exact Codes Detected:</strong> {inspectResult.query_info.exact_codes.map((c: string) => <span key={c} style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38BDF8', padding: '2px 6px', borderRadius: '4px', margin: '0 3px', color: '#38BDF8', fontWeight: 'bold' }}>{c}</span>)}</div>
                        )}
                      </div>
                    </div>

                    {/* C. Step 2: Hybrid Search & Reranking Table */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '14px', padding: '16px' }}>
                      <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 'bold', color: '#A855F7' }}>2. Hybrid RRF Search & Reranker Breakdown</h5>
                      
                      {inspectResult.retrieved_chunks.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#EF4444', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                          No document chunks retrieved for this query.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {inspectResult.retrieved_chunks.map((c: any, index: number) => (
                            <div key={c.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: 'bold', color: '#FFFFFF' }}>
                                <span>Rank #{index + 1} — [{c.filename}]</span>
                                <span style={{ color: '#10B981' }}>Final Rerank Score: {c.score}</span>
                              </div>
                              <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '0 0 8px 0', fontFamily: 'monospace', background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px' }}>
                                "{c.content}"
                              </p>
                              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94A3B8' }}>
                                <span>Vector Cosine: <strong>{(c.semantic_score * 100).toFixed(1)}%</strong></span>
                                <span>BM25 Keyword: <strong>{c.bm25_score.toFixed(2)}</strong></span>
                                <span>RRF Fusion Score: <strong>{c.rrf_score.toFixed(4)}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* D. Step 3: Full Context & LLM Response */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '14px', padding: '16px' }}>
                      <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#10B981' }}>3. System Context & LLM Generation</h5>
                      <div style={{ fontSize: '12px', color: '#E2E8F0' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <strong style={{ display: 'block', marginBottom: '4px', color: '#A3A3A3' }}>System Prompt Sent to LLM:</strong>
                          <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#94A3B8', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                            {inspectResult.system_prompt}
                          </pre>
                        </div>
                        <div>
                          <strong style={{ display: 'block', marginBottom: '4px', color: '#FFFFFF' }}>Generated LLM Output:</strong>
                          <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', color: '#FFFFFF' }}>
                            {inspectResult.llm_response}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              !activeConvId || isLoadingMessages ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#A3A3A3', gap: '12px', padding: '100px 0' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Loading conversation history...</span>
                </div>
              ) : (
                /* CONVERSATION THREAD */
                <>
                  {messages.length === 0 ? (
                    /* Welcome View with Agent Cards & Suggestions */
                    <div className="chat-welcome-container">
                      <div className="welcome-avatar-wrapper">
                        {currentAgentInfo.icon}
                      </div>
                      <div>
                        <h3 className="welcome-title">{currentAgentInfo.title}</h3>
                        <p className="welcome-desc">
                          {currentAgentInfo.desc}
                        </p>
                      </div>

                      {/* Agent Selection Cards */}
                      <div style={{ width: '100%', maxWidth: '720px', margin: '10px 0' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#737373', fontWeight: '700', marginBottom: '14px' }}>
                          Select Support Desk
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          {(['general', 'technical', 'billing'] as const).map((agentKey) => {
                            const info = agents[agentKey];
                            const isSelected = selectedAgent === agentKey;
                            return (
                              <div 
                                key={agentKey}
                                onClick={() => handleStartChat(agentKey)}
                                style={{
                                  padding: '14px',
                                  borderRadius: '14px',
                                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                  border: isSelected ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  {info.icon}
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#FFFFFF' }}>{info.title}</span>
                                </div>
                                <p style={{ fontSize: '11px', color: '#A3A3A3', lineHeight: '1.4' }}>{info.desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Suggestions list for current agent */}
                      <div className="welcome-suggestions-list">
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#737373', fontWeight: '700' }}>
                          Suggested Questions
                        </div>
                        {currentAgentInfo.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(suggestion)}
                            className="suggestion-chip"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Message logs mapping */
                    messages.map((m) => {
                      const isUser = m.sender === 'user';
                      const botRibbonClass = `ribbon-${selectedAgent}`;
                      const sourcesList = getSourcesArray(m.sources);

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

                            {/* RAG Sources Section (Bot Only) */}
                            {!isUser && sourcesList && sourcesList.length > 0 && (
                              <div style={{ marginTop: '4px' }}>
                                <button
                                  onClick={() => toggleSources(m.id)}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '8px',
                                    padding: '4px 10px',
                                    color: '#A3A3A3',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  <BookOpen size={12} style={{ color: '#FFFFFF' }} />
                                  <span>{sourcesList.length} RAG Source{sourcesList.length > 1 ? 's' : ''} Referenced</span>
                                  {expandedSources[m.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>

                                {expandedSources[m.id] && (
                                  <div style={{
                                    marginTop: '8px',
                                    padding: '10px 12px',
                                    background: 'rgba(10, 10, 10, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                  }}>
                                    {sourcesList.map((src: any, sIdx: number) => (
                                      <div key={sIdx} style={{ fontSize: '11px', color: '#D4D4D4', borderLeft: '2px solid #FFFFFF', paddingLeft: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                          <span style={{ fontWeight: '700', color: '#FFFFFF' }}>📄 {src.filename}</span>
                                          <span style={{ color: '#737373' }}>{(src.score * 100).toFixed(0)}% match</span>
                                        </div>
                                        <div style={{ fontStyle: 'italic', color: '#A3A3A3', fontSize: '10.5px', lineHeight: '1.4' }}>
                                          "{src.content}"
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

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
              )
            )}
          </div>
        </div>

        {/* 3D FLOATING INPUT PANEL */}
        {activeConvId && currentView === 'chat' && (
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

      {/* 3. NEW CHAT AGENT SELECTOR MODAL */}
      {showAgentModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in" style={{ maxWidth: '480px' }}>
            <h3 className="modal-title">New Chat Session</h3>
            <p className="modal-desc">
              Choose an AI Agent Support Desk to start your conversation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {(['general', 'technical', 'billing'] as const).map((agentKey) => {
                const info = agents[agentKey];
                return (
                  <button
                    key={agentKey}
                    onClick={() => handleStartChat(agentKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }}>
                      {info.icon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>{info.title}</span>
                      <span style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '2px' }}>{info.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowAgentModal(false)}
                className="btn-3d btn-3d-secondary"
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CUSTOM DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <h3 className="modal-title">Delete Session</h3>
            <p className="modal-desc">
              Are you sure you want to permanently erase this chat session? This action is irreversible.
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
