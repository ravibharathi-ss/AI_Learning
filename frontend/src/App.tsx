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
  Scale
} from 'lucide-react';

import { Sidebar } from './components/Sidebar';

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

const API_BASE = 'http://localhost:8000/api';

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
      const res = await fetch('http://localhost:8000/health');
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
      const res = await fetch(`${API_BASE}/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !activeConvId) {
          setActiveConvId(data[0].id);
          loadConversation(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching conversations:', e);
    }
  };

  const loadConversation = async (convId: string) => {
    setIsLoadingMessages(true);
    setActiveConvId(convId);
    try {
      const res = await fetch(`${API_BASE}/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_type: 'legal_specialist' })
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations([newConv, ...conversations]);
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
      const res = await fetch(`${API_BASE}/conversations/${convIdToDelete}`, { method: 'DELETE' });
      if (res.ok) {
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
    if (!inputText.trim() || isGenerating) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      try {
        const res = await fetch(`${API_BASE}/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_type: 'legal_specialist' })
        });
        if (res.ok) {
          const newConv = await res.json();
          targetConvId = newConv.id;
          setActiveConvId(newConv.id);
          setConversations([newConv, ...conversations]);
        } else {
          return;
        }
      } catch {
        return;
      }
    }

    if (!targetConvId) return;

    const userQuery = inputText.trim();
    setInputText('');

    const tempUserMsg: Message = {
      id: Date.now(),
      conversation_id: targetConvId,
      sender: 'user',
      content: userQuery,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsGenerating(true);

    try {
      const res = await fetch(`${API_BASE}/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userQuery, stream: false })
      });

      if (res.ok) {
        const botResponse = await res.json();
        setMessages((prev) => [...prev, botResponse]);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            conversation_id: targetConvId!,
            sender: 'bot',
            content: errJson.detail || 'An error occurred while generating the legal response.',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          conversation_id: targetConvId!,
          sender: 'bot',
          content: 'Network connection error. Please verify backend service status.',
          timestamp: new Date().toISOString()
        }
      ]);
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
      const res = await fetch(`${API_BASE}/documents/${docId}`, { method: 'DELETE' });
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

  return (
    <div className="app-container">
      {/* 1. SIDEBAR NAVIGATION */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view === 'kb') fetchDocuments();
        }}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={(id) => {
          setCurrentView('chat');
          loadConversation(id);
        }}
        onNewConversation={handleStartNewChat}
        onConfirmDelete={handleDeleteConversation}
        backendHealth={backendHealth}
      />

      {/* 2. MAIN APPLICATION CONTENT */}
      <main className="chat-main">
        {/* Header Bar */}
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-header-avatar">
              {currentView === 'kb' ? (
                <BookOpen size={18} style={{ color: '#2563EB' }} />
              ) : (
                <Scale size={18} style={{ color: '#2563EB' }} />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="chat-header-title">
                  {currentView === 'kb' ? 'Legal Contracts & Knowledge Base' : 'Legal Intelligence Assistant'}
                </h3>
                <span
                  className="chat-header-badge"
                  style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
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
            {currentView === 'kb' ? (
              /* KNOWLEDGE BASE VIEW */
              <div className="kb-container animate-scale-in" style={{ padding: '24px 0' }}>
                <div
                  style={{
                    background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    border: '1px solid #CBD5E1',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '24px'
                  }}
                >
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>
                    Upload Legal Agreement
                  </h4>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#2563EB' }}>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Parsing and indexing document vectors...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#0F172A' }}>
                      Indexed Agreements & Contracts
                    </h4>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: '#EFF6FF',
                        color: '#1D4ED8'
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
                      color: '#64748B',
                      fontSize: '14px',
                      background: '#FFFFFF',
                      border: '1px dashed #CBD5E1',
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
                          background: '#FFFFFF',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: '#EFF6FF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <FileCheck size={20} style={{ color: '#2563EB' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
                              {doc.filename}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
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
                {messages.length === 0 && !isLoadingMessages && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '80px 20px',
                      color: '#64748B',
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: '#EFF6FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: '#2563EB'
                      }}
                    >
                      <Bot size={28} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0F172A', marginBottom: '8px' }}>
                      Legal & Contracts Intelligence
                    </h3>
                    <p style={{ fontSize: '14px', color: '#475569', maxWidth: '520px', margin: '0 auto', lineHeight: '1.6' }}>
                      Ask questions about governing law, termination notice periods, liability caps, or GDPR standard clauses across all uploaded agreements.
                    </p>
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
                      className={`message-bubble-wrapper ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: '20px'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          maxWidth: '85%',
                          flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: msg.sender === 'user' ? '#3B82F6' : '#F1F5F9',
                            color: msg.sender === 'user' ? '#FFFFFF' : '#1E293B',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>

                        <div
                          style={{
                            background: msg.sender === 'user' ? '#2563EB' : '#FFFFFF',
                            color: msg.sender === 'user' ? '#FFFFFF' : '#0F172A',
                            padding: '14px 18px',
                            borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                            border: msg.sender === 'user' ? 'none' : '1px solid #E2E8F0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {msg.content}

                          {/* Sources & Citations Box */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div
                              style={{
                                marginTop: '14px',
                                paddingTop: '12px',
                                borderTop: '1px solid #E2E8F0',
                                fontSize: '12px'
                              }}
                            >
                              <div style={{ fontWeight: '600', color: '#475569', marginBottom: '8px' }}>
                                Verified Citations:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {msg.sources.map((src: any, idx: number) => (
                                  <div
                                    key={idx}
                                    style={{
                                      background: '#F8FAFC',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #E2E8F0'
                                    }}
                                  >
                                    <div style={{ fontWeight: '600', color: '#1E40AF', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{src.document_name}</span>
                                      {src.score && <span>Relevance: {(src.score * 100).toFixed(0)}%</span>}
                                    </div>
                                    <p style={{ margin: '4px 0 0 0', color: '#334155', fontStyle: 'italic' }}>
                                      "{src.snippet || src.content}"
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action Bar for Bot Messages */}
                          {msg.sender === 'bot' && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginTop: '10px',
                                paddingTop: '8px',
                                borderTop: '1px solid #F1F5F9',
                                color: '#64748B',
                                fontSize: '12px'
                              }}
                            >
                              <button
                                onClick={() => copyToClipboard(msg.content, `msg-${msg.id}`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B' }}
                                title="Copy response"
                              >
                                {copiedCodeId === `msg-${msg.id}` ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                                <span>{copiedCodeId === `msg-${msg.id}` ? 'Copied' : 'Copy'}</span>
                              </button>

                              <button
                                onClick={() => speakText(msg.id, msg.content)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B' }}
                                title="Read aloud"
                              >
                                {speakingMessageId === msg.id ? <VolumeX size={13} color="#DC2626" /> : <Volume2 size={13} />}
                                <span>{speakingMessageId === msg.id ? 'Stop' : 'Listen'}</span>
                              </button>

                              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'thumbs_up')}
                                  style={{
                                    background: msg.feedback?.rating === 'thumbs_up' ? '#DCFCE7' : 'none',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '3px 6px',
                                    cursor: 'pointer',
                                    color: msg.feedback?.rating === 'thumbs_up' ? '#16A34A' : '#64748B'
                                  }}
                                  title="Accurate Answer"
                                >
                                  <ThumbsUp size={13} />
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'thumbs_down')}
                                  style={{
                                    background: msg.feedback?.rating === 'thumbs_down' ? '#FEE2E2' : 'none',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '3px 6px',
                                    cursor: 'pointer',
                                    color: msg.feedback?.rating === 'thumbs_down' ? '#DC2626' : '#64748B'
                                  }}
                                  title="Inaccurate / Hallucination"
                                >
                                  <ThumbsDown size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isGenerating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748B', fontSize: '13px', margin: '16px 0' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                      <Bot size={16} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Synthesizing grounded answer from contract clauses...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Panel */}
        {currentView === 'chat' && (
          <div className="input-panel-floating">
            <div className="input-container-row">
              <button
                type="button"
                onClick={toggleListening}
                className={`btn-3d btn-3d-secondary ${isListening ? 'listening' : ''}`}
                title={isListening ? 'Stop listening' : 'Start dictation'}
              >
                <Mic size={18} />
              </button>

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
                  placeholder="Ask a legal query regarding contract terms... (e.g. 'What is the notice period for termination?')"
                  className="chat-textarea"
                  disabled={isListening || isGenerating}
                />

                <div className="absolute-send-btn">
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isGenerating}
                    className="btn-3d btn-3d-primary"
                    style={{ padding: '8px 14px', borderRadius: '10px' }}
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
            style={{ textAlign: 'center', maxWidth: '440px', padding: '28px 24px', background: '#FFFFFF', borderRadius: '16px' }}
          >
            <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 'bold', color: '#0F172A', marginBottom: '8px' }}>
              Delete Document?
            </h3>
            <p className="modal-desc" style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', marginBottom: '24px' }}>
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
