from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
# import sys
from typing import Optional

app = FastAPI(
    title="Sigil Backend API",
    description="API for loading models and generating text.",
    version="0.1.0",
)

# --- Application State --- Keep track of loaded model components
app.state.model = None
app.state.tokenizer = None
app.state.device = None
app.state.model_path = None

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

# --- Model Loading Helper --- (Moved from initial load)
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

# --- Pydantic Models --- (Moved definitions up)
class LoadModelRequest(BaseModel):
    path: str = Field(..., description="Absolute or relative path to the model directory.")

class LoadModelResponse(BaseModel):
    message: str
    path: str
    device: str

class ModelStatusResponse(BaseModel):
    loaded: bool
    path: Optional[str] = None
    device: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

class ModelSettings(BaseModel):
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_new_tokens: Optional[int] = None

class SettingsUpdateResponse(BaseModel):
    message: str
    updated_settings: dict

class VRAMInfoResponse(BaseModel):
    status: str
    message: Optional[str] = None
    device: Optional[str] = None
    total_gb: Optional[float] = None
    reserved_gb: Optional[float] = None
    allocated_gb: Optional[float] = None
    free_in_reserved_gb: Optional[float] = None


# --- API Endpoints --- (Organized and updated)

# Endpoint to load the model
@app.post("/api/v1/model/load", response_model=LoadModelResponse, status_code=status.HTTP_200_OK)
def load_model_endpoint(req: LoadModelRequest):
    # Basic check if a model is already loaded
    if app.state.model is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A model is already loaded from '{app.state.model_path}'. Please restart the backend to load a different model.",
        )
    try:
        # Resolve relative paths from the backend API directory if necessary
        # For simplicity, assume path is usable as is (e.g., absolute or relative to where backend is run)
        model_path_to_load = req.path

        tokenizer, model, device = load_model_internal(model_path_to_load)

        # Update app state
        app.state.tokenizer = tokenizer
        app.state.model = model
        app.state.device = device
        app.state.model_path = model_path_to_load # Store the path used

        return {
            "message": "Model loaded successfully.",
            "path": app.state.model_path,
            "device": app.state.device
        }

    except ValueError as ve:
        # Specific error for invalid path
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        # Specific error for loading failure
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
    except Exception as e:
        # Generic catch-all
        print(f"Unhandled error during model load: {e}", file=sys.stderr)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")

# Endpoint to check model status
@app.get("/api/v1/model/status", response_model=ModelStatusResponse)
def get_model_status():
    if app.state.model and app.state.tokenizer:
        return {
            "loaded": True,
            "path": app.state.model_path,
            "device": app.state.device
        }
    else:
        return {"loaded": False}

# Simplified health check
@app.get("/health")
def health_check():
    return {"status": "ok"}

# VRAM endpoint - check device status
@app.get("/api/v1/vram", response_model=VRAMInfoResponse)
def get_vram_info():
    # Check if model is loaded and device is set
    if app.state.device is None:
         return {
            "status": "ok",
            "message": "Model not loaded yet. No device information available.",
        }

    if app.state.device == 'cuda' and torch.cuda.is_available():
        try:
            total_mem = torch.cuda.get_device_properties(0).total_memory
            reserved_mem = torch.cuda.memory_reserved(0)
            allocated_mem = torch.cuda.memory_allocated(0)
            free_mem = reserved_mem - allocated_mem
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
            return {
                "status": "error",
                "message": f"Could not get CUDA VRAM info: {e}"
            }
    elif app.state.device == 'cpu':
         return {
            "status": "ok",
            "message": "Model is loaded on CPU. No VRAM info.",
        }
    else:
        # Should not happen if device is set, but good to handle
        return {
            "status": "ok",
            "message": "CUDA not available or device is not CUDA. No VRAM info.",
        }

# Endpoint to update generation settings (renamed for clarity)
@app.post("/api/v1/settings/update", response_model=SettingsUpdateResponse)
def update_generation_settings(settings: ModelSettings):
    # No need to check if model is loaded, these are just parameters
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
         # Use 400 Bad Request if no valid settings were provided
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid settings provided to update.")

    return {"message": "Generation settings updated successfully.", "updated_settings": updated_settings}

# Chat endpoint - check if model is loaded
@app.post("/api/v1/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    # Check if model is loaded
    if not app.state.model or not app.state.tokenizer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, # 409 Conflict is suitable here
            detail="Model is not loaded. Please load a model via the /api/v1/model/load endpoint first.",
        )

    try:
        # Retrieve components from app.state
        current_tokenizer = app.state.tokenizer
        current_model = app.state.model
        current_device = app.state.device
        current_system_prompt = app.state.system_prompt
        current_temperature = app.state.temperature
        current_top_p = app.state.top_p
        current_max_new_tokens = app.state.max_new_tokens

        full_prompt = f"{current_system_prompt}\nUser: {req.message}\nAssistant:" # Example format

        inputs = current_tokenizer(full_prompt, return_tensors="pt").to(current_device)
        input_ids = inputs["input_ids"]
        attention_mask = inputs.get("attention_mask")
        input_length = input_ids.shape[1]

        with torch.no_grad():
            outputs = current_model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_new_tokens=current_max_new_tokens,
                do_sample=True,
                temperature=current_temperature,
                top_k=50,
                top_p=current_top_p,
                pad_token_id=current_tokenizer.pad_token_id
            )
        generated_ids = outputs[0][input_length:]
        response_text = current_tokenizer.decode(generated_ids, skip_special_tokens=True)
        return {"response": response_text.strip()}

    except Exception as e:
        print(f"Error during chat generation: {e}", file=sys.stderr)
        # Raise HTTP exception instead of returning error in response body
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during generation: {e}"
        )

# Remove the direct uvicorn run block if this file is primarily for import
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="127.0.0.1", port=8000) # Changed host back to 127.0.0.1 for local focus
