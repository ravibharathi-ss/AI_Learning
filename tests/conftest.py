"""
Pytest configuration and fixture setup.
Adds backend and backend/src to sys.path so tests execute seamlessly.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
src_dir = backend_dir / "src"

for p in [str(backend_dir), str(src_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)
