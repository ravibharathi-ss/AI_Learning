"""
Golden Set Evaluator for Soft Suave AI League - Shared Legal Contract Corpus
Executes and evaluates the 32 ground-truth test cases across 9 cognitive legal categories.
"""

import json
import re
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

from application.features.chat.chat_rag_use_case import ChatRagUseCase
from application.dtos.chat_dtos import ChatRequestDto, ChatResponseDto
from infrastructure.observability.structured_logger import logger

@dataclass
class CaseEvaluationResult:
    id: str
    question: str
    case_class: str
    expected_answer: str
    expected_values: List[str]
    actual_answer: str
    status: str  # 'pass', 'fail_hallucination', 'fail_wrong_version', 'fail_wrong_counterparty', 'fail_false_refusal', 'fail_missing_value'
    cited_sources: List[str]
    latency_ms: int
    hops: int
    refusal_expected: bool
    notes: Optional[str] = None

@dataclass
class EvaluationReport:
    total_cases: int
    passed_cases: int
    accuracy_percentage: float
    total_latency_ms: int
    avg_latency_ms: float
    class_breakdown: Dict[str, Dict[str, Any]]
    failure_breakdown: Dict[str, int]
    case_results: List[CaseEvaluationResult]

class GoldenSetEvaluator:
    def __init__(self, chat_use_case: ChatRagUseCase, golden_set_path: Optional[str] = None):
        self.chat_use_case = chat_use_case
        if golden_set_path:
            self.golden_set_path = Path(golden_set_path)
        else:
            # Look for shared-corpus walking upwards from this file
            curr = Path(__file__).resolve()
            found_path = None
            for parent in curr.parents:
                candidate = parent / "shared-corpus" / "eval" / "golden_set.json"
                if candidate.exists():
                    found_path = candidate
                    break
            self.golden_set_path = found_path or Path("shared-corpus/eval/golden_set.json")

    def load_golden_set(self) -> Dict[str, Any]:
        if not self.golden_set_path.exists():
            raise FileNotFoundError(f"Golden Set not found at {self.golden_set_path}")
        return json.loads(self.golden_set_path.read_text(encoding="utf-8"))

    def evaluate_case(self, case: Dict[str, Any]) -> CaseEvaluationResult:
        case_id = case["id"]
        question = case["question"]
        case_class = case.get("class", "direct_lookup")
        expected_values = case.get("expected_values", [])
        expected_answer = case.get("expected_answer", "")
        refusal_expected = case.get("refusal_expected", False)
        superseded_value = case.get("superseded_value")
        source_doc = case.get("source_doc")
        hops = case.get("hops", 1)

        t_start = time.time()
        chat_resp: ChatResponseDto = self.chat_use_case.execute(ChatRequestDto(query=question))
        latency_ms = int((time.time() - t_start) * 1000)

        actual_text = chat_resp.answer
        cited_sources = [s.source_doc or s.document_name for s in chat_resp.sources]

        # Scoring Logic
        status = "pass"
        note = None

        ans_lower = actual_text.lower()
        is_refusal = (
            not chat_resp.is_grounded
            or "refusal" in ans_lower
            or "not found" in ans_lower
            or "no such" in ans_lower
            or "does not exist" in ans_lower
            or "no agreement exists" in ans_lower
            or "no separate" in ans_lower
            or "no amendments" in ans_lower
        )

        if refusal_expected:
            if is_refusal:
                # Check if specific expected values are needed (e.g. GS-030, GS-032)
                if expected_values:
                    missing = [ev for ev in expected_values if ev.lower() not in ans_lower]
                    if missing and not any(k in ans_lower for k in ["no separate", "no amendments", "refusal"]):
                        status = "fail_hallucination"
                        note = f"Refusal was expected but lacked expected qualifiers: {missing}"
                    else:
                        status = "pass"
                else:
                    status = "pass"
            else:
                status = "fail_hallucination"
                note = "System answered an out-of-scope question that should have been refused."
        else:
            if is_refusal:
                status = "fail_false_refusal"
                note = "System incorrectly refused a grounded question in the corpus."
            else:
                # Check for wrong counterparty (e.g. Vertex cited Northwind or vice-versa)
                if case_class == "counterparty_disambiguation":
                    distractor_val = case.get("distractor_value")
                    if distractor_val and any(dv.lower() in ans_lower for dv in distractor_val.split("/")):
                        status = "fail_wrong_counterparty"
                        note = f"Answer included distractor counterparty value: {distractor_val}"

                # Check for superseded value stated as current
                if status == "pass" and case_class == "amendment_supersession" and superseded_value:
                    # If answer says superseded value without mentioning amendment / replacement
                    if (
                        superseded_value.lower() in ans_lower
                        and not any(exp.lower() in ans_lower for exp in expected_values)
                    ):
                        status = "fail_wrong_version"
                        note = f"Answer gave superseded value '{superseded_value}' instead of governing amendment."

                # Verify all expected values are present in answer
                if status == "pass":
                    missing_values = []
                    for ev in expected_values:
                        ev_l = ev.lower()
                        if ev_l in ["no", "not"]:
                            if not (re.search(r'\bno\b|\bnot\b', ans_lower) or "not a business day" in ans_lower):
                                missing_values.append(ev)
                        elif ev_l not in ans_lower:
                            missing_values.append(ev)

                    if missing_values:
                        status = "fail_missing_value"
                        note = f"Missing expected value(s): {missing_values}"

                # Verify source doc citation
                if status == "pass" and source_doc:
                    # Multiple source docs can be joined with '+'
                    required_docs = [d.strip() for d in source_doc.split("+")]
                    doc_mentioned = any(
                        (rd in actual_text or any(rd in s for s in cited_sources))
                        for rd in required_docs
                    )
                    if not doc_mentioned:
                        # Soft warning if value is correct but explicit source citation was partial
                        note = f"Expected citation {source_doc} not explicitly found in answer or sources."

        return CaseEvaluationResult(
            id=case_id,
            question=question,
            case_class=case_class,
            expected_answer=expected_answer,
            expected_values=expected_values,
            actual_answer=actual_text,
            status=status,
            cited_sources=cited_sources,
            latency_ms=latency_ms,
            hops=hops,
            refusal_expected=refusal_expected,
            notes=note
        )

    def evaluate_all(self, limit: Optional[int] = None) -> EvaluationReport:
        golden_data = self.load_golden_set()
        cases = golden_data.get("cases", [])
        if limit:
            cases = cases[:limit]

        logger.log_event(
            event="golden_set_eval_started",
            operation="evaluation",
            metadata={"total_cases": len(cases)}
        )

        results: List[CaseEvaluationResult] = []
        class_stats: Dict[str, Dict[str, Any]] = {}
        failure_stats: Dict[str, int] = {}

        total_latency = 0
        for i, c in enumerate(cases):
            c_class = c.get("class", "general")
            if c_class not in class_stats:
                class_stats[c_class] = {"total": 0, "passed": 0, "failed": 0, "accuracy": 0.0}

            class_stats[c_class]["total"] += 1
            res = self.evaluate_case(c)
            results.append(res)
            total_latency += res.latency_ms

            if res.status == "pass":
                class_stats[c_class]["passed"] += 1
            else:
                class_stats[c_class]["failed"] += 1
                failure_stats[res.status] = failure_stats.get(res.status, 0) + 1

        for c_stats in class_stats.values():
            if c_stats["total"] > 0:
                c_stats["accuracy"] = round((c_stats["passed"] / c_stats["total"]) * 100, 2)

        passed_count = sum(1 for r in results if r.status == "pass")
        accuracy = round((passed_count / len(cases)) * 100, 2) if cases else 0.0
        avg_latency = round(total_latency / len(cases), 2) if cases else 0.0

        report = EvaluationReport(
            total_cases=len(cases),
            passed_cases=passed_count,
            accuracy_percentage=accuracy,
            total_latency_ms=total_latency,
            avg_latency_ms=avg_latency,
            class_breakdown=class_stats,
            failure_breakdown=failure_stats,
            case_results=results
        )

        logger.log_event(
            event="golden_set_eval_completed",
            operation="evaluation",
            status="completed",
            metadata={
                "total_cases": len(cases),
                "passed_cases": passed_count,
                "accuracy": accuracy,
                "avg_latency_ms": avg_latency
            }
        )
        return report
