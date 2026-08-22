import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
  CreditCard, 
  Wrench, 
  RefreshCw,
  BookOpen,
  Upload,
  FileText,
  Search,
  AlertTriangle,
  ShieldAlert,
  Target,
  Award,
  Sparkles,
  Layers,
  Filter
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


  // Refs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitializingRef = useRef(false);

  const formatTimestamp = (ts: any) => {
    if (!ts) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const str = typeof ts === 'string' ? ts : (ts instanceof Date ? ts.toISOString() : String(ts));
    const utcStr = str.endsWith('Z') || str.includes('+') ? str : `${str}Z`;
    try {
      return new Date(utcStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  // RAG / Knowledge Base State
  const [currentView, setCurrentView] = useState<'chat' | 'kb' | 'debugger' | 'error_analysis'>('chat');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Week 4 RAG Debugger State
  const [inspectQuery, setInspectQuery] = useState('ERR-4032');
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [evalMetrics, setEvalMetrics] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Week 5 Evals & Error Analysis State
  const [traces, setTraces] = useState<any[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<any | null>(null);
  const [taxonomySummary, setTaxonomySummary] = useState<any | null>(null);
  const [isFetchingTraces, setIsFetchingTraces] = useState(false);
  const [isSeedingTraces, setIsSeedingTraces] = useState(false);
  const [eaTrackFilter, setEaTrackFilter] = useState('ALL');
  const [eaStatusFilter, setEaStatusFilter] = useState('all');
  const [eaSubTab, setEaSubTab] = useState<'traces' | 'taxonomy' | 'report'>('traces');

  // Open coding form state
  const [openCodeNote, setOpenCodeNote] = useState('');
  const [openCodeCategory, setOpenCodeCategory] = useState('');
  const [openCodeIsFailure, setOpenCodeIsFailure] = useState(true);
  const [openCodeSeverity, setOpenCodeSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);

  // Target fix prediction state
  const [targetPredictionInput, setTargetPredictionInput] = useState('');
  const [isSavingPrediction, setIsSavingPrediction] = useState(false);
  const [copyReportSuccess, setCopyReportSuccess] = useState(false);

  const fetchTraces = async (track = eaTrackFilter, status = eaStatusFilter) => {
    setIsFetchingTraces(true);
    try {
      const url = `${API_BASE}/traces?sample_size=20&track=${track}&status_filter=${status}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTraces(data);
        if (data.length > 0 && (!selectedTrace || !data.find((t: any) => t.id === selectedTrace.id))) {
          loadTraceIntoForm(data[0]);
        }
      }
    } catch (e) {
      console.error("Error fetching traces:", e);
    } finally {
      setIsFetchingTraces(false);
    }
  };

  const fetchTaxonomySummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/error-analysis/taxonomy`);
      if (res.ok) {
        const data = await res.json();
        setTaxonomySummary(data);
        if (data.chosen_target && data.chosen_target.prediction) {
          setTargetPredictionInput(data.chosen_target.prediction);
        }
      }
    } catch (e) {
      console.error("Error fetching taxonomy summary:", e);
    }
  };

  const loadTraceIntoForm = (trace: any) => {
    setSelectedTrace(trace);
    if (trace.annotation) {
      setOpenCodeIsFailure(trace.annotation.is_failure);
      setOpenCodeNote(trace.annotation.honest_note || '');
      setOpenCodeCategory(trace.annotation.category_name || '');
      setOpenCodeSeverity(trace.annotation.severity || 'medium');
    } else {
      setOpenCodeIsFailure(true);
      setOpenCodeNote('');
      setOpenCodeCategory('');
      setOpenCodeSeverity('medium');
    }
  };

  const handleSeedTraces = async () => {
    setIsSeedingTraces(true);
    try {
      const res = await fetch(`${API_BASE}/error-analysis/seed`, { method: 'POST' });
      if (res.ok) {
        await fetchTraces();
        await fetchTaxonomySummary();
      }
    } catch (e) {
      console.error("Error seeding traces:", e);
    } finally {
      setIsSeedingTraces(false);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!selectedTrace) return;
    if (openCodeIsFailure && !openCodeNote.trim()) {
      alert("Please write one honest sentence about what went wrong before saving!");
      return;
    }
    setIsSavingAnnotation(true);
    try {
      const res = await fetch(`${API_BASE}/traces/${selectedTrace.id}/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_failure: openCodeIsFailure,
          honest_note: openCodeNote,
          category_name: openCodeCategory || (openCodeIsFailure ? "Unclassified Failure" : null),
          severity: openCodeSeverity
        })
      });
      if (res.ok) {
        await fetchTraces();
        await fetchTaxonomySummary();
      }
    } catch (e) {
      console.error("Error saving annotation:", e);
    } finally {
      setIsSavingAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async () => {
    if (!selectedTrace) return;
    try {
      const res = await fetch(`${API_BASE}/traces/${selectedTrace.id}/annotate`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTraces();
        await fetchTaxonomySummary();
      }
    } catch (e) {
      console.error("Error deleting annotation:", e);
    }
  };

  const handleSetFixTarget = async (categoryName: string, predictionText?: string) => {
    setIsSavingPrediction(true);
    try {
      const textToSave = predictionText !== undefined ? predictionText : targetPredictionInput;
      const res = await fetch(`${API_BASE}/error-analysis/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_name: categoryName,
          prediction: textToSave
        })
      });
      if (res.ok) {
        await fetchTaxonomySummary();
      }
    } catch (e) {
      console.error("Error setting fix target:", e);
    } finally {
      setIsSavingPrediction(false);
    }
  };

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
      general: 'New Chat Session',
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
      title: 'AI Assistant',
      desc: 'How can I help you today? Ask questions, search knowledge, or get instant answers.',
      icon: <Bot style={{ color: '#FFFFFF' }} size={22} />,
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
            onClick={() => {
              setCurrentView('chat');
              handleStartChat(selectedAgent);
            }}
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
            style={{ flex: 1, padding: '6px 4px', borderRadius: '8px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
          >
            <Bot size={11} /> Chat
          </button>
          <button
            onClick={() => {
              setCurrentView('kb');
              fetchDocuments();
            }}
            className={`btn-3d ${currentView === 'kb' ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
            style={{ flex: 1, padding: '6px 4px', borderRadius: '8px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
          >
            <BookOpen size={11} /> KB
          </button>
          <button
            onClick={() => {
              setCurrentView('debugger');
              if (!inspectResult) handleInspectQuery("ERR-4032");
            }}
            className={`btn-3d ${currentView === 'debugger' ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
            style={{ flex: 1, padding: '6px 4px', borderRadius: '8px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
          >
            <Wrench size={11} /> RAG Debug
          </button>
          <button
            onClick={() => {
              setCurrentView('error_analysis');
              fetchTraces();
              fetchTaxonomySummary();
            }}
            className={`btn-3d ${currentView === 'error_analysis' ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
            style={{ flex: 1, padding: '6px 4px', borderRadius: '8px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
          >
            <AlertTriangle size={11} /> Error Eval
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
        
        {/* Active Header Bar */}
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
        ) : currentView === 'error_analysis' ? (
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-header-avatar" style={{ background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' }}>
                <AlertTriangle size={18} style={{ color: '#FFFFFF' }} />
              </div>
              <div>
                <h3 className="chat-header-title">Week 5 · Error Analysis & Evals</h3>
                <span className="chat-header-subtitle">Read traces by hand, open-code notes, rank problem taxonomy (Frequency × Severity)</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleSeedTraces}
                disabled={isSeedingTraces}
                className="btn-3d btn-3d-secondary"
                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Seed 20 realistic trace examples across Tracks A-F"
              >
                {isSeedingTraces ? <RefreshCw size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                Seed 20 Sample Traces
              </button>
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
            ) : currentView === 'error_analysis' ? (
              /* WEEK 5 EVALS & ERROR ANALYSIS VIEW */
              <div className="error-analysis-container animate-scale-in" style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. TOP STATS OVERVIEW HEADER CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Sampled Traces Read</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF' }}>
                      {taxonomySummary ? `${taxonomySummary.sample_size} / 20` : '0 / 20'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#10B981', display: 'block', marginTop: '2px' }}>Fair sample collected</span>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Pass vs Failure Rate</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        ✓ {taxonomySummary ? taxonomySummary.passes_count : 0} Pass
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        ✕ {taxonomySummary ? taxonomySummary.failures_count : 0} Fail
                      </span>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Open-Coded Notes</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#38BDF8' }}>
                      {taxonomySummary ? taxonomySummary.annotated_count : 0} Notes
                    </span>
                    <span style={{ fontSize: '10px', color: '#A3A3A3', display: 'block', marginTop: '2px' }}>Written before grouping</span>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Top Ranked Problem</span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#F59E0B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {taxonomySummary && taxonomySummary.ranked_taxonomy.length > 0 ? `#1 ${taxonomySummary.ranked_taxonomy[0].category_name}` : 'None'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#A3A3A3', display: 'block', marginTop: '2px' }}>
                      Score (F×S): {taxonomySummary && taxonomySummary.ranked_taxonomy.length > 0 ? taxonomySummary.ranked_taxonomy[0].score : 0}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '14px', padding: '14px 16px' }}>
                    <span style={{ fontSize: '11px', color: '#A855F7', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Target Fix Selected</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#FFFFFF', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {taxonomySummary && taxonomySummary.chosen_target ? taxonomySummary.chosen_target.category_name : 'No Target Set'}
                    </span>
                    <span style={{ fontSize: '10px', color: taxonomySummary && taxonomySummary.chosen_target?.prediction ? '#10B981' : '#F59E0B', display: 'block', marginTop: '2px' }}>
                      {taxonomySummary && taxonomySummary.chosen_target?.prediction ? '✓ Prediction written' : '⚠️ Awaiting prediction'}
                    </span>
                  </div>
                </div>

                {/* 2. SUB-NAVIGATION TABS */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', gap: '8px' }}>
                  <button
                    onClick={() => setEaSubTab('traces')}
                    style={{
                      padding: '10px 18px',
                      background: 'none',
                      border: 'none',
                      borderBottom: eaSubTab === 'traces' ? '2px solid #38BDF8' : '2px solid transparent',
                      color: eaSubTab === 'traces' ? '#38BDF8' : '#A3A3A3',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Search size={14} /> 1. Hand-Read Traces & Open Code ({traces.length})
                  </button>

                  <button
                    onClick={() => {
                      setEaSubTab('taxonomy');
                      fetchTaxonomySummary();
                    }}
                    style={{
                      padding: '10px 18px',
                      background: 'none',
                      border: 'none',
                      borderBottom: eaSubTab === 'taxonomy' ? '2px solid #A855F7' : '2px solid transparent',
                      color: eaSubTab === 'taxonomy' ? '#A855F7' : '#A3A3A3',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Layers size={14} /> 2. Ranked Error Taxonomy (Frequency × Severity)
                  </button>

                  <button
                    onClick={() => {
                      setEaSubTab('report');
                      fetchTaxonomySummary();
                    }}
                    style={{
                      padding: '10px 18px',
                      background: 'none',
                      border: 'none',
                      borderBottom: eaSubTab === 'report' ? '2px solid #10B981' : '2px solid transparent',
                      color: eaSubTab === 'report' ? '#10B981' : '#A3A3A3',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Award size={14} /> 3. Deliverable & Mentor Review Report
                  </button>
                </div>

                {/* 3. SUB-TAB 1: TRACES & OPEN CODING INTERFACE */}
                {eaSubTab === 'traces' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Track & Status Filters */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Filter size={12} /> Filter Track:
                      </span>
                      {[
                        { code: 'ALL', label: 'All Tracks' },
                        { code: 'A', label: 'Track A: Support' },
                        { code: 'B', label: 'Track B: Recipes' },
                        { code: 'C', label: 'Track C: HR Policy' },
                        { code: 'D', label: 'Track D: Insurance' },
                        { code: 'E', label: 'Track E: Dev Docs' },
                        { code: 'F', label: 'Track F: Legal' }
                      ].map((t) => (
                        <button
                          key={t.code}
                          onClick={() => {
                            setEaTrackFilter(t.code);
                            fetchTraces(t.code, eaStatusFilter);
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            border: '1px solid',
                            cursor: 'pointer',
                            background: eaTrackFilter === t.code ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                            borderColor: eaTrackFilter === t.code ? '#38BDF8' : 'rgba(255,255,255,0.08)',
                            color: eaTrackFilter === t.code ? '#38BDF8' : '#A3A3A3',
                            fontWeight: eaTrackFilter === t.code ? 'bold' : 'normal'
                          }}
                        >
                          {t.label}
                        </button>
                      ))}

                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: 'bold' }}>Status:</span>
                        {['all', 'unannotated', 'failure', 'pass'].map((st) => (
                          <button
                            key={st}
                            onClick={() => {
                              setEaStatusFilter(st);
                              fetchTraces(eaTrackFilter, st);
                            }}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              textTransform: 'capitalize',
                              cursor: 'pointer',
                              background: eaStatusFilter === st ? '#FFFFFF' : 'rgba(255,255,255,0.05)',
                              color: eaStatusFilter === st ? '#000000' : '#A3A3A3',
                              fontWeight: 'bold',
                              border: 'none'
                            }}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Split View: Trace List + Inspector Form */}
                    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '16px', alignItems: 'start' }}>
                      
                      {/* Left: Scrollable List of 20 Sampled Traces */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
                        {isFetchingTraces ? (
                          <div style={{ padding: '40px', textAlign: 'center', color: '#A3A3A3', fontSize: '12px' }}>
                            <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                            <div style={{ marginTop: '8px' }}>Fetching traces...</div>
                          </div>
                        ) : traces.length === 0 ? (
                          <div style={{ padding: '30px', textAlign: 'center', color: '#A3A3A3', fontSize: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                            No traces match criteria. Click "Seed 20 Sample Traces" to populate!
                          </div>
                        ) : (
                          traces.map((trace) => {
                            const isSelected = selectedTrace && selectedTrace.id === trace.id;
                            const anno = trace.annotation;
                            return (
                              <div
                                key={trace.id}
                                onClick={() => loadTraceIntoForm(trace)}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: '12px',
                                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                  border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.06)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                    Track {trace.track_code}
                                  </span>
                                  
                                  {anno ? (
                                    anno.is_failure ? (
                                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#EF4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        ✕ Fail ({anno.severity})
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        ✓ Pass
                                      </span>
                                    )
                                  ) : (
                                    <span style={{ fontSize: '10px', color: '#A3A3A3', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                                      Unannotated
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {trace.query}
                                </div>

                                {anno && anno.honest_note && (
                                  <div style={{ fontSize: '11px', color: '#A3A3A3', fontStyle: 'italic', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '6px', marginTop: '6px' }}>
                                    "{anno.honest_note}"
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Right: Detailed Complete Trace Inspector & Open Coding Form */}
                      {selectedTrace ? (
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          
                          {/* Top Bar Details */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>Trace Details: {selectedTrace.id}</span>
                              <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#E2E8F0' }}>Track {selectedTrace.track_code}</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#A3A3A3' }}>Latency: {selectedTrace.latency_ms}ms</span>
                          </div>

                          {/* Section A: User Question */}
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>1. User Request / Question</span>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#FFFFFF', background: 'rgba(0,0,0,0.4)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              {selectedTrace.query}
                            </div>
                          </div>

                          {/* Section B: Retrieved Context Chunks */}
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>2. What the App Fetched (Retrieved Chunks)</span>
                            {(() => {
                              try {
                                const chunks = selectedTrace.retrieved_chunks_json ? JSON.parse(selectedTrace.retrieved_chunks_json) : [];
                                if (!chunks || chunks.length === 0) {
                                  return (
                                    <div style={{ fontSize: '12px', color: '#EF4444', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                                      ⚠️ No reference chunks were retrieved for this query.
                                    </div>
                                  );
                                }
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {chunks.map((c: any, idx: number) => (
                                      <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px', fontSize: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38BDF8', fontWeight: 'bold', marginBottom: '4px' }}>
                                          <span>File: {c.filename}</span>
                                          {c.score && <span>Score: {c.score}</span>}
                                        </div>
                                        <p style={{ margin: 0, color: '#A3A3A3', fontFamily: 'monospace' }}>"{c.content}"</p>
                                      </div>
                                    ))}
                                  </div>
                                );
                              } catch {
                                return <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Raw Context: {selectedTrace.retrieved_chunks_json}</div>;
                              }
                            })()}
                          </div>

                          {/* Section C: What the App Answered */}
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>3. What the App Answered</span>
                            <div style={{ fontSize: '12px', color: '#E2E8F0', background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                              {selectedTrace.llm_response}
                            </div>
                          </div>

                          {/* Section D: OPEN CODING & EVALUATION FORM */}
                          <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', padding: '16px', marginTop: '6px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldAlert size={16} style={{ color: '#38BDF8' }} /> Hand-Coding & Error Annotation
                            </h4>
                            <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#A3A3A3' }}>
                              Requirement: Read the answer honestly and write <strong>one sentence about what went wrong</strong> before assigning problem category.
                            </p>

                            {/* Pass / Fail Toggle */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                              <button
                                type="button"
                                onClick={() => setOpenCodeIsFailure(false)}
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  background: !openCodeIsFailure ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                                  borderColor: !openCodeIsFailure ? '#10B981' : 'rgba(255,255,255,0.1)',
                                  color: !openCodeIsFailure ? '#10B981' : '#A3A3A3',
                                  fontWeight: 'bold',
                                  fontSize: '12px'
                                }}
                              >
                                ✓ Pass (Answer Accurate)
                              </button>

                              <button
                                type="button"
                                onClick={() => setOpenCodeIsFailure(true)}
                                style={{
                                  flex: 1,
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  background: openCodeIsFailure ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)',
                                  borderColor: openCodeIsFailure ? '#EF4444' : 'rgba(255,255,255,0.1)',
                                  color: openCodeIsFailure ? '#EF4444' : '#A3A3A3',
                                  fontWeight: 'bold',
                                  fontSize: '12px'
                                }}
                              >
                                ✕ Failure (Has Issue)
                              </button>
                            </div>

                            {/* Honest Sentence Note Input */}
                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#E2E8F0', marginBottom: '4px' }}>
                                Honest Open-Coding Note (1 Sentence):
                              </label>
                              <textarea
                                value={openCodeNote}
                                onChange={(e) => setOpenCodeNote(e.target.value)}
                                placeholder="Describe exactly what failed (e.g. LLM recommended 1:1 almond flour swap ignoring retrieved gluten warning)..."
                                style={{ width: '100%', height: '60px', padding: '10px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#FFFFFF', fontSize: '12px', fontFamily: 'inherit' }}
                              />
                            </div>

                            {openCodeIsFailure && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px', marginBottom: '14px' }}>
                                {/* Category Name */}
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#E2E8F0', marginBottom: '4px' }}>
                                    Problem Category Name:
                                  </label>
                                  <input
                                    type="text"
                                    value={openCodeCategory}
                                    onChange={(e) => setOpenCodeCategory(e.target.value)}
                                    placeholder="e.g. Hallucination / Fact Distortion"
                                    list="category-suggestions"
                                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#FFFFFF', fontSize: '12px' }}
                                  />
                                  <datalist id="category-suggestions">
                                    <option value="Hallucination / Fact Distortion" />
                                    <option value="Context Ignoring / Misleading Advice" />
                                    <option value="Missing Context / Ungrounded Generation" />
                                    <option value="Incorrect Technical Instructions" />
                                    <option value="Formatting / JSON Structure Failure" />
                                  </datalist>
                                </div>

                                {/* Severity Selector */}
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#E2E8F0', marginBottom: '4px' }}>
                                    Severity (S):
                                  </label>
                                  <select
                                    value={openCodeSeverity}
                                    onChange={(e: any) => setOpenCodeSeverity(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#FFFFFF', fontSize: '12px' }}
                                  >
                                    <option value="low">Low (1x)</option>
                                    <option value="medium">Medium (2x)</option>
                                    <option value="high">High (3x)</option>
                                    <option value="critical">Critical (4x)</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                              {selectedTrace.annotation && (
                                <button
                                  type="button"
                                  onClick={handleDeleteAnnotation}
                                  className="btn-3d btn-3d-secondary"
                                  style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#EF4444' }}
                                >
                                  Clear Annotation
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleSaveAnnotation}
                                disabled={isSavingAnnotation}
                                className="btn-3d btn-3d-primary"
                                style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '11px' }}
                              >
                                {isSavingAnnotation ? 'Saving...' : 'Save Annotation'}
                              </button>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#A3A3A3', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
                          Select a trace from the left panel to inspect and open code.
                        </div>
                      )}

                    </div>

                  </div>
                )}

                {/* 4. SUB-TAB 2: RANKED ERROR TAXONOMY (F × S) */}
                {eaSubTab === 'taxonomy' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 'bold', color: '#FFFFFF' }}>
                        Ranked Error Taxonomy Matrix (Frequency × Severity)
                      </h4>
                      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#A3A3A3' }}>
                        Calculated ranking: <strong>Error Score = Frequency (F) × Average Severity Weight (S)</strong>. Surface what hurts most first.
                      </p>

                      {taxonomySummary && taxonomySummary.ranked_taxonomy.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {taxonomySummary.ranked_taxonomy.map((item: any) => {
                            const isTarget = item.is_chosen_target;
                            return (
                              <div
                                key={item.category_name}
                                style={{
                                  background: isTarget ? 'rgba(168, 85, 247, 0.08)' : 'rgba(0,0,0,0.3)',
                                  border: isTarget ? '1px solid #A855F7' : '1px solid rgba(255,255,255,0.06)',
                                  borderRadius: '14px',
                                  padding: '16px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                      fontSize: '14px',
                                      fontWeight: '900',
                                      color: item.rank === 1 ? '#F59E0B' : '#E2E8F0',
                                      background: 'rgba(255,255,255,0.1)',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      #{item.rank}
                                    </span>
                                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF' }}>{item.category_name}</span>
                                    {isTarget && (
                                      <span style={{ fontSize: '11px', background: '#A855F7', color: '#FFFFFF', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                        ★ Chosen #1 Fix Target
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ display: 'block', fontSize: '10px', color: '#A3A3A3' }}>Freq × Sev Score</span>
                                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#F59E0B' }}>{item.score}</span>
                                    </div>
                                    <button
                                      onClick={() => handleSetFixTarget(item.category_name)}
                                      className={`btn-3d ${isTarget ? 'btn-3d-primary' : 'btn-3d-secondary'}`}
                                      style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px' }}
                                    >
                                      {isTarget ? 'Selected Target' : 'Set as #1 Target'}
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94A3B8', marginBottom: '10px' }}>
                                  <span>Frequency (F): <strong>{item.frequency} trace(s)</strong></span>
                                  <span>Avg Severity Weight (S): <strong>{item.avg_severity_weight}x</strong></span>
                                </div>

                                {/* List of Honest Notes under this category */}
                                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px 12px' }}>
                                  <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Honest Open-Coding Notes:</span>
                                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#E2E8F0', lineHeight: '1.5' }}>
                                    {item.honest_notes.map((note: string, idx: number) => (
                                      <li key={idx} style={{ marginBottom: '2px' }}>{note}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#A3A3A3', fontSize: '12px' }}>
                          No annotated failure categories yet. Hand-read traces in Sub-Tab 1 to build the taxonomy!
                        </div>
                      )}
                    </div>

                    {/* TARGET FIX PREDICTION EDITOR */}
                    {taxonomySummary && taxonomySummary.chosen_target && (
                      <div style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold', color: '#A855F7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Target size={16} /> Target Fix Selection & Written Prediction
                        </h4>
                        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#E2E8F0' }}>
                          Target Category: <strong>{taxonomySummary.chosen_target.category_name}</strong>
                        </p>

                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#E2E8F0', marginBottom: '4px' }}>
                            Write Prediction First (What do you expect to happen after fixing this problem?):
                          </label>
                          <textarea
                            value={targetPredictionInput}
                            onChange={(e) => setTargetPredictionInput(e.target.value)}
                            placeholder="e.g. By reinforcing strict context grounding in system prompt and lowering temperature, we predict hallucination rate will drop by 75% on factual policy queries..."
                            style={{ width: '100%', height: '80px', padding: '10px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', color: '#FFFFFF', fontSize: '12px', fontFamily: 'inherit' }}
                          />
                        </div>

                        <button
                          onClick={() => handleSetFixTarget(taxonomySummary.chosen_target.category_name, targetPredictionInput)}
                          disabled={isSavingPrediction}
                          className="btn-3d btn-3d-primary"
                          style={{ padding: '6px 16px', borderRadius: '8px', fontSize: '11px', background: '#A855F7', borderColor: '#A855F7' }}
                        >
                          {isSavingPrediction ? 'Saving...' : 'Save Written Prediction'}
                        </button>
                      </div>
                    )}

                  </div>
                )}

                {/* 5. SUB-TAB 3: DELIVERABLE & MENTOR REVIEW REPORT */}
                {eaSubTab === 'report' && taxonomySummary && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', color: '#FFFFFF' }}>Week 5 Deliverable · Mentor Review Summary</h3>
                        <span style={{ fontSize: '12px', color: '#A3A3A3' }}>Evaluated Task Brief: Traces Hand-Read, Open Coding, Ranked Taxonomy, Chosen Target & Written Prediction</span>
                      </div>

                      <button
                        onClick={() => {
                          const markdownReport = `# Week 5 Module 3 Deliverable: Error Analysis & Ranked Taxonomy

## 1. Fair Sample Audit
- Total Traces Read by Hand: ${taxonomySummary.sample_size} / 20 Traces
- Pass Count: ${taxonomySummary.passes_count}
- Failure Count: ${taxonomySummary.failures_count}

## 2. Honest Open-Coding Notes Log
${traces.filter(t => t.annotation?.is_failure).map(t => `- [Track ${t.track_code}] Query: "${t.query}"\n  Honest Note: "${t.annotation?.honest_note}"\n  Category: ${t.annotation?.category_name} (Severity: ${t.annotation?.severity})`).join('\n\n')}

## 3. Ranked Error Taxonomy Table (Frequency x Severity)
${taxonomySummary.ranked_taxonomy.map((item: any) => `### Rank #${item.rank}: ${item.category_name}
- Score: ${item.score} (Frequency: ${item.frequency}, Avg Severity Weight: ${item.avg_severity_weight}x)
- Honest Notes:
${item.honest_notes.map((n: string) => `  * ${n}`).join('\n')}`).join('\n\n')}

## 4. Chosen Fix Target & Written Prediction
- Selected #1 Target: ${taxonomySummary.chosen_target ? taxonomySummary.chosen_target.category_name : 'None'}
- Written Prediction: "${taxonomySummary.chosen_target?.prediction || 'N/A'}"
`;
                          navigator.clipboard.writeText(markdownReport);
                          setCopyReportSuccess(true);
                          setTimeout(() => setCopyReportSuccess(false), 2000);
                        }}
                        className="btn-3d btn-3d-primary"
                        style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {copyReportSuccess ? <Check size={14} /> : <Copy size={14} />}
                        {copyReportSuccess ? 'Copied to Clipboard!' : 'Copy Deliverable Markdown'}
                      </button>
                    </div>

                    {/* Deliverable Document Preview */}
                    <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', fontSize: '13px', color: '#E2E8F0', lineHeight: '1.6' }}>
                      <h4 style={{ color: '#38BDF8', marginTop: 0 }}>✓ Mentor Check 1: Fair Random Sample Audit</h4>
                      <p>Read <strong>{taxonomySummary.sample_size} real traces</strong> across Tracks A-F. Identified {taxonomySummary.passes_count} accurate passes and {taxonomySummary.failures_count} real failures.</p>

                      <h4 style={{ color: '#A855F7', marginTop: '16px' }}>✓ Mentor Check 2: Honest Notes Per Failure (Before Categorization)</h4>
                      <p>Every failure trace was evaluated individually with one honest sentence note describing what went wrong before grouping into categories.</p>

                      <h4 style={{ color: '#F59E0B', marginTop: '16px' }}>✓ Mentor Check 3: Ranked Error Taxonomy Table (Frequency × Severity)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                        {taxonomySummary.ranked_taxonomy.map((item: any) => (
                          <div key={item.category_name} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', borderLeft: item.is_chosen_target ? '4px solid #A855F7' : '4px solid #38BDF8' }}>
                            <div style={{ fontWeight: 'bold', color: '#FFFFFF' }}>Rank #{item.rank}: {item.category_name} (Score: {item.score})</div>
                            <div style={{ fontSize: '11px', color: '#A3A3A3' }}>Freq: {item.frequency} traces | Sev Weight: {item.avg_severity_weight}x</div>
                          </div>
                        ))}
                      </div>

                      <h4 style={{ color: '#10B981', marginTop: '16px' }}>✓ Mentor Check 4: Chosen Target & Written Prediction</h4>
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: '#10B981' }}>Chosen #1 Target: {taxonomySummary.chosen_target ? taxonomySummary.chosen_target.category_name : 'Not set'}</div>
                        <p style={{ margin: '6px 0 0 0', fontStyle: 'italic', color: '#FFFFFF' }}>"{taxonomySummary.chosen_target?.prediction || 'No prediction recorded yet.'}"</p>
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
                                  <span>{formatTimestamp(m.timestamp)}</span>
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
                                {formatTimestamp(m.timestamp)}
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
