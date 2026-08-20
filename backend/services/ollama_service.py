import os
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

    def _get_system_prompt(self, agent_type: str) -> str:
        speed_instruction = " Be extremely concise, direct, and fast. Give short, structured 2-4 bullet answers or code blocks without conversational intro/outro fluff."
        prompts = {
            "general": (
                "You are a helpful and efficient AI assistant." + speed_instruction
            ),
            "technical": (
                "You are an IT and Technical Support Specialist." + speed_instruction +
                " Use clean Markdown code blocks (e.g. ```bash) for terminal commands."
            ),
            "billing": (
                "You are a Billing and Accounts Specialist." + speed_instruction
            )
        }
        return prompts.get(agent_type, prompts["general"])

    async def get_chat_stream(
        self,
        agent_type: str,
        messages: List[Dict[str, str]],
        rag_context: str = ""
    ) -> AsyncGenerator[str, None]:
        """
        Streams responses with high-speed sampling.
        """
        system_prompt = self._get_system_prompt(agent_type)
        if rag_context:
            system_prompt += (
                "\n\nKNOWLEDGE BASE REFERENCE CONTEXT:\n"
                f"--- REFERENCE DOCUMENTS ---\n{rag_context}\n---------------------------\n"
                "INSTRUCTIONS:\n"
                "1. If reference documents contain facts relevant to the user's question, use them concisely.\n"
                "2. If the question is general (e.g., technical guides, software installation like Docker, programming), answer directly using pre-trained knowledge in concise steps."
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
                "temperature": 0.1,
                "max_tokens": 150
            }
            if not self.use_cloud:
                kwargs["extra_body"] = {"options": {"num_ctx": 1024, "num_thread": 8, "num_predict": 120}}

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
