"""Vercel Serverless Function entry point for FastAPI."""

import os
import sys

# Ensure backend root is on python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402
