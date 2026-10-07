"""
Domain Exceptions
"""

class DomainException(Exception):
    """Base domain exception."""
    pass

class DocumentNotFoundException(DomainException):
    def __init__(self, document_id: str):
        super().__init__(f"Document with ID '{document_id}' was not found.")
        self.document_id = document_id

class InvalidDocumentException(DomainException):
    def __init__(self, message: str):
        super().__init__(message)

class SecurityViolationException(DomainException):
    def __init__(self, message: str, threat_type: str = "SECURITY_VIOLATION"):
        super().__init__(message)
        self.threat_type = threat_type

class VectorStoreException(DomainException):
    def __init__(self, message: str):
        super().__init__(message)

class LlmProviderException(DomainException):
    def __init__(self, message: str):
        super().__init__(message)
