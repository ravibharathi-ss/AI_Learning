import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
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
  BookOpen, 
  Upload, 
  RefreshCw, 
  FileCheck,
  Scale,
  Menu,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

import { Sidebar } from './components/Sidebar';
import ThreeBackground from './components/ThreeBackground';
import './App.css';

interface Feedback {
  id?: number;
  rating: 'thumbs_up' | 'thumbs_down';
  comment?: string;
}

interface Citation {
  document_id: string;
  document_name: string;
  chunk_id: number;
  score: number;
  snippet: string;
  clause_reference?: string;
}

interface Message {
  id: number;
  conversation_id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: string;
  sources?: Citation[];
  cited_clause?: string;
  is_grounded?: boolean;
  feedback?: Feedback;
}

interface Conversation {
  id: string;
  title: string;
  agent_type: string;
  created_at: string;
}

interface KnowledgeDocument {
  id: string;
  filename: string;
  uploaded_at: string;
  status?: string;
  chunks_count?: number;
}

// Dynamic backend host so colleagues accessing via LAN IP (e.g., http://192.168.x.x:5173) connect properly
const BACKEND_HOST = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const API_BASE = `http://${BACKEND_HOST}:8000/api`;
const HEALTH_URL = `http://${BACKEND_HOST}:8000/health`;

// ── Per-Device Session & Conversation Isolation ──
// Ensures each friend / colleague on the local network has their own private chats
const STORAGE_KEY_CONVS = 'rag_my_conversation_ids';
const STORAGE_KEY_ACTIVE = 'rag_my_active_conv_id';

const isHostAdmin = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const getOrCreateSessionId = (): string => {
  try {
    let sid = localStorage.getItem('rag_client_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('rag_client_session_id', sid);
    }
    return sid;
  } catch {
    return 'sess_default';
  }
};

const getApiHeaders = (extra: Record<string, string> = {}) => {
  return {
    'Content-Type': 'application/json',
    'X-Session-ID': getOrCreateSessionId(),
    ...(isHostAdmin ? { 'X-Admin-Role': 'admin' } : {}),
    ...extra
  };
};

const getMyConvIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveMyConvId = (id: string) => {
  try {
    const current = getMyConvIds();
    if (!current.includes(id)) {
      const updated = [id, ...current];
      localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(updated));
    }
    localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  } catch (e) {
    console.error('Failed to save conversation to localStorage:', e);
  }
};

const removeMyConvId = (id: string) => {
  try {
    const current = getMyConvIds();
    const updated = current.filter((cId) => cId !== id);
    localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(updated));
    if (localStorage.getItem(STORAGE_KEY_ACTIVE) === id) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  } catch (e) {
    console.error('Failed to remove conversation from localStorage:', e);
  }
};

const MAX_INPUT_CHARS = 4000;

export default function App() {
  // Navigation & Core State
  const [currentView, setCurrentView] = useState<'chat' | 'kb'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [backendHealth, setBackendHealth] = useState<{ status: string; mode?: string } | null>(null);

  // Knowledge Base State
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<{ id: string; filename: string } | null>(null);

  // Audio / Speech State
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // UI Utilities
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convIdToDelete, setConvIdToDelete] = useState<string | null>(null);

  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message
  useLayoutEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Initial Load & Health Check
  useEffect(() => {
    checkHealth();
    fetchConversations();
    fetchDocuments();
    setupSpeechRecognition();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      }
    } catch {
      setBackendHealth({ status: 'offline' });
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        headers: getApiHeaders()
      });
      if (res.ok) {
        const data: Conversation[] = await res.json();

        // Check if this device has already tracked its conversations
        const hasTracked = localStorage.getItem('rag_device_initialized');
        let myIds = getMyConvIds();

        // One-time initialization for the host computer (localhost):
        // associate pre-existing conversations with the host so your history is preserved.
        if (!hasTracked && window.location.hostname === 'localhost' && data.length > 0) {
          myIds = data.map((c) => c.id);
          localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(myIds));
          localStorage.setItem('rag_device_initialized', 'true');
        } else if (!hasTracked) {
          // New device / friend starts with a clean, private slate
          localStorage.setItem('rag_device_initialized', 'true');
        }

        // Strictly filter to ONLY conversations created by THIS user / device
        const myConversations = data.filter((c) => myIds.includes(c.id));
        setConversations(myConversations);

        // Load the stored active conversation or the newest one belonging to this device
        const storedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
        if (storedActiveId && myConversations.some((c) => c.id === storedActiveId)) {
          setActiveConvId(storedActiveId);
          loadConversation(storedActiveId);
        } else if (myConversations.length > 0) {
          setActiveConvId(myConversations[0].id);
          loadConversation(myConversations[0].id);
        } else {
          // Fresh session for this friend: clean welcome screen!
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('Error fetching conversations:', e);
    }
  };

  const loadConversation = async (convId: string) => {
    setIsLoadingMessages(true);
    setActiveConvId(convId);
    localStorage.setItem(STORAGE_KEY_ACTIVE, convId);
    try {
      const res = await fetch(`${API_BASE}/conversations/${convId}/messages`, {
        headers: getApiHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        // Normalize sources (parse stringified JSON from database if needed)
        const validMessages = (data || []).map((m: any) => {
          let parsedSources = m.sources;
          if (typeof m.sources === 'string') {
            try {
              parsedSources = JSON.parse(m.sources);
            } catch {
              parsedSources = [];
            }
          }
          return {
            ...m,
            sources: Array.isArray(parsedSources) ? parsedSources : []
          };
        }).filter((m: Message) => !(m.sender === 'bot' && !m.content?.trim()));
        setMessages(validMessages);
      }
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleStartNewChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ title: 'New Legal Session', agent_type: 'legal_specialist' })
      });
      if (res.ok) {
        const newConv = await res.json();
        saveMyConvId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setMessages([]);
        setCurrentView('chat');
      }
    } catch (e) {
      console.error('Error creating conversation:', e);
    }
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConvIdToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteConversation = async () => {
    if (!convIdToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/conversations/${convIdToDelete}`, {
        method: 'DELETE',
        headers: getApiHeaders()
      });
      if (res.ok) {
        removeMyConvId(convIdToDelete);
        const updated = conversations.filter((c) => c.id !== convIdToDelete);
        setConversations(updated);
        if (activeConvId === convIdToDelete) {
          if (updated.length > 0) {
            setActiveConvId(updated[0].id);
            loadConversation(updated[0].id);
          } else {
            setActiveConvId(null);
            setMessages([]);
          }
        }
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    } finally {
      setShowDeleteConfirm(false);
      setConvIdToDelete(null);
    }
  };

  const handleSendMessage = async () => {
    const userQuery = inputText.trim();
    if (!userQuery || isGenerating) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      try {
        const convTitle = userQuery.length > 36 ? userQuery.slice(0, 36) + '...' : userQuery;
        const res = await fetch(`${API_BASE}/conversations`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({ title: convTitle, agent_type: 'legal_specialist' })
        });
        if (res.ok) {
          const newConv = await res.json();
          targetConvId = newConv.id;
          saveMyConvId(newConv.id);
          setActiveConvId(newConv.id);
          setConversations((prev) => [newConv, ...prev]);
        } else {
          console.error('Failed to create new conversation:', await res.text());
          return;
        }
      } catch (err) {
        console.error('Network error creating conversation:', err);
        return;
      }
    }

    if (!targetConvId) return;

    setInputText('');

    const tempUserId = Date.now();
    const tempBotId = tempUserId + 1;

    // Display user query immediately
    const tempUserMsg: Message = {
      id: tempUserId,
      conversation_id: targetConvId,
      sender: 'user',
      content: userQuery,
      timestamp: new Date().toISOString()
    };

    // Display live bot placeholder for animated thinking indicator
    const tempBotMsg: Message = {
      id: tempBotId,
      conversation_id: targetConvId,
      sender: 'bot',
      content: '',
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempUserMsg, tempBotMsg]);
    setIsGenerating(true);

    try {
      // 1. Post to backend to record user message & create bot message entry
      const res = await fetch(`${API_BASE}/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ content: userQuery })
      });

      if (!res.ok) {
        throw new Error('Failed to send message to backend');
      }

      const postData = await res.json();
      const realBotMsg = postData.bot_message;
      const realUserMsg = postData.user_message;
      const botMsgId = realBotMsg?.id || tempBotId;

      // Update message entries with actual DB IDs
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === tempUserId && realUserMsg) return realUserMsg;
          if (m.id === tempBotId) return { ...m, id: botMsgId };
          return m;
        })
      );

      // 2. Stream tokens via SSE from backend /stream endpoint
      const streamRes = await fetch(`${API_BASE}/conversations/${targetConvId}/messages/${botMsgId}/stream`);
      if (!streamRes.ok || !streamRes.body) {
        throw new Error('Streaming response failed to initialize');
      }

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let streamSources: Citation[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let line of lines) {
          // Strip carriage return without altering trailing token spaces
          if (line.endsWith('\r')) {
            line = line.slice(0, -1);
          }
          if (!line.startsWith('data:')) continue;

          // SSE format: 'data: <payload>'. Remove only the SSE protocol prefix and preserve token spaces!
          const dataPayload = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
          if (dataPayload === '[DONE]') {
            break;
          } else if (dataPayload.startsWith('[SOURCES]')) {
            try {
              const parsedSources = JSON.parse(dataPayload.slice(9));
              streamSources = parsedSources;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId ? { ...m, sources: streamSources } : m
                )
              );
            } catch (err) {
              console.error('Error parsing sources from stream:', err);
            }
          } else {
            // Append incoming streamed token
            accumulatedText += dataPayload;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === botMsgId
                  ? {
                      ...m,
                      content: accumulatedText,
                      sources: streamSources.length ? streamSources : m.sources
                    }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      console.error('Message or stream error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempBotId || (m.sender === 'bot' && !m.content)
            ? {
                ...m,
                content: 'I encountered an issue generating the legal response. Please check that Ollama is running and try again.'
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleFeedback = async (messageId: number, rating: 'thumbs_up' | 'thumbs_down') => {
    try {
      const res = await fetch(`${API_BASE}/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, feedback: { rating } } : m))
        );
      }
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    }
  };

  // Document Management Methods
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Error fetching documents:', e);
    }
  };

  const handleUploadDocument = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: isHostAdmin ? { 'X-Admin-Role': 'admin' } : {},
        body: formData
      });
      if (res.ok) {
        await fetchDocuments();
      } else {
        const err = await res.json().catch(() => ({ detail: 'Upload error' }));
        alert(`Failed to upload document: ${err.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Document upload failed:', e);
      alert('Network failure uploading document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE',
        headers: isHostAdmin ? { 'X-Admin-Role': 'admin' } : {}
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch (e) {
      console.error('Failed to delete document:', e);
    } finally {
      setDeletingDocId(null);
      setDocToDelete(null);
    }
  };

  // Audio / Speech Recognition Methods
  const setupSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-text is not supported by your browser.');
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

  const speakText = (id: number, text: string) => {
    if ('speechSynthesis' in window) {
      if (speakingMessageId === id) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      setSpeakingMessageId(id);
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* Interactive 3D Canvas Background */}
      <ThreeBackground scrollRef={chatScrollRef} />

      {/* 1. SIDEBAR NAVIGATION */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          if (view === 'kb' && !isHostAdmin) return;
          setCurrentView(view);
          if (view === 'kb') fetchDocuments();
        }}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={(id) => {
          setCurrentView('chat');
          loadConversation(id);
          setSidebarOpen(false);
        }}
        onNewConversation={handleStartNewChat}
        onConfirmDelete={handleDeleteConversation}
        backendHealth={backendHealth}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* 2. MAIN APPLICATION CONTENT */}
      <main className="chat-main">
        {/* Header Bar */}
        <div className="chat-header">
          <div className="chat-header-left">
            {/* Mobile hamburger menu */}
            <button
              className="mobile-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="chat-header-avatar">
              {currentView === 'kb' ? (
                <BookOpen size={18} style={{ color: '#38BDF8' }} />
              ) : (
                <Scale size={18} style={{ color: '#38BDF8' }} />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="chat-header-title">
                  {currentView === 'kb' ? 'Legal Contracts & Knowledge Base' : 'Legal Intelligence Assistant'}
                </h3>
                <span
                  className="chat-header-badge"
                  style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#60A5FA', borderColor: 'rgba(96, 165, 250, 0.35)' }}
                >
                  {currentView === 'kb' ? 'Repository Index' : 'Grounded RAG v2.2'}
                </span>
              </div>
              <span className="chat-header-subtitle">
                {currentView === 'kb'
                  ? 'Ingest and manage legal agreements indexed into vector storage'
                  : 'Grounded clause analysis and contract Q&A backed by strict citations'}
              </span>
            </div>
          </div>

          {currentView === 'chat' && activeConvId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={(e) => activeConvId && handleDeleteConversation(e, activeConvId)}
                className="btn-3d btn-3d-secondary"
                style={{
                  padding: '6px 12px',
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
                <Trash2 size={13} /> Delete Session
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="chat-scroll-container" ref={chatScrollRef}>
          <div className="chat-content-width" style={{ maxWidth: '1000px', width: '100%' }}>
            {currentView === 'kb' && isHostAdmin ? (
              /* KNOWLEDGE BASE VIEW (Admin Only) */
              <div className="kb-container animate-scale-in" style={{ padding: '24px 0' }}>
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.72)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px'
                  }}
                >
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: '#FFFFFF' }}>
                    Upload Legal Agreement
                  </h4>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                    Upload standard contracts, agreements, or terms (.pdf, .txt, .md). The document will be
                    automatically parsed, split across contract section boundaries, and indexed into ChromaDB
                    vector embeddings for grounded retrieval.
                  </p>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <input
                      type="file"
                      accept=".txt,.md,.json,.pdf"
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
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 22px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <Upload size={16} /> Select & Ingest File
                    </label>

                    {isUploading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#38BDF8' }}>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Parsing and indexing document vectors...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#FFFFFF' }}>
                      Indexed Agreements & Contracts
                    </h4>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(37, 99, 235, 0.25)',
                        color: '#93C5FD',
                        border: '1px solid rgba(96, 165, 250, 0.3)'
                      }}
                    >
                      {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                    </span>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <div
                    style={{
                      padding: '48px',
                      textAlign: 'center',
                      color: '#94A3B8',
                      fontSize: '14px',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px dashed rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px'
                    }}
                  >
                    No agreements indexed yet. Upload a contract to begin querying.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          background: 'rgba(15, 23, 42, 0.65)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'rgba(37, 99, 235, 0.25)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <FileCheck size={20} style={{ color: '#38BDF8' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#F8FAFC' }}>
                              {doc.filename}
                            </span>
                            <span style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                              Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setDocToDelete({ id: doc.id, filename: doc.filename })}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #FECACA',
                            color: '#DC2626',
                            background: '#FEF2F2',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                          title={`Delete ${doc.filename}`}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* LIVE CHAT VIEW */
              <div className="chat-messages-container" style={{ padding: '20px 0' }}>
                {/* RICH WELCOME SCREEN */}
                {messages.length === 0 && !isLoadingMessages && (
                  <div className="chat-welcome-container animate-fadeInUp">
                    <div className="welcome-avatar-wrapper" style={{ background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(99, 102, 241, 0.25))', border: '1.5px solid rgba(56, 189, 248, 0.45)' }}>
                      <Bot size={28} style={{ color: '#38BDF8' }} />
                    </div>
                    <h3 className="welcome-title">Legal &amp; Contracts Intelligence</h3>
                    <p className="welcome-desc">
                      Ask questions about governing law, termination notice periods, liability caps, or GDPR standard clauses across all uploaded agreements.
                    </p>
                    <div className="welcome-suggestions-list">
                      <span className="welcome-suggestions-title">Try asking</span>
                      {[
                        { icon: '⚖️', text: 'What is the governing law in the Master Services Agreement?' },
                        { icon: '📋', text: 'Summarize all termination clauses across uploaded contracts' },
                        { icon: '🔒', text: 'Are there any GDPR or data protection clauses?' },
                        { icon: '💰', text: 'What are the liability caps and indemnification terms?' }
                      ].map((suggestion, idx) => (
                        <button
                          key={idx}
                          className="suggestion-chip"
                          onClick={() => { setInputText(suggestion.text); textareaRef.current?.focus(); }}
                        >
                          <span className="suggestion-icon" style={{ fontSize: '18px' }}>{suggestion.icon}</span>
                          <span>{suggestion.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isLoadingMessages ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '13px' }}>Loading conversation history...</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`message-row ${msg.sender} ${msg.sender === 'user' ? 'message-enter-user' : 'message-enter-bot'}`}
                    >
                      {/* Bot Avatar: Strictly on the LEFT for Bot */}
                      {msg.sender === 'bot' && (
                        <div className="message-avatar bot-avatar">
                          <Bot size={18} />
                        </div>
                      )}

                      <div className="message-bubble-wrapper">
                        <div className={`message-bubble ${msg.sender}-bubble glassmorphic-card`}>
                          {msg.sender === 'bot' && !msg.content ? (
                            <div style={{ minWidth: '240px' }}>
                              <div className="thinking-indicator">
                                <div className="thinking-dot" style={{ animationDelay: '0s' }}></div>
                                <div className="thinking-dot" style={{ animationDelay: '0.15s' }}></div>
                                <div className="thinking-dot" style={{ animationDelay: '0.3s' }}></div>
                              </div>
                              <div className="thinking-shimmer" style={{ marginTop: '12px', height: '10px', borderRadius: '5px' }}></div>
                              <div className="thinking-shimmer" style={{ marginTop: '8px', height: '10px', borderRadius: '5px', width: '65%' }}></div>
                              <p style={{ fontSize: '12px', color: '#475569', marginTop: '10px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                <Sparkles size={13} style={{ color: '#2563EB' }} />
                                Synthesizing contract analysis...
                              </p>
                            </div>
                          ) : (
                            <div className="message-text-content">
                              {msg.content}
                            </div>
                          )}

                          {/* Verified Source Reference Badges — Secure & Minimal (No raw internal chunk dumps or internal scores) */}
                          {(() => {
                            let sourcesList: any[] = [];
                            if (Array.isArray(msg.sources)) {
                              sourcesList = msg.sources;
                            } else if (typeof msg.sources === 'string') {
                              try {
                                const parsed = JSON.parse(msg.sources);
                                if (Array.isArray(parsed)) sourcesList = parsed;
                              } catch {
                                sourcesList = [];
                              }
                            }
                            if (!sourcesList || sourcesList.length === 0) return null;
                            const uniqueDocNames = Array.from(new Set(sourcesList.map((s: any) => s?.document_name || s?.filename))).filter(Boolean);
                            if (uniqueDocNames.length === 0) return null;

                            return (
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                                  <ShieldCheck size={13} style={{ color: '#10B981' }} /> Verified Sources:
                                </span>
                                {uniqueDocNames.map((docName: any, idx: number) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 500,
                                      padding: '2px 9px',
                                      borderRadius: '12px',
                                      background: 'rgba(30, 41, 59, 0.65)',
                                      border: '1px solid rgba(255, 255, 255, 0.12)',
                                      color: '#93C5FD',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
                                    }}
                                  >
                                    <BookOpen size={10} style={{ color: '#38BDF8' }} /> {docName}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Action Bar for Bot Messages */}
                          {msg.sender === 'bot' && msg.content && msg.content.trim().length > 0 && (
                            <div className="message-actions-bar">
                              <button
                                onClick={() => copyToClipboard(msg.content, `msg-${msg.id}`)}
                                className="msg-action-btn"
                                title="Copy response"
                              >
                                {copiedCodeId === `msg-${msg.id}` ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                                <span>{copiedCodeId === `msg-${msg.id}` ? 'Copied' : 'Copy'}</span>
                              </button>

                              <button
                                onClick={() => speakText(msg.id, msg.content)}
                                className="msg-action-btn"
                                title="Read aloud"
                              >
                                {speakingMessageId === msg.id ? <VolumeX size={14} color="#DC2626" /> : <Volume2 size={14} />}
                                <span>{speakingMessageId === msg.id ? 'Stop' : 'Listen'}</span>
                              </button>

                              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'thumbs_up')}
                                  className={`feedback-btn ${msg.feedback?.rating === 'thumbs_up' ? 'active-up' : ''}`}
                                  title="Accurate Answer"
                                >
                                  <ThumbsUp size={14} />
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'thumbs_down')}
                                  className={`feedback-btn ${msg.feedback?.rating === 'thumbs_down' ? 'active-down' : ''}`}
                                  title="Inaccurate / Hallucination"
                                >
                                  <ThumbsDown size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <span className="message-timestamp">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>

                      {/* User Avatar: Strictly on the RIGHT for User */}
                      {msg.sender === 'user' && (
                        <div className="message-avatar user-avatar">
                          <User size={18} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Visible, Attractive AI Prompt Dock */}
        {currentView === 'chat' && (
          <div className="chat-input-dock">
            {isListening && (
              <div className="listening-banner animate-fadeInUp">
                <div className="soundwave">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
                <span>Listening to speech... Speak your legal query</span>
              </div>
            )}

            <div className="prompt-bar-card">
              {/* Mic / Dictation Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`prompt-action-btn mic-btn ${isListening ? 'is-active' : ''}`}
                title={isListening ? 'Stop listening' : 'Dictate with microphone'}
              >
                <Mic size={18} />
              </button>

              {/* Textarea with High Contrast */}
              <div className="prompt-textarea-container">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  rows={1}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_INPUT_CHARS) {
                      setInputText(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask a legal query regarding contract terms... (Press Enter to send)"
                  className="prompt-textarea"
                  disabled={isListening || isGenerating}
                />
              </div>

              {/* Right Side Actions */}
              <div className="prompt-right-actions">
                {inputText.length > 0 && (
                  <span className={`prompt-char-counter ${inputText.length > MAX_INPUT_CHARS * 0.9 ? 'limit-warning' : ''}`}>
                    {inputText.length}/{MAX_INPUT_CHARS}
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isGenerating}
                  className={`prompt-send-btn ${inputText.trim() && !isGenerating ? 'active' : ''}`}
                  title="Send Message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* Helpful dock guidance */}
            <div className="prompt-dock-footer">
              <span>Press <kbd>Enter</kbd> to send, <kbd>Shift + Enter</kbd> for new line • Grounded in verified contract clauses</span>
            </div>
          </div>
        )}
      </main>

      {/* Delete Chat Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <h3 className="modal-title">Delete Chat Session</h3>
            <p className="modal-desc">
              Are you sure you want to permanently erase this session?
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
                onClick={confirmDeleteConversation}
                className="btn-3d btn-3d-primary"
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  background: '#DC2626',
                  color: '#FFFFFF'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Delete Confirmation Modal */}
      {docToDelete && (
        <div className="modal-overlay" onClick={() => !deletingDocId && setDocToDelete(null)}>
          <div
            className="modal-content animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              textAlign: 'center',
              maxWidth: '440px',
              padding: '28px 24px',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(37, 99, 235, 0.2)',
              borderRadius: '16px'
            }}
          >
            <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFFFFF', marginBottom: '8px' }}>
              Delete Document?
            </h3>
            <p className="modal-desc" style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6', marginBottom: '24px' }}>
              Permanently delete "{docToDelete.filename}"? All indexed chunks will be purged.
            </p>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setDocToDelete(null)}
                disabled={!!deletingDocId}
                className="btn-3d btn-3d-secondary"
                style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDocument(docToDelete.id)}
                disabled={!!deletingDocId}
                className="btn-3d btn-3d-primary"
                style={{
                  padding: '9px 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  background: '#DC2626',
                  color: '#FFFFFF'
                }}
              >
                {deletingDocId ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
