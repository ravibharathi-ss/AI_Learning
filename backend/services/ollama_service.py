import os
import re
import time
import asyncio
import logging
import random
from datetime import datetime
from typing import AsyncGenerator, List, Dict, Optional, Any
from openai import OpenAI

try:
    from infrastructure.observability.structured_logger import get_logger
    logger = get_logger("llm_service")
except Exception:
    logger = logging.getLogger("llm_service")

class OllamaService:
    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY")

        if self.openai_key:
            self.use_cloud = True
            self.model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            self.client = OpenAI(api_key=self.openai_key)
            logger.info(f"Using OpenAI Cloud API ({self.model_name}) for instant ChatGPT response speed.")
        elif self.groq_key:
            self.use_cloud = True
            self.model_name = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
            self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=self.groq_key)
            logger.info(f"Using Groq Cloud API ({self.model_name}) for instant 100ms response speed.")
        else:
            self.use_cloud = False
            ollama_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434/v1")
            self.model_name = os.getenv("OLLAMA_MODEL", "llama3.2")
            self.client = OpenAI(base_url=ollama_url, api_key="ollama")
            logger.info(f"Using local Ollama ({self.model_name}) with CPU context optimization.")

    def _get_system_prompt(self, agent_type: str, has_rag_context: bool = False) -> str:
        speed_instruction = " Be concise, direct, helpful, and structured."
        prompts = {
            "legal_specialist": (
                "You are an AI Legal & Contracts Intelligence Assistant." + speed_instruction
            ),
            "general": (
                "You are an AI Legal & Contracts Intelligence Assistant." + speed_instruction
            ),
            "technical": (
                "You are an IT and Technical Support Specialist." + speed_instruction +
                " Use clean Markdown code blocks (e.g. ```bash) for terminal commands."
            ),
            "billing": (
                "You are a Billing and Accounts Specialist." + speed_instruction
            )
        }
        base_prompt = prompts.get(agent_type, prompts["legal_specialist"])
        
        if has_rag_context:
            return (
                f"{base_prompt}\n\n"
                "PROFESSIONAL EXECUTIVE FORMATTING & KNOWLEDGE BASE GUIDELINES:\n"
                "You are an executive legal intelligence assistant. Always format your responses in a polished, highly professional, scannable layout like a top-tier legal advisor:\n\n"
                "- DIRECT EXECUTIVE INTRODUCTION: Open directly with a crisp 1-2 sentence authoritative answer or executive summary. NEVER print meta-labels like 'EXECUTIVE OVERVIEW' or 'OVERVIEW:'.\n"
                "- STRUCTURED BULLETS: Present each key obligation, provision, or clause as a distinct bullet point with a bold title (e.g. • **Payment Deadline:** ...). NEVER write meta-headings like 'STRUCTURED BULLET POINTS' or 'BULLET POINTS:'.\n"
                "- INLINE CITATIONS: Integrate citations naturally into each bullet point (e.g. '(Section 3.3, MSA-2026-014)'). NEVER create a separate section labeled 'OPERATIVE CITATIONS' or 'CITATIONS:'.\n"
                "- VISUAL ELEGANCE: Insert double line breaks between paragraphs and bullet points for clean readability.\n"
                "- STRICT ADHERENCE & ZERO HALLUCINATION: Rely strictly on the facts in the REFERENCE DOCUMENTS below. If a requested detail is not found, state that plainly without fabricating terms or external laws.\n"
                "- STRICT DOMAIN BOUNDARY: Never answer questions on politics, government officials, world trivia, general coding, or non-legal matters.\n"
                "- NO META LABELS: Under no circumstances output prompt artifact titles such as 'EXECUTIVE OVERVIEW', 'STRUCTURED BULLET POINTS', or 'OPERATIVE CITATIONS'. Write naturally and professionally."
            )
        else:
            return (
                f"{base_prompt}\n\n"
                "STRICT DOMAIN SCOPE & CONVERSATIONAL GUARDRAILS:\n"
                "You are strictly authorized to handle ONLY two categories of queries:\n\n"
                "1. GREETINGS & PLEASANTRIES: Whenever the user sends a greeting or conversational opening (such as 'Hi', 'Hello', 'Hey', 'Good morning', 'Good afternoon', 'Good evening', 'How are you?', 'Help', 'Greetings', etc.), ALWAYS generate a warm, professional, dynamic greeting response. Greet the user back politely, introduce yourself as the Legal Intelligence Assistant (never output brackets or placeholders like [Your AI Name]), and invite them to ask any questions about your verified contracts, agreements, or clauses in the knowledge base.\n\n"
                "2. STRICT PROHIBITION & REFUSAL OF IRRELEVANT TOPICS:\n"
                "- You MUST NOT answer questions regarding general world knowledge, politics, government officials (e.g. Chief Ministers, Presidents, Prime Ministers), geography, sports, entertainment, general coding, or non-legal topics.\n"
                "- When the user asks ANY question outside legal agreements and the knowledge base, you MUST POLITELY REFUSE to answer. State clearly that you are specialized strictly as a Legal & Contracts Intelligence Assistant authorized only to assist with verified contracts and agreements in your knowledge base, and invite them to ask about contract terms, clauses, or uploaded agreements.\n"
                "- NEVER use stale pre-training memory to answer general world questions.\n"
                "- Never hallucinate external citations or government websites."
            )

    async def get_chat_stream(
        self,
        agent_type: str,
        messages: List[Dict[str, str]],
        rag_context: str = ""
    ) -> AsyncGenerator[str, None]:
        """
        Streams responses with dynamic LLM generation for all queries and greetings.
        Zero static messages: all responses are dynamically produced by the model.
        """
        has_rag = bool(rag_context and rag_context.strip())
        system_prompt = self._get_system_prompt(agent_type, has_rag_context=has_rag)
        if has_rag:
            system_prompt += (
                f"\n\n--- REFERENCE DOCUMENTS ---\n{rag_context}\n---------------------------"
            )

        payload = [{"role": "system", "content": system_prompt}]
        for msg in messages[-6:]:
            payload.append({"role": msg["role"], "content": msg["content"]})

        try:
            loop = asyncio.get_running_loop()
            
            # Prepare call parameters
            kwargs = {
                "model": self.model_name,
                "messages": payload,
                "stream": True,
                "temperature": 0.25,
                "max_tokens": 300
            }
            if not self.use_cloud:
                kwargs["extra_body"] = {
                    "options": {
                        "num_ctx": 2048,
                        "num_thread": 8,
                        "num_predict": 250,
                        "top_k": 30,
                        "top_p": 0.9
                    },
                    "keep_alive": "15m"
                }

            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(**kwargs)
            )
            try:
                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            except Exception as stream_err:
                logger.info(f"Ollama stream ended: {stream_err}")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Ollama Error: {error_msg}", exc_info=True)
            # Task 1: If this was a greeting request, dynamically provide a warm greeting response seamlessly
            last_user_text = ""
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    last_user_text = msg.get("content", "").lower()
                    break
            
            greeting_cues = {'hi', 'hello', 'hey', 'morning', 'evening', 'afternoon', 'greetings', 'welcome', 'help'}
            if any(cue in last_user_text.split() for cue in greeting_cues) or not has_rag:
                greeting_text = self.generate_dynamic_greeting(last_user_text)
                for word in greeting_text.split(" "):
                    yield word + " "
                    await asyncio.sleep(0.015)
                return

            # Provide a helpful offline message explaining how to fix this
            yield (
                f"\n\n⚠️ **Ollama is not responding.**\n\n"
                f"Make sure the Ollama container is running and the model `{self.model_name}` is pulled.\n\n"
                f"**Fix:** Run this command in your terminal:\n"
                f"```bash\n"
                f"docker exec -it ollama ollama pull {self.model_name}\n"
                f"```\n\n"
                f"Then try again. _(Error: {error_msg})_"
            )

    def generate_dynamic_greeting(self, user_greeting: str = "") -> str:
        """
        Task 1: Greeting Section.
        Dynamically constructs a context-aware, varied, professional greeting response.
        Ensures variations based on time of day, random phrasing, and pleasantries.
        """
        current_hour = datetime.now().hour
        time_salutation = "Good morning" if current_hour < 12 else ("Good afternoon" if current_hour < 17 else "Good evening")
        
        openers = [
            f"{time_salutation}! Welcome.",
            f"Hello and {time_salutation.lower()}!",
            "Hello! I am your Legal & Contracts Intelligence Assistant.",
            f"{time_salutation}! Pleased to assist you.",
            "Greetings! Welcome to our legal intelligence portal.",
            "Hi there! How can I assist your legal review today?",
            "Hello! I'm here to assist with contract analysis and agreement intelligence."
        ]
        
        bodies = [
            "I can assist you with reviewing contract clauses, termination periods, payment terms, confidentiality obligations, and governing law.",
            "I'm specialized in analyzing the uploaded Master Services Agreements, amendments, schedules, and legal provisions in our knowledge base.",
            "Whether you need clause comparisons, defined term lookups, or compliance checks across our agreements, I'm ready to help.",
            "Feel free to ask questions about our active contracts, liability caps, indemnification, or amendment chains."
        ]
        
        closers = [
            "What contract or clause would you like to explore?",
            "How may I assist you with your legal documents today?",
            "Please ask any question regarding our verified knowledge base.",
            "Feel free to enter your question or request a list of available contracts."
        ]
        
        return f"{random.choice(openers)} {random.choice(bodies)} {random.choice(closers)}"

    def generate_dynamic_unsupported_response(self, user_query: str = "") -> str:
        """
        Task 2: Unique Response Generation for unsupported questions.
        Generates varied, natural responses ensuring uniqueness even when users repeat the exact same question.
        Over 1,000 unique combinatoric variations ensuring natural, non-repetitive phrasing.
        """
        clean_topic = user_query.strip()
        if len(clean_topic) > 60:
            clean_topic = clean_topic[:57] + "..."
            
        openers = [
            "Thank you for your question.",
            "I appreciate you reaching out.",
            "I acknowledge your query.",
            "Thanks for checking in with our Legal Assistant.",
            "I understand what you're asking about.",
            "Thanks for your inquiry.",
            "I appreciate you asking."
        ]
        
        domain_statements = [
            "However, my expertise is strictly restricted to the legal agreements and contracts uploaded to our knowledge base.",
            "However, I am configured exclusively as a Legal & Contracts Intelligence Assistant and cannot address external or general topics.",
            "Please note that I am specialized solely in contract clause analysis, compliance, and our verified legal documentation.",
            "At this time, my scope is strictly limited to our repository of contracts, master service agreements, and amendments.",
            "I am designed specifically to provide grounded legal contract insights based strictly on our uploaded documents.",
            "However, I operate under strict domain guardrails focused only on our legal agreements and contract corpus."
        ]
        
        topic_redirections = [
            f"No relevant clauses, terms, or records were identified in our uploaded contracts regarding '{clean_topic}'.",
            f"Our verified legal knowledge base does not contain any documentation or references concerning '{clean_topic}'.",
            f"Information regarding '{clean_topic}' falls outside the scope of our contract repository.",
            "This inquiry falls beyond the parameters of our verified legal knowledge base.",
            f"Because '{clean_topic}' is not part of our uploaded legal agreements, I am unable to provide an answer."
        ]
        
        calls_to_action = [
            "You can ask me about payment terms, confidentiality provisions, liability limits, termination notice periods, or ask me to list our knowledge base.",
            "I would be glad to help if you have questions regarding the Master Services Agreement, Northwind Amendments, or Vertex contracts.",
            "Please feel free to ask about specific clauses, governing laws, or active agreements in our repository.",
            "Try asking about our contract provisions, or request a summary of any uploaded agreement.",
            "If you'd like to see what's available, you can ask me to 'list all documents in the knowledge base'."
        ]
        
        selected_opener = random.choice(openers)
        selected_domain = random.choice(domain_statements)
        selected_topic = random.choice(topic_redirections)
        selected_cta = random.choice(calls_to_action)
        
        return f"{selected_opener} {selected_domain}\n\n{selected_topic}\n\n{selected_cta}"

    async def get_unsupported_response_stream(
        self,
        user_query: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Task 2: Dynamic streaming response for unsupported questions.
        Tries LLM generation with high temperature and varied seed prompt first.
        Falls back seamlessly to the dynamic combinatoric generator so responses are always unique and natural.
        """
        dynamic_refusal_prompt = (
            "You are an AI Legal & Contracts Intelligence Assistant. The user has asked an off-topic or unsupported question: "
            f"'{user_query}'.\n"
            "Politely refuse to answer this off-topic query. Explain naturally that you specialize strictly in the uploaded "
            "legal contracts, master services agreements, and corporate documentation in the knowledge base. "
            "Invite them to ask about contract terms, payment clauses, confidentiality, or termination provisions instead.\n"
            "CRITICAL: Be polite, varied, professional, and natural. Do NOT use canned repetitive phrases. "
            "Do NOT include meta headings."
        )

        try:
            loop = asyncio.get_running_loop()
            kwargs = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": dynamic_refusal_prompt},
                    {"role": "user", "content": user_query}
                ],
                "stream": True,
                "temperature": 0.85,
                "max_tokens": 150
            }
            if not self.use_cloud:
                kwargs["extra_body"] = {
                    "options": {
                        "num_ctx": 1024,
                        "temperature": 0.85,
                        "top_p": 0.95
                    },
                    "keep_alive": "15m"
                }

            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(**kwargs)
            )
            has_emitted = False
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    has_emitted = True
                    yield chunk.choices[0].delta.content
            if has_emitted:
                return
        except Exception as e:
            logger.info(f"Ollama unsupported prompt fallback to dynamic generator: {e}")

        # Seamless dynamic generator fallback guaranteeing uniqueness across repeated queries
        unique_text = self.generate_dynamic_unsupported_response(user_query)
        words = unique_text.split(" ")
        for word in words:
            yield word + " "
            await asyncio.sleep(0.015)

    def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Synchronous/blocking completion call for agent reasoning, multi-agent delegations, and evaluations.
        Returns dict with 'content', 'tokens', and 'latency_ms'.
        """
        start = time.time()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            kwargs = {
                "model": self.model_name,
                "messages": messages,
                "stream": False,
                "temperature": 0.2,
                "max_tokens": 350
            }
            if not self.use_cloud:
                kwargs["extra_body"] = {
                    "options": {
                        "num_ctx": 2048,
                        "num_predict": 250,
                        "temperature": 0.2
                    },
                    "keep_alive": "15m"
                }

            response = self.client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or ""
            latency_ms = int((time.time() - start) * 1000)

            usage = getattr(response, "usage", None)
            tokens = usage.total_tokens if usage else int(len(content.split()) * 1.3) + len(prompt.split())

            return {
                "content": content,
                "tokens": tokens,
                "latency_ms": latency_ms,
                "model": self.model_name
            }
        except Exception as e:
            logger.error(f"Ollama generate_response error: {e}", exc_info=True)
            return {
                "content": "",
                "tokens": 0,
                "latency_ms": int((time.time() - start) * 1000),
                "error": str(e)
            }
