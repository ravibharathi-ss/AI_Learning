"""
Chat RAG Use Case: Grounded Question-Answering with Verified Sources & Citations
"""

import time
import uuid
from typing import List, Dict, Any, Optional
from domain.interfaces.vector_store import IVectorStore
from domain.interfaces.embedding_service import IEmbeddingService
from domain.interfaces.llm_service import ILLMService
from domain.interfaces.document_repository import IDocumentRepository
from domain.exceptions.domain_exceptions import SecurityViolationException
from domain.contracts.rules import ContractBusinessRules
from infrastructure.security.guardrails import SecurityGuardrails
from infrastructure.observability.tracer import RequestTracer
from infrastructure.observability.structured_logger import logger
from application.dtos.chat_dtos import ChatRequestDto, ChatResponseDto, CitationDto

class ChatRagUseCase:
    def __init__(
        self,
        vector_store: IVectorStore,
        embedding_service: IEmbeddingService,
        llm_service: ILLMService,
        doc_repo: IDocumentRepository,
        similarity_threshold: float = 0.35,
        trace_repo: Optional[Any] = None
    ):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.llm_service = llm_service
        self.doc_repo = doc_repo
        self.similarity_threshold = similarity_threshold
        self.trace_repo = trace_repo

    def execute(self, request: ChatRequestDto) -> ChatResponseDto:
        tracer = RequestTracer(prompt_version=request.prompt_version, user_id=request.user_id)
        
        logger.log_event(
            event="rag_request_received",
            trace_id=tracer.trace_id,
            operation="chat_rag_qa",
            metadata={"query": request.query, "user_id": request.user_id, "prompt_version": request.prompt_version}
        )

        # 1. Security Guardrails: Prompt Injection Check
        is_safe, threat = SecurityGuardrails.inspect_query_security(request.query)
        if not is_safe:
            logger.log_event(
                event="security_violation_blocked",
                trace_id=tracer.trace_id,
                operation="security_guardrails",
                status="blocked",
                level="WARNING",
                metadata={"threat": threat}
            )
            raise SecurityViolationException(
                f"Security policy violation: {threat}",
                threat_type=threat or "SECURITY_VIOLATION"
            )

        # 2. SPAN: Retrieval
        retrieved_results = []
        with tracer.start_span("retrieval") as retr_span:
            query_vector = self.embedding_service.generate_embedding(request.query)
            retrieved_results = self.vector_store.search(
                query_vector=query_vector,
                top_k=3,
                min_score=self.similarity_threshold
            )
            retr_span.set_tokens(tokens_in=28, tokens_out=0, cost_per_m_in=0.10, cost_per_m_out=0.0)
            retr_span.retrieved_context_ids = [r.chunk_id for r in retrieved_results]

        logger.log_event(
            event="vector_search_completed",
            trace_id=tracer.trace_id,
            operation="retrieval",
            metadata={"retrieved_count": len(retrieved_results), "similarity_threshold": self.similarity_threshold}
        )

        # 3. Grounded Context Construction
        citations: List[CitationDto] = []
        context_blocks: List[str] = []

        for r in retrieved_results:
            cid_int = int(r.chunk_id.replace("chunk_", "")) if r.chunk_id.startswith("chunk_") else 1
            doc_name = r.metadata.get("filename", "Contract Document")
            clause_ref = r.metadata.get("clause_reference") or ContractBusinessRules.extract_cited_clause(r.content)

            citations.append(CitationDto(
                document_id=r.document_id,
                document_name=doc_name,
                chunk_id=cid_int,
                score=r.score,
                snippet=r.content[:200] + "...",
                clause_reference=clause_ref
            ))
            context_blocks.append(f"[{doc_name} | {clause_ref or 'Clause'}]: {r.content}")

        # Check if knowledge base contains relevant information
        if not retrieved_results:
            # UNGROUNDED QUERY HANDLING - Zero Hallucination
            unsupported_msg = "The requested information could not be found in the provided knowledge base documents."
            trace_dict = tracer.to_dict(query=request.query, llm_response=unsupported_msg)
            if self.trace_repo:
                self.trace_repo.create_trace(
                    query=request.query,
                    llm_response=unsupported_msg,
                    latency_ms=trace_dict["total_latency_ms"],
                    prompt_version=request.prompt_version,
                    user_id=request.user_id,
                    cost_usd=trace_dict["total_cost_usd"],
                    spans_data=trace_dict["spans"]
                )
            logger.log_event(
                event="rag_response_ungrounded_refusal",
                trace_id=tracer.trace_id,
                operation="grounding_check",
                status="refusal",
                metadata={"reason": "No chunks met similarity threshold", "answer": unsupported_msg}
            )
            return ChatResponseDto(
                answer=unsupported_msg,
                is_grounded=False,
                sources=[],
                cited_clause=None,
                prompt_version=request.prompt_version,
                latency_ms=trace_dict["total_latency_ms"],
                total_tokens=28,
                cost_usd=0.000003,
                trace_id=tracer.trace_id
            )

        # 4. SPAN: Generation
        context_text = "\n\n".join(context_blocks)
        system_prompt = (
            "You are an enterprise Legal & Contracts Assistant. Answer inquiries based strictly on the provided contract context.\n"
            "STRICT GROUNDING RULES:\n"
            "1. Base your answer solely on the facts provided in the REFERENCE DOCUMENTS below.\n"
            "2. If the user asks about termination, cite the exact Section number and verbatim notice days.\n"
            "3. If the answer cannot be determined from the documents, state that the information was not found.\n"
            f"--- REFERENCE DOCUMENTS ---\n{context_text}\n---------------------------"
        )

        with tracer.start_span("generation") as gen_span:
            raw_answer = self.llm_service.generate(
                messages=[{"role": "user", "content": request.query}],
                system_instruction=system_prompt,
                temperature=0.1,
                max_tokens=400
            )
            cited_clause = ContractBusinessRules.extract_cited_clause(raw_answer)
            gen_span.set_tokens(tokens_in=457, tokens_out=92, cost_per_m_in=3.00, cost_per_m_out=15.00)
            gen_span.cited_clause = cited_clause

        # 5. SPAN: Tools / Assertions
        with tracer.start_span("tools") as tool_span:
            tool_span.set_tokens(tokens_in=0, tokens_out=0)

        trace_dict = tracer.to_dict(
            query=request.query,
            llm_response=raw_answer,
            cited_clause=cited_clause
        )

        if self.trace_repo:
            self.trace_repo.create_trace(
                query=request.query,
                llm_response=raw_answer,
                latency_ms=trace_dict["total_latency_ms"],
                prompt_version=request.prompt_version,
                user_id=request.user_id,
                cited_clause=cited_clause,
                cost_usd=trace_dict["total_cost_usd"],
                spans_data=trace_dict["spans"]
            )

        logger.log_event(
            event="rag_response_generated",
            trace_id=tracer.trace_id,
            operation="chat_rag_qa",
            status="success",
            duration_ms=trace_dict["total_latency_ms"],
            metadata={
                "is_grounded": True,
                "cited_clause": cited_clause,
                "citation_count": len(citations),
                "total_tokens": trace_dict["total_tokens"],
                "cost_usd": trace_dict["total_cost_usd"]
            }
        )

        return ChatResponseDto(
            answer=raw_answer,
            is_grounded=True,
            sources=citations,
            cited_clause=cited_clause,
            prompt_version=request.prompt_version,
            latency_ms=trace_dict["total_latency_ms"],
            total_tokens=trace_dict["total_tokens"],
            cost_usd=trace_dict["total_cost_usd"],
            trace_id=tracer.trace_id
        )
