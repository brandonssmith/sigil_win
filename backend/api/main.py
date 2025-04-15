from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import os
import sys
import re # <-- Add import for regex
from typing import Optional, List, Dict, Any # <-- Add List, Dict, Any

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

# --- Helper Function for Cleaning Response --- (Added)
def clean_response(text: str) -> str:
    """Removes potential speaker tags like 'User:' or 'Assistant:' from the text."""
    # Use regex to remove the tags at the beginning of a line or after whitespace, case-insensitive
    # Handles variations like <|user|>, User :, etc. more broadly might be needed depending on model
    # This version targets the specific User: / Assistant: pattern from the original prompt format
    return re.sub(r"^\s*\b(User|Assistant):\s*", "", text, flags=re.IGNORECASE | re.MULTILINE).strip()

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

        # --- Updated Prompt Formatting ---
        messages = [
            {"role": "system", "content": current_system_prompt},
            {"role": "user", "content": req.message}
        ]
        prompt = current_tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True # Ensures the assistant prompt is added correctly
        )
        # print(f"\\n--- Generated Prompt for Model --- \\n{prompt}\\n--------------------------------\\n") # Optional: for debugging

        inputs = current_tokenizer(prompt, return_tensors="pt").to(current_device)
        # --- End Updated Prompt Formatting ---

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

        # Clean the response before returning
        cleaned_response_text = clean_response(response_text)
        return {"response": cleaned_response_text}

    except Exception as e:
        print(f"Error during chat generation: {e}", file=sys.stderr)
        # Raise HTTP exception instead of returning error in response body
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during generation: {e}"
        )

# --- Helper Function for Prompt Generation --- (New)
def generate_prompt(
    mode: str,
    system_prompt: str,
    tokenizer: AutoTokenizer,
    message: Optional[str] = None,
    messages: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Generates the appropriate prompt string based on the mode."""
    if mode == "instruction":
        if not message:
            raise ValueError("Message is required for 'instruction' mode.")
        # Use apply_chat_template for instruction mode as well for consistency
        # Create a minimal message list for instruction mode
        instruction_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        prompt = tokenizer.apply_chat_template(
            instruction_messages,
            tokenize=False,
            add_generation_prompt=True # Ensures the assistant prompt is added correctly
        )
    elif mode == "chat":
        if not messages:
            raise ValueError("Messages list is required for 'chat' mode.")
        # Prepend system prompt if not already present or update if it is
        if not messages or messages[0].get("role") != "system":
            chat_messages_with_system = [{"role": "system", "content": system_prompt}] + messages
        else:
            # Update existing system prompt if provided, otherwise keep the one from history
            chat_messages_with_system = messages
            chat_messages_with_system[0]["content"] = system_prompt

        prompt = tokenizer.apply_chat_template(
            chat_messages_with_system,
            tokenize=False,
            add_generation_prompt=True # Ensures the assistant prompt is added correctly
        )
    else:
        raise ValueError("Invalid mode specified for prompt generation.")

    # Optional: Print the generated prompt for debugging
    # print(f"\\n--- Generated Prompt (Mode: {mode}) --- \\n{prompt}\\n--------------------------------\\n")
    return prompt

# --- V2 Chat Endpoint --- (New)
@app.post("/api/v1/chat-v2", response_model=ChatResponseV2)
def chat_v2(req: ChatRequestV2):
    # Check if model is loaded
    if not app.state.model or not app.state.tokenizer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model is not loaded. Please load a model first.",
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

        # Convert Pydantic messages to simple dicts if needed for the helper
        messages_list = [msg.dict() for msg in req.messages] if req.messages else None

        # Generate the prompt using the helper function
        prompt = generate_prompt(
            mode=req.mode,
            system_prompt=current_system_prompt,
            tokenizer=current_tokenizer,
            message=req.message,
            messages=messages_list
        )

        inputs = current_tokenizer(prompt, return_tensors="pt").to(current_device)
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
                top_k=50, # Keeping default top_k, adjust if needed
                top_p=current_top_p,
                pad_token_id=current_tokenizer.pad_token_id
            )

        generated_ids = outputs[0][input_length:]
        response_text = current_tokenizer.decode(generated_ids, skip_special_tokens=True)

        # Clean the response
        cleaned_response_text = clean_response(response_text)

        response_data = {"response": cleaned_response_text}
        if req.return_prompt:
            response_data["raw_prompt"] = prompt

        return response_data

    except ValueError as ve: # Catch specific errors from prompt generation or validation
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        print(f"Error during chat-v2 generation: {e}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during generation: {e}"
        )

# Remove the direct uvicorn run block if this file is primarily for import
# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="127.0.0.1", port=8000) # Changed host back to 127.0.0.1 for local focus
