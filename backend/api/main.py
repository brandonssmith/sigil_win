from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
import sys
from typing import Optional

app = FastAPI()

# Initialize default settings in app.state
app.state.system_prompt = "You are a helpful assistant."
app.state.temperature = 0.7
app.state.top_p = 0.95  # Default Top P
app.state.max_new_tokens = 1000 # Default Max Tokens

# Define allowed origins for CORS
origins = [
    "http://localhost:5173", # Vite default dev server
    "http://127.0.0.1:5173", # Also allow explicit 127.0.0.1
]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # List of origins allowed
    allow_credentials=True, # Allow cookies (optional, but often needed)
    allow_methods=["*"],    # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],    # Allow all headers
)

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
    # Add special tokens if they don't exist
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        print("⚠️ Added pad_token = eos_token")

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

# Define the request schema for model settings
class ModelSettings(BaseModel):
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_new_tokens: Optional[int] = None

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

# Endpoint to update model settings
@app.post("/reload_model")
def reload_model_settings(settings: ModelSettings):
    updated_settings = {}
    if settings.system_prompt is not None:
        app.state.system_prompt = settings.system_prompt
        updated_settings["system_prompt"] = app.state.system_prompt
        print(f"🔄 System prompt updated to: '{app.state.system_prompt}'")
    if settings.temperature is not None:
        if not (0 < settings.temperature <= 2.0): # Allow slightly higher temp range
             raise HTTPException(status_code=400, detail="Temperature must be between 0 (exclusive) and 2.0 (inclusive).")
        app.state.temperature = settings.temperature
        updated_settings["temperature"] = app.state.temperature
        print(f"🔄 Temperature updated to: {app.state.temperature}")
    if settings.top_p is not None:
        if not (0 < settings.top_p <= 1.0):
            raise HTTPException(status_code=400, detail="Top P must be between 0 (exclusive) and 1.0 (inclusive).")
        app.state.top_p = settings.top_p
        updated_settings["top_p"] = app.state.top_p
        print(f"🔄 Top P updated to: {app.state.top_p}")
    if settings.max_new_tokens is not None:
        if settings.max_new_tokens <= 0:
            raise HTTPException(status_code=400, detail="Max new tokens must be positive.")
        app.state.max_new_tokens = settings.max_new_tokens
        updated_settings["max_new_tokens"] = app.state.max_new_tokens
        print(f"🔄 Max new tokens updated to: {app.state.max_new_tokens}")

    if not updated_settings:
         return {"message": "No settings provided to update."}

    return {"message": "Model settings updated successfully.", "updated_settings": updated_settings}

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        # Retrieve settings from app.state
        current_system_prompt = app.state.system_prompt
        current_temperature = app.state.temperature
        current_top_p = app.state.top_p
        current_max_new_tokens = app.state.max_new_tokens

        # Combine system prompt and user message (adjust format if needed for your model)
        full_prompt = f"{current_system_prompt}\nUser: {req.message}\nAssistant:" # Example format

        inputs = tokenizer(full_prompt, return_tensors="pt").to(device) # Move inputs to the same device
        input_ids = inputs["input_ids"]
        attention_mask = inputs.get("attention_mask") # Get attention mask if tokenizer provides it
        input_length = input_ids.shape[1]

        with torch.no_grad():
            outputs = model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask, # Pass attention mask
                max_new_tokens=current_max_new_tokens, # Use updated max_new_tokens
                do_sample=True,
                temperature=current_temperature, # Use updated temperature
                top_k=50, # Keep top_k fixed for now, or add to settings later
                top_p=current_top_p, # Use updated top_p
                pad_token_id=tokenizer.pad_token_id # Set pad token id
            )
        # Decode only the newly generated tokens
        generated_ids = outputs[0][input_length:]
        response_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        return {"response": response_text.strip()} # Strip leading/trailing whitespace
    except Exception as e:
        print(f"Error during chat generation: {e}", file=sys.stderr)
        # Return error in response format
        return {"response": f"Error during generation: {e}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
