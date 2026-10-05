import os
import sys
import glob
from pathlib import Path
import pypdf

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from database import SessionLocal, engine, Base
import models
from services.rag_service import RagService

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def index_contracts():
    db = SessionLocal()
    rag = RagService()

    contract_files = [
        "Master_Services_Agreement_Enterprise_Cloud.pdf",
        "Cloud_SaaS_License_and_Service_Level_Agreement.pdf",
        "Data_Processing_Addendum_GDPR_Standard_Clauses.pdf",
        "Commercial_Vendor_and_Subcontractor_Agreement.pdf"
    ]

    print("=== INDEXING FULL-LENGTH LEGAL AGREEMENTS ===")
    total_indexed_chunks = 0

    for fname in contract_files:
        fpath = os.path.join("test_documents", fname)
        if not os.path.exists(fpath):
            print(f"Skipping {fname}, file not found.")
            continue

        # Check if already in DB
        existing = db.query(models.Document).filter_by(filename=fname).first()
        if existing:
            print(f"Document {fname} already in DB, removing old version to refresh.")
            db.delete(existing)
            db.commit()

        # Read PDF pages
        reader = pypdf.PdfReader(fpath)
        full_text = ""
        for page_idx, page in enumerate(reader.pages):
            full_text += f"\n--- Page {page_idx + 1} ---\n" + page.extract_text()

        # Create Document in DB
        doc_record = models.Document(filename=fname)
        db.add(doc_record)
        db.flush()

        # Create section-aware chunks
        # Split on Section/Article or standard chunking
        raw_chunks = rag.chunk_text(full_text, chunk_size=600, overlap=120)
        print(f"Ingesting '{fname}' ({len(reader.pages)} pages, {len(raw_chunks)} chunks)...")

        chroma_ids = []
        chroma_docs = []
        chroma_metas = []

        for c_idx, chunk_text in enumerate(raw_chunks):
            # Identify clause tag if present
            clause_tag = "General"
            for keyword in ["SECTION 12", "Section 12", "SECTION 14", "Section 14", "SECTION 8", "SECTION 15", "ARTICLE 6", "ARTICLE 7", "SECTION 4"]:
                if keyword in chunk_text:
                    clause_tag = keyword.upper().replace(" ", "_")
                    break

            chunk_id_str = f"doc_{fname.split('.')[0][:10].lower()}_c{c_idx}_{clause_tag}"
            
            # Save to SQLite
            chunk_rec = models.DocumentChunk(
                document_id=doc_record.id,
                content=chunk_text,
                embedding_json="[]" # Vector stored in ChromaDB
            )
            db.add(chunk_rec)

            chroma_ids.append(chunk_id_str)
            chroma_docs.append(chunk_text)
            chroma_metas.append({
                "document_id": doc_record.id,
                "filename": fname,
                "chunk_index": c_idx,
                "clause_tag": clause_tag
            })
            total_indexed_chunks += 1

        # Add to ChromaDB if available
        if rag.collection:
            try:
                # Delete existing ids if present
                try:
                    rag.collection.delete(where={"filename": fname})
                except Exception:
                    pass
                rag.collection.add(
                    ids=chroma_ids,
                    documents=chroma_docs,
                    metadatas=chroma_metas
                )
                print(f"  -> Added {len(chroma_ids)} vectors to ChromaDB collection.")
            except Exception as e:
                print(f"  -> ChromaDB indexing notice: {e}")

        db.commit()

    db.close()
    print(f"\nAll legal agreements indexed successfully. Total chunks: {total_indexed_chunks}")

if __name__ == "__main__":
    index_contracts()
