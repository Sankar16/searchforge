import sys
from pathlib import Path

# Ensure project root is on sys.path so `from src.xxx import yyy` works
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
