import os
import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# --- Model Loading Helper ---
def load_model_internal(path: str):
    """Loads the tokenizer and model from the specified path."""
    if not path or not os.path.isdir(path):
        raise ValueError(f"Invalid directory path provided: '{path}'")

    print(f"⏳ Attempting to load model from '{path}'...")
    try:
        # Trust remote code can be necessary for some models, consider security implications
        # For now, keeping it False as in the original code.
        tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True, trust_remote_code=False)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
            print("   ⚠️ Added pad_token = eos_token")

        model = AutoModelForCausalLM.from_pretrained(path, local_files_only=True, trust_remote_code=False)
        model.eval()

        # Determine device and move model
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        try:
            model.to(device)
            print(f"   ✅ Model successfully loaded from '{path}' and placed on '{device.upper()}'")
        except Exception as move_err:
            print(f"   ⚠️ Model loaded from '{path}' but failed to move to '{device.upper()}': {move_err}. Using CPU.")
            device = 'cpu' # Fallback to CPU

        return tokenizer, model, device

    except Exception as e:
        print(f"❌ Error loading model from '{path}': {e}", file=sys.stderr)
        # Re-raise a more specific exception or handle as needed
        raise RuntimeError(f"Failed to load model from '{path}': {e}") from e 