import os
import asyncio
import time
from typing import AsyncGenerator, List, Dict
from openai import OpenAI

class OpenAiService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        # Initialize client if API key is provided
        if self.api_key and self.api_key.strip():
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    def _get_system_prompt(self, agent_type: str) -> str:
        prompts = {
            "general": (
                "You are a helpful, empathetic, and professional customer support chatbot. "
                "Your goal is to answer general inquiries, guide users through simple processes, "
                "and ensure they have a pleasant experience. Keep responses concise and structured."
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
                "and clarify account procedures. Avoid sharing sensitive data or actual database records."
            )
        }
        return prompts.get(agent_type, prompts["general"])

    async def get_chat_stream(self, agent_type: str, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        """
        Streams responses from OpenAI GPT, or falls back to a simulated mock agent
        if no OpenAI API Key is configured.
        """
        system_prompt = self._get_system_prompt(agent_type)
        
        # If client exists and key is valid, use OpenAI
        if self.client:
            try:
                # Prepare payload
                payload = [{"role": "system", "content": system_prompt}]
                # Limit history to prevent token issues (last 10 messages)
                for msg in messages[-10:]:
                    payload.append({"role": msg["role"], "content": msg["content"]})

                # Call OpenAI client with streaming
                # Since client is synchronous, we run it in a thread pool to avoid blocking the event loop
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.chat.completions.create(
                        model="gpt-4o-mini",  # Highly cost-efficient and fast
                        messages=payload,
                        stream=True,
                        temperature=0.7
                    )
                )

                for chunk in response:
                    if len(chunk.choices) > 0:
                        content = chunk.choices[0].delta.content
                        if content:
                            yield content
                return
            except Exception as e:
                # Log error and fall back to mock
                print(f"OpenAI API Error: {str(e)}. Falling back to offline mock mode.")

        # Fallback Offline Mock Response Generator
        async for chunk in self._generate_mock_stream(agent_type, messages[-1]["content"]):
            yield chunk

    async def _generate_mock_stream(self, agent_type: str, user_message: str) -> AsyncGenerator[str, None]:
        """
        Generates simulated streaming responses based on keywords in the user request.
        """
        msg_lower = user_message.lower()
        
        # Base responses by Agent Type
        responses = {
            "general": {
                "greeting": (
                    "Hello! Thanks for reaching out. How can I help you today? "
                    "I can assist you with general information, account settings, or guide you to the right department."
                ),
                "refund": (
                    "Our refund policy allows you to request a full refund within 14 days of your purchase. "
                    "To request a refund, please head to the Billing section of your dashboard or reply here with your Order ID."
                ),
                "password": (
                    "To reset your password, please follow these steps:\n"
                    "1. Go to the Login page.\n"
                    "2. Click on 'Forgot Password'.\n"
                    "3. Enter your registered email address.\n"
                    "4. Click the link in the password reset email we send you to set a new password."
                ),
                "default": (
                    "Thank you for your inquiry. I understand you're asking about that. "
                    "Could you provide a bit more detail? Alternatively, I can route this conversation "
                    "to a human support representative if you would like."
                )
            },
            "technical": {
                "error": (
                    "I see you're encountering a technical error. Let's troubleshoot this step-by-step:\n\n"
                    "1. **Clear cache & cookies**: Try clearing your browser's application data.\n"
                    "2. **Check your network connection**: Ensure you aren't behind a restrictive VPN or firewall.\n"
                    "3. **Examine console logs**: Open Developer Tools (F12) and check the 'Console' tab for error codes.\n\n"
                    "If you have code examples or error logs, paste them here and I'll analyze them for you."
                ),
                "code": (
                    "Here is how you can set up a client connection in Python. Make sure to install the required library first:\n\n"
                    "```bash\n"
                    "pip install httpx\n"
                    "```\n\n"
                    "Then implement it using this async snippet:\n\n"
                    "```python\n"
                    "import httpx\n"
                    "import asyncio\n\n"
                    "async def fetch_api_status():\n"
                    "    async with httpx.AsyncClient() as client:\n"
                    "        response = await client.get('http://localhost:8000/api/health')\n"
                    "        return response.json()\n\n"
                    "status = asyncio.run(fetch_api_status())\n"
                    "print('API Status:', status)\n"
                    "```"
                ),
                "default": (
                    "I am standing by to assist with your technical questions. Please provide the exact error message, "
                    "your environment details (OS, language versions), or the code snippet you're working on "
                    "so I can diagnose the issue."
                )
            },
            "billing": {
                "pricing": (
                    "We offer three flexible tiers designed to fit any scale:\n\n"
                    "- **Starter**: $15/month (Includes 1 chatbot and 1,000 messages/month).\n"
                    "- **Pro**: $49/month (Includes 5 chatbots, unlimited history, priority support).\n"
                    "- **Enterprise**: Custom pricing (Dedicated deployment, custom LLM models, custom integrations).\n\n"
                    "Let me know if you would like me to assist you with upgrading your plan."
                ),
                "invoice": (
                    "All your invoices are available in the **Account Settings > Invoices** section of your profile. "
                    "You can download them as PDFs or update your billing email to receive them automatically every month."
                ),
                "default": (
                    "I can assist you with payment issues, subscription upgrades, cancellations, or refund inquiries. "
                    "Please provide details of your billing issue (without sharing full card details) and I'll resolve it right away."
                )
            }
        }

        # Select response based on keywords
        category = "default"
        if "hello" in msg_lower or "hi" in msg_lower or "hey" in msg_lower:
            category = "greeting" if "greeting" in responses[agent_type] else "default"
        elif "refund" in msg_lower or "cancel" in msg_lower:
            category = "refund" if "refund" in responses[agent_type] else "default"
        elif "password" in msg_lower or "reset" in msg_lower:
            category = "password" if "password" in responses[agent_type] else "default"
        elif "error" in msg_lower or "bug" in msg_lower or "fail" in msg_lower:
            category = "error" if "error" in responses[agent_type] else "default"
        elif "code" in msg_lower or "example" in msg_lower or "how to" in msg_lower or "python" in msg_lower:
            category = "code" if "code" in responses[agent_type] else "default"
        elif "price" in msg_lower or "pricing" in msg_lower or "cost" in msg_lower or "subscription" in msg_lower:
            category = "pricing" if "pricing" in responses[agent_type] else "default"
        elif "invoice" in msg_lower or "receipt" in msg_lower or "charge" in msg_lower:
            category = "invoice" if "invoice" in responses[agent_type] else "default"

        selected_text = responses[agent_type].get(category, responses[agent_type]["default"])
        
        # Add warning label to response if running in mock mode
        if not self.api_key:
            selected_text = "[MOCK MODE] " + selected_text

        # Stream the selected text word by word to simulate typing
        words = selected_text.split(" ")
        for i, word in enumerate(words):
            # Send word with space
            yield word + (" " if i < len(words) - 1 else "")
            # Yield control back to event loop to simulate typing speed
            await asyncio.sleep(0.04)
