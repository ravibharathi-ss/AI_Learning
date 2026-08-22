import os
import re
import asyncio
from typing import AsyncGenerator, List, Dict
from openai import OpenAI

class OllamaService:
    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY")

        if self.openai_key:
            self.use_cloud = True
            self.model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            self.client = OpenAI(api_key=self.openai_key)
            print(f"Using OpenAI Cloud API ({self.model_name}) for instant ChatGPT response speed.")
        elif self.groq_key:
            self.use_cloud = True
            self.model_name = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
            self.client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=self.groq_key)
            print(f"Using Groq Cloud API ({self.model_name}) for instant 100ms response speed.")
        else:
            self.use_cloud = False
            ollama_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434/v1")
            self.model_name = os.getenv("OLLAMA_MODEL", "llama3.2")
            self.client = OpenAI(base_url=ollama_url, api_key="ollama")
            print(f"Using local Ollama ({self.model_name}) with CPU context optimization.")

    def _get_system_prompt(self, agent_type: str, has_rag_context: bool = False) -> str:
        speed_instruction = " Be concise, direct, and structured."
        prompts = {
            "general": (
                "You are an AI Support Assistant." + speed_instruction
            ),
            "technical": (
                "You are an IT and Technical Support Specialist." + speed_instruction +
                " Use clean Markdown code blocks (e.g. ```bash) for terminal commands."
            ),
            "billing": (
                "You are a Billing and Accounts Specialist." + speed_instruction
            )
        }
        base_prompt = prompts.get(agent_type, prompts["general"])
        
        if has_rag_context:
            return (
                f"{base_prompt}\n\n"
                "STRICT KNOWLEDGE BASE ENFORCEMENT:\n"
                "1. If the user gives a greeting (e.g., 'Hello', 'Hi'), respond politely and offer assistance with knowledge base topics.\n"
                "2. You must ONLY answer questions using the facts provided in the REFERENCE DOCUMENTS below.\n"
                "3. Do NOT answer general world knowledge questions, write code/essays unrelated to the context, or extrapolate beyond the provided facts.\n"
                "4. If the question cannot be answered using the provided reference documents, politely state that you can only answer questions based on the official knowledge base documents and that the requested information is not available."
            )
        else:
            return (
                f"{base_prompt}\n\n"
                "STRICT KNOWLEDGE BASE ENFORCEMENT:\n"
                "1. If the user gives a greeting (e.g., 'Hello', 'Hi'), greet them briefly and invite them to ask questions about our knowledge base.\n"
                "2. No matching documents were found in the knowledge base for this query.\n"
                "3. You are strictly restricted to answering questions from the uploaded knowledge base documents only. Do NOT answer general knowledge, coding, or unrelated questions.\n"
                "4. Politely inform the user that you only answer questions backed by the knowledge base documents and no relevant documentation was found for their request."
            )

    async def get_chat_stream(
        self,
        agent_type: str,
        messages: List[Dict[str, str]],
        rag_context: str = ""
    ) -> AsyncGenerator[str, None]:
        """
        Streams responses with high-speed sampling, instant greeting fast-path, and strict RAG enforcement.
        """
        # Instant Fast-Path for Greetings / Pleasantries
        latest_user_text = messages[-1]["content"].strip().lower() if messages else ""
        cleaned_latest = re.sub(r'[^\w\s]', '', latest_user_text).strip()
        greeting_words = {'hi', 'hello', 'hey', 'hola', 'greetings', 'good morning', 'good evening', 'good afternoon', 'how are you', 'who are you', 'help'}
        if cleaned_latest in greeting_words or (len(cleaned_latest.split()) <= 2 and any(cleaned_latest.startswith(g) for g in ['hi', 'hello', 'hey'])):
            instant_greeting = (
                "Hello! 👋 I am your AI Support Assistant.\n\n"
                "I am here to help answer your questions based on our knowledge base documents. How can I assist you today?"
            )
            for word in instant_greeting.split(" "):
                yield word + " "
                await asyncio.sleep(0.015)
            return

        has_rag = bool(rag_context and rag_context.strip())
        system_prompt = self._get_system_prompt(agent_type, has_rag_context=has_rag)
        if has_rag:
            system_prompt += (
                f"\n\n--- REFERENCE DOCUMENTS ---\n{rag_context}\n---------------------------"
            )

        payload = [{"role": "system", "content": system_prompt}]
        for msg in messages[-4:]:
            payload.append({"role": msg["role"], "content": msg["content"]})

        try:
            loop = asyncio.get_running_loop()
            
            # Prepare call parameters
            kwargs = {
                "model": self.model_name,
                "messages": payload,
                "stream": True,
                "temperature": 0.1,
                "max_tokens": 120
            }
            if not self.use_cloud:
                kwargs["extra_body"] = {
                    "options": {
                        "num_ctx": 512,
                        "num_thread": 8,
                        "num_predict": 90,
                        "top_k": 20,
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
                print(f"Ollama stream ended: {stream_err}")

        except Exception as e:
            error_msg = str(e)
            print(f"Ollama Error: {error_msg}")
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
