import re
from typing import List, Optional

# --- Helper Function for Truncating at Stop Tokens ---
def truncate_at_stop_token(text: str, stop_tokens: Optional[List[str]] = None) -> str:
    """Truncates the text at the first occurrence of any stop token."""
    if not stop_tokens:
        stop_tokens = [
            "\nUser:", "\nuser:", "\nAssistant:", "\nassistant:", "</s>", "<|endoftext|>", "<|user|>", "<|assistant|>"
        ]
    min_idx = None
    for token in stop_tokens:
        idx = text.find(token)
        if idx != -1:
            if min_idx is None or idx < min_idx:
                min_idx = idx
    if min_idx is not None:
        return text[:min_idx].rstrip()
    return text

# --- Helper Function for Cleaning Response ---
def clean_response(text: str) -> str:
    """Removes potential speaker tags like 'User:' or 'Assistant:' from the text."""
    # Use regex to remove the tags at the beginning of a line or after whitespace, case-insensitive
    # Handles variations like <|user|>, User :, etc. more broadly might be needed depending on model
    # This version targets the specific User: / Assistant: pattern from the original prompt format
    return re.sub(r"^\s*\b(User|Assistant):\s*", "", text, flags=re.IGNORECASE | re.MULTILINE).strip() 