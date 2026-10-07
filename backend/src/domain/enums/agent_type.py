from enum import Enum

class AgentType(str, Enum):
    LEGAL_SPECIALIST = "legal_specialist"
    TECHNICAL_SUPPORT = "technical_support"
    BILLING_SPECIALIST = "billing_specialist"
    GENERAL = "general"
