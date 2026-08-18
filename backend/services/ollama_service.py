import os
import asyncio
from typing import AsyncGenerator, List, Dict
from openai import OpenAI

class OllamaService:
    def __init__(self):
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434/v1")
        self.model_name = os.getenv("OLLAMA_MODEL", "llama3.2")
        self.client = OpenAI(base_url=ollama_url, api_key="ollama")

    def _get_system_prompt(self, agent_type: str) -> str:
        prompts = {
            "general": (
                "You are a helpful, empathetic, and professional AI assistant. "
                "Your goal is to answer general inquiries clearly and concisely. "
                "Keep responses structured and easy to follow."
            ),
            "technical": (
                "You are an IT and Technical Support Specialist. You help users troubleshoot software, "
                "hardware, API integration, and code issues. Be detailed, precise, and structure "
                "troubleshooting steps using bullet points or numbered lists. Use Markdown code blocks "
                "with syntax highlighting (e.g., ```python) when explaining code solutions."
            ),
            "billing": (
                "You are a Billing and Accounts Specialist. You handle questions about subscriptions, "
                "invoices, payment methods, upgrade processes, and refund policies. Be polite, formal, "
                "and clarify account procedures."
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
        Streams responses exclusively from the local Ollama instance.
        If Ollama is unavailable or the model is not pulled, yields a helpful
        offline error message explaining how to fix it.
        """
        system_prompt = self._get_system_prompt(agent_type)
        if rag_context:
            system_prompt += (
                "\n\nCRITICAL KNOWLEDGE BASE CONTEXT:\n"
                "You are provided with reference documents below. "
                "Answer the user's question directly using the information in this context. "
                "Base your answer strictly on the provided facts without stating that you are an AI assistant lacking physical presence if the context describes a product, policy, or procedure.\n\n"
                f"--- REFERENCE DOCUMENTS ---\n{rag_context}\n---------------------------"
            )

        payload = [{"role": "system", "content": system_prompt}]
        for msg in messages[-10:]:
            payload.append({"role": msg["role"], "content": msg["content"]})

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.chat.completions.create(
                    model=self.model_name,
                    messages=payload,
                    stream=True,
                    temperature=0.7,
                )
            )
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            error_msg = str(e)
            print(f"Ollama Error: {error_msg}")
            # Provide a helpful offline message explaining how to fix this
            yield (
                f"⚠️ **Ollama is not responding.**\n\n"
                f"Make sure the Ollama container is running and the model `{self.model_name}` is pulled.\n\n"
                f"**Fix:** Run this command in your terminal:\n"
                f"```bash\n"
                f"docker exec -it ollama ollama pull {self.model_name}\n"
                f"```\n\n"
                f"Then try again. _(Error: {error_msg})_"
            )
