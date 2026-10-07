from abc import ABC, abstractmethod
from typing import List, Optional
from ..entities.document import DocumentEntity, DocumentChunkEntity
from ..enums.document_status import DocumentStatus

class IDocumentRepository(ABC):
    @abstractmethod
    def get_by_id(self, document_id: str) -> Optional[DocumentEntity]:
        pass

    @abstractmethod
    def get_by_filename(self, filename: str) -> Optional[DocumentEntity]:
        pass

    @abstractmethod
    def list_all(self, skip: int = 0, limit: int = 50) -> List[DocumentEntity]:
        pass

    @abstractmethod
    def save(self, document: DocumentEntity) -> DocumentEntity:
        pass

    @abstractmethod
    def update_status(self, document_id: str, status: DocumentStatus, error_message: Optional[str] = None) -> bool:
        pass

    @abstractmethod
    def delete(self, document_id: str) -> bool:
        pass

    @abstractmethod
    def get_chunks(self, document_id: str) -> List[DocumentChunkEntity]:
        pass

    @abstractmethod
    def save_chunks(self, chunks: List[DocumentChunkEntity]) -> List[DocumentChunkEntity]:
        pass
