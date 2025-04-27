from fastapi import FastAPI, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
import sys
import re # <-- Add import for regex
from typing import Optional, List, Dict, Any # <-- Add List, Dict, Any
# Use relative imports for modules within the same package level
from .core.model_loader import load_model_internal, load_model_by_name
from .routes.chat import router as chat_router
from .routes.settings import router as settings_router
from .routes.models import router as models_router # <-- Import the new models router
# Assuming schemas are also in backend/api/schemas
from .schemas.common import (
    LoadModelRequest, LoadModelResponse, ModelStatusResponse,
    ModelSettings, SettingsUpdateResponse, VRAMInfoResponse
)

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

# --- Theme Listing Endpoint ---
@app.get("/themes")
def list_themes():
    themes_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/public/themes'))
    if not os.path.isdir(themes_dir):
        raise HTTPException(status_code=404, detail="Themes directory not found")
    theme_files = [f for f in os.listdir(themes_dir) if f.endswith('.css')]
    theme_names = [os.path.splitext(f)[0] for f in theme_files]
    return JSONResponse(content=theme_names)

# --- Model Directory Listing Endpoint ---
@app.get("/models")
def list_models():
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../models'))
    if not os.path.isdir(models_dir):
        raise HTTPException(status_code=404, detail="Models directory not found")
    # Only include directories (potential models)
    model_names = [d for d in os.listdir(models_dir) if os.path.isdir(os.path.join(models_dir, d))]
    return JSONResponse(content=model_names)

# --- V2 Chat Models --- (New)
class Message(BaseModel):
    role: str
    content: str

class ChatRequestV2(BaseModel):
    mode: str = Field(..., description="Generation mode: 'instruction' or 'chat'.")
    message: Optional[str] = Field(None, description="Single user message for 'instruction' mode.")
    messages: Optional[List[Message]] = Field(None, description="List of messages for 'chat' mode.")
    return_prompt: Optional[bool] = Field(False, description="If true, return the raw prompt string used for generation.")

    @validator('mode')
    def validate_mode(cls, v):
        if v not in ["instruction", "chat"]:
            raise ValueError("Mode must be either 'instruction' or 'chat'.")
        return v

    @validator('messages', always=True)
    def check_messages_for_chat_mode(cls, v, values):
        if values.get('mode') == 'chat' and not v:
            raise ValueError("Messages list cannot be empty in 'chat' mode.")
        return v

    @validator('message', always=True)
    def check_message_for_instruction_mode(cls, v, values):
         if values.get('mode') == 'instruction' and not v:
            raise ValueError("Message cannot be empty in 'instruction' mode.")
         return v

class ChatResponseV2(BaseModel):
    response: str
    raw_prompt: Optional[str] = None # Optional field for the raw prompt

# --- End V2 Chat Models ---

# Models moved to schemas.common and schemas.chat

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

# --- New Endpoint to load model by name ---
@app.post("/api/v1/model/load/{model_name}", status_code=status.HTTP_200_OK)
async def load_model_by_name_route(model_name: str, request: Request):
    # Basic check if a model is already loaded (optional, decide if replacing is allowed)
    # if request.app.state.model is not None:
    #     raise HTTPException(
    #         status_code=status.HTTP_409_CONFLICT,
    #         detail=f"A model '{request.app.state.model_path}' is already loaded. Restart backend to change.",
    #     )
    try:
        print(f"Received request to load model: {model_name}")
        tokenizer, model, device = load_model_by_name(model_name)

        # Update app state
        request.app.state.tokenizer = tokenizer
        request.app.state.model = model
        request.app.state.device = device
        # Use model_name or resolved path for model_path state? Using name for now.
        request.app.state.model_path = model_name
        # Clear previous settings potentially? Or keep them?
        # request.app.state.system_prompt = "Default prompt for new model" # Example

        print(f"✅ Successfully loaded model '{model_name}' on device '{device}'")
        return {"status": "ok", "message": f"Model '{model_name}' loaded successfully.", "device": device}

    except ValueError as ve:
        # Specific error for unknown model name or invalid path from registry
        print(f"❌ Value error loading model '{model_name}': {ve}", file=sys.stderr)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except RuntimeError as re:
        # Specific error for loading failure from load_model_internal
        print(f"❌ Runtime error loading model '{model_name}': {re}", file=sys.stderr)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to load model '{model_name}': {re}")
    except Exception as e:
        # Generic catch-all
        print(f"❌ Unhandled error loading model '{model_name}': {e}", file=sys.stderr)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {e}")
# --- End New Endpoint ---

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

# Chat endpoint - check if model is loaded
MIN_NARRATIVE_TOKENS = 350  # Keep constant here if needed elsewhere, or move to config

app.include_router(chat_router, prefix="/api/v1", tags=["Chat"]) # <-- INCLUDE ROUTER
app.include_router(settings_router, prefix="/api/v1", tags=["Settings"])
app.include_router(models_router, prefix="/api/v1", tags=["Models"]) # <-- Include the new models router


