import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, Boolean, Float
from sqlalchemy.orm import relationship
from database import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(100), nullable=False)
    agent_type = Column(String(50), default="general")
    created_at = Column(DateTime, default=utc_now)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    conversation_id = Column(String(50), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String(20), nullable=False)  # 'user' or 'bot'
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True) # JSON-serialized list of retrieved chunks
    timestamp = Column(DateTime, default=utc_now)

    conversation = relationship("Conversation", back_populates="messages")
    feedback = relationship("Feedback", back_populates="message", uselist=False, cascade="all, delete-orphan")

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, unique=True)
    rating = Column(String(10), nullable=False)  # 'thumbs_up' or 'thumbs_down'
    comment = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    message = relationship("Message", back_populates="feedback")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(200), nullable=False)
    uploaded_at = Column(DateTime, default=utc_now)

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(String(50), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=False) # JSON-serialized float array

    document = relationship("Document", back_populates="chunks")

# Week 5: Trace & Error Analysis Models
class Trace(Base):
    __tablename__ = "traces"

    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(50), nullable=True)
    message_id = Column(Integer, nullable=True)
    query = Column(Text, nullable=False)
    agent_type = Column(String(50), default="general")
    track_code = Column(String(10), default="A") # Track A-F (A: Customer Support, B: Recipes, C: HR, D: Insurance, E: Dev Docs, F: Legal)
    system_prompt = Column(Text, nullable=True)
    retrieved_chunks_json = Column(Text, nullable=True) # JSON array of retrieved context chunks with scores
    llm_response = Column(Text, nullable=False)
    latency_ms = Column(Integer, default=0)
    timestamp = Column(DateTime, default=utc_now)

    annotation = relationship("TraceAnnotation", back_populates="trace", uselist=False, cascade="all, delete-orphan")

class TraceAnnotation(Base):
    __tablename__ = "trace_annotations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    trace_id = Column(String(50), ForeignKey("traces.id", ondelete="CASCADE"), nullable=False, unique=True)
    is_failure = Column(Boolean, nullable=False, default=True) # True = Failure, False = Pass
    honest_note = Column(Text, nullable=False) # Open-coding note: 1 honest sentence before categorization
    category_name = Column(String(100), nullable=True) # Problem taxonomy category
    severity = Column(String(20), default="medium") # 'low', 'medium', 'high', 'critical'
    annotated_at = Column(DateTime, default=utc_now)

    trace = relationship("Trace", back_populates="annotation")

class ErrorTaxonomyCategory(Base):
    __tablename__ = "error_taxonomy_categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_chosen_target = Column(Boolean, default=False)
    target_prediction = Column(Text, nullable=True) # Written prediction before fixing

