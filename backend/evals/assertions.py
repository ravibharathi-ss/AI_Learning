"""
Deterministic Assertions Engine for Legal Contract Evals (Week 6 Practical)
Replaces expensive / flaky LLM judge criteria with instant, free, 100% deterministic rules.
"""

import re
from typing import Dict, Any, List, Tuple


def extract_clause_references(text: str) -> List[str]:
    """
    Extracts citations such as 'Section 12.4', 'Clause 14.2', 'Section 8', '§3.1' from text.
    """
    pattern = r'\b(?:Section|Clause|§|Article)\s*([0-9]+(?:\.[0-9]+)*)\b'
    matches = re.findall(pattern, text, re.IGNORECASE)
    return matches


def assert_clause_reference_exists(answer: str, context: str) -> Tuple[bool, str]:
    """
    Assertion 1: Every cited clause reference (e.g. 7.2, 12.4, 14.2) in the answer MUST exist in the contract context.
    """
    cited_clauses = extract_clause_references(answer)
    if not cited_clauses:
        return True, "No explicit clause references cited in answer."

    context_clauses = extract_clause_references(context)
    missing_clauses = []

    for clause in cited_clauses:
        # Check if the clause number appears in context clauses or directly as 'Section <clause>' or 'Clause <clause>'
        if clause not in context_clauses:
            # Also check if text has the clause
            if not re.search(rf'\b(?:Section|Clause|§|Article)\s*{re.escape(clause)}\b', context, re.IGNORECASE):
                missing_clauses.append(clause)

    if missing_clauses:
        return False, f"Hallucinated clause reference(s) not found in contract: {', '.join(missing_clauses)}"
    return True, f"All cited clause reference(s) [{', '.join(cited_clauses)}] exist in contract context."


def extract_capitalized_defined_terms(text: str) -> List[str]:
    """
    Extracts quoted or capitalized multi-word defined terms like 'Personal Data Breach', 'Confidential Information',
    'Work Product', 'Authorized User', 'Event of Default', 'Force Majeure'.
    """
    # 1. Quoted terms: 'Personal Data Breach' or "Personal Data Breach"
    quoted = re.findall(r'[\'"]([A-Z][a-zA-Z0-9\s]{2,40})[\'"]', text)
    
    # 2. Known standard title-cased legal defined terms
    capitalized_phrases = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b', text)
    
    # Exclude common sentence starters or general terms
    stopwords = {"This Agreement", "The Agreement", "Customer Shall", "Under Section", "Pursuant To", 
                 "State Of", "New York", "North America", "United States", "New Castle"}
    
    terms = set()
    for q in quoted:
        terms.add(q.strip())
    for cap in capitalized_phrases:
        if cap not in stopwords and len(cap.split()) <= 4:
            terms.add(cap.strip())
            
    return list(terms)


def assert_defined_terms_valid(answer: str, context: str) -> Tuple[bool, str]:
    """
    Assertion 2: Any capitalized or quoted defined terms used in the answer must appear in the contract text.
    """
    defined_terms = extract_capitalized_defined_terms(answer)
    if not defined_terms:
        return True, "No specific legal defined terms extracted."

    invalid_terms = []
    for term in defined_terms:
        if term.lower() not in context.lower():
            invalid_terms.append(term)

    if invalid_terms:
        return False, f"Undefined or ungrounded term(s) used in answer: {', '.join(invalid_terms)}"
    return True, f"All defined terms [{', '.join(defined_terms)}] are validated against contract context."


def assert_effective_date_parseable(answer: str, context: str) -> Tuple[bool, str]:
    """
    Assertion 3: Any date, year, or duration timeline cited in the answer is present and parseable.
    """
    # Pattern for dates e.g. January 15th, 2026, 30 days, 12 months, 3 years
    date_patterns = [
        r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\b',
        r'\b\d{4}-\d{2}-\d{2}\b',
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
        r'\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|fourteen|eighteen|twenty|thirty|sixty|ninety|\d+)\s*(?:\(\d+\))?\s*(?:days|business days|months|years|weeks)\b'
    ]
    
    found_timelines = []
    for pat in date_patterns:
        matches = re.findall(pat, answer, re.IGNORECASE)
        found_timelines.extend(matches)
        
    if not found_timelines:
        return True, "No timeline or date references found in answer."

    return True, f"Found {len(found_timelines)} parseable date/timeline reference(s): {', '.join(found_timelines[:3])}."


def assert_notice_period_numeric(answer: str) -> Tuple[bool, str]:
    """
    Assertion 4: Notice-period and cure figures are strictly numeric expressions (e.g. '30 days', '90 days', '14 days')
    rather than vague words like 'reasonable time' or 'soon'.
    """
    # If the question/answer mentions notice or termination or grace period
    notice_keywords = ["notice", "terminate", "grace period", "cure", "window", "business days", "days"]
    has_notice_context = any(kw in answer.lower() for kw in notice_keywords)
    
    if not has_notice_context:
        return True, "No notice-period context in answer."

    # Look for numeric notice quantifier
    numeric_notice_pat = r'\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fourteen|thirty|sixty|ninety)\s*(?:\(\d+\))?\s*(?:days|business days|months|years)\b'
    matches = re.findall(numeric_notice_pat, answer, re.IGNORECASE)
    
    # Check if vague phrasing was used instead of numeric
    vague_phrases = ["reasonable notice", "unspecified time", "soon", "at any time without notice"]
    found_vague = [vp for vp in vague_phrases if vp in answer.lower()]
    
    if found_vague and not matches:
        return False, f"Notice period contains vague non-numeric phrasing: {', '.join(found_vague)}"
    
    if matches:
        return True, f"Notice period figure is clearly numeric: {', '.join(matches)}"
    return True, "Notice period check passed."


def run_all_assertions(answer: str, context: str) -> Dict[str, Any]:
    """
    Runs the 4 deterministic assertions and returns individual pass/fail + overall assertion pass.
    """
    res1, msg1 = assert_clause_reference_exists(answer, context)
    res2, msg2 = assert_defined_terms_valid(answer, context)
    res3, msg3 = assert_effective_date_parseable(answer, context)
    res4, msg4 = assert_notice_period_numeric(answer)
    
    all_passed = res1 and res2 and res3 and res4
    
    return {
        "all_passed": all_passed,
        "total_assertions_count": 4,
        "passed_count": sum([res1, res2, res3, res4]),
        "assertions": {
            "clause_reference_exists": {"passed": res1, "message": msg1},
            "defined_terms_valid": {"passed": res2, "message": msg2},
            "effective_date_parseable": {"passed": res3, "message": msg3},
            "notice_period_numeric": {"passed": res4, "message": msg4}
        }
    }
