from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass
class ContractClause:
    section_number: str
    title: str
    body: str
    is_superseded: bool = False
    superseded_by: Optional[str] = None
    notice_period_days: Optional[int] = None
    governing_jurisdiction: Optional[str] = None

@dataclass
class ContractDocument:
    id: str
    title: str
    clauses: List[ContractClause] = field(default_factory=list)
    effective_date: str = "2026-01-01"
    contract_type: str = "MSA"  # MSA, SaaS, DPA, Vendor

# Prompt Version Registry for Contract Answering
PROMPT_VERSIONS = {
    "v2.1": {
        "version_tag": "contract_qa_v2.1",
        "description": "Baseline Contract QA Prompt with general legal clause summarization.",
        "system_instruction": (
            "You are an expert Legal Contract Assistant. Answer inquiries regarding the provided "
            "contract documents accurately. Cite relevant section numbers when answering."
        )
    },
    "v2.2": {
        "version_tag": "contract_qa_v2.2",
        "description": "Calibrated Contract QA Prompt with strict termination clause cross-referencing and exact notice extraction.",
        "system_instruction": (
            "You are an expert Legal Contract Assistant. Answer inquiries regarding the provided contract documents.\n"
            "CRITICAL CLAUSE CITATION RULES:\n"
            "1. When asked about Termination for Convenience or Cause, you must strictly cite the Term and Termination "
            "section (e.g., Section 12 or Article 6) and verbatim notice days.\n"
            "2. NEVER confuse Section 14 (Limitation of Liability or Sublicensing) with Termination provisions.\n"
            "3. If an amendment supersedes an earlier draft, always cite the executed restatement.\n"
            "4. Always cite the exact Section number and title before stating the legal rule."
        )
    }
}
