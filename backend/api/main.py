from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
import sys

app = FastAPI()

# Get model path from environment variable
model_path = os.environ.get('PROMETHEUS_MODEL_PATH')

if not model_path or not os.path.isdir(model_path):
    print(f"Error: Invalid or missing model path provided via PROMETHEUS_MODEL_PATH environment variable.", file=sys.stderr)
    print(f"Value received: '{model_path}'", file=sys.stderr)
    print("Please ensure main.py sets the environment variable correctly.", file=sys.stderr)
    sys.exit(1) # Exit if path is not valid, prevents FastAPI from starting incorrectly

# Load the model using the provided path
print(f"⏳ Loading model from '{model_path}'...")
try:
    tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(model_path, local_files_only=True, trust_remote_code=False)
    model.eval()
    # Check if model is on GPU (if CUDA available)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    try:
        model.to(device) # Attempt to move model to GPU if available
        print(f"✅ Model loaded successfully from '{model_path}' and placed on '{device.upper()}'")
    except Exception as move_err:
        print(f"✅ Model loaded successfully from '{model_path}' but failed to move to '{device.upper()}': {move_err}")
        print("Model will run on CPU.")
        device = 'cpu' # Fallback to CPU
except Exception as e:
    print(f"Error loading model from '{model_path}': {e}", file=sys.stderr)
    sys.exit(1)

# Define the request schema for chat messages
class ChatRequest(BaseModel):
    message: str

@app.get("/health")
def health_check():
    # Include model load status in health check
    return {"status": "ok", "model_loaded": True, "model_path": model_path, "device": device}

# Add VRAM endpoint
@app.get("/vram")
def get_vram_info():
    if torch.cuda.is_available():
        try:
            total_mem = torch.cuda.get_device_properties(0).total_memory
            reserved_mem = torch.cuda.memory_reserved(0)
            allocated_mem = torch.cuda.memory_allocated(0)
            free_mem = reserved_mem - allocated_mem # Often more practical than total - reserved

            # Convert bytes to GB
            gb = 1024**3
            return {
                "status": "ok",
                "device": torch.cuda.get_device_name(0),
                "total_gb": round(total_mem / gb, 2),
                "reserved_gb": round(reserved_mem / gb, 2),
                "allocated_gb": round(allocated_mem / gb, 2),
                "free_in_reserved_gb": round(free_mem / gb, 2)
            }
        except Exception as e:
            return {"status": "error", "message": f"Could not get CUDA VRAM info: {e}"}
    else:
        return {"status": "ok", "message": "CUDA not available. No VRAM info."}

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        inputs = tokenizer(req.message, return_tensors="pt").to(device) # Move inputs to the same device
        input_ids = inputs["input_ids"]
        input_length = input_ids.shape[1]
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=1000,
                do_sample=True,
                temperature=0.7,
                top_k=50,
                top_p=0.95,
            )
        generated_ids = outputs[0][input_length:]
        response_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        return {"response": response_text}
    except Exception as e:
        print(f"Error during chat generation: {e}", file=sys.stderr)
        # Return error in response format
        return {"response": f"Error during generation: {e}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
