import sys
from fastapi import APIRouter, HTTPException, status, Request # Import Request
from typing import Optional, List, Dict, Any # Import necessary types

# Import Pydantic models from schemas.chat
from ..schemas.chat import (
    ChatRequest, ChatResponse, Message, ChatRequestV2, ChatResponseV2
)

# Import core logic functions using relative paths
from ..core.inference import generate_response
from ..core.prompt_builder import generate_prompt
from ..core.cleaner import truncate_at_stop_token, clean_response

router = APIRouter()

MIN_NARRATIVE_TOKENS = 350  # Replicate constant or import from a config module

# Chat endpoint - check if model is loaded
@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request): # Add request: Request
    app_state = request.app.state # Access app state
    # Check if model is loaded
    if not app_state.model or not app_state.tokenizer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model is not loaded. Please load a model via the /api/v1/model/load endpoint first.",
        )

    try:
        # Retrieve components from app_state
        current_tokenizer = app_state.tokenizer
        current_model = app_state.model
        current_device = app_state.device
        current_system_prompt = app_state.system_prompt
        current_temperature = app_state.temperature
        current_top_p = app_state.top_p
        current_max_new_tokens = app_state.max_new_tokens
        if current_max_new_tokens < MIN_NARRATIVE_TOKENS:
            current_max_new_tokens = MIN_NARRATIVE_TOKENS

        # --- Updated Prompt Formatting ---
        messages = [
            {"role": "system", "content": current_system_prompt},
            {"role": "user", "content": req.message}
        ]
        prompt = current_tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        # --- Call Refactored Generation Function ---
        response_text = generate_response(
            model=current_model,
            tokenizer=current_tokenizer,
            device=current_device,
            prompt=prompt,
            temperature=current_temperature,
            top_p=current_top_p,
            max_new_tokens=current_max_new_tokens
        )
        # --- End Call ---

        # Clean the response before returning
        cleaned_response_text = clean_response(response_text)
        truncated_response_text = truncate_at_stop_token(cleaned_response_text)
        return {"response": truncated_response_text}

    except Exception as e:
        print(f"Error during chat generation: {e}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during generation: {e}"
        )

# --- V2 Chat Endpoint --- (New)
@router.post("/chat-v2", response_model=ChatResponseV2)
def chat_v2(req: ChatRequestV2, request: Request): # Add request: Request
    app_state = request.app.state # Access app state
    # Check if model is loaded
    if not app_state.model or not app_state.tokenizer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model is not loaded. Please load a model first.",
        )

    try:
        # Retrieve components from app_state
        current_tokenizer = app_state.tokenizer
        current_model = app_state.model
        current_device = app_state.device
        current_system_prompt = app_state.system_prompt
        current_temperature = app_state.temperature
        current_top_p = app_state.top_p
        current_max_new_tokens = app_state.max_new_tokens
        if getattr(req, 'mode', None) == 'chat' and (current_max_new_tokens is None or current_max_new_tokens < MIN_NARRATIVE_TOKENS):
            current_max_new_tokens = MIN_NARRATIVE_TOKENS

        messages_list = [msg.dict() for msg in req.messages] if req.messages else None

        # Generate the prompt using the helper function
        prompt = generate_prompt(
            mode=req.mode,
            system_prompt=current_system_prompt,
            tokenizer=current_tokenizer,
            message=req.message,
            messages=messages_list
        )

        # --- Call Refactored Generation Function ---
        response_text = generate_response(
            model=current_model,
            tokenizer=current_tokenizer,
            device=current_device,
            prompt=prompt,
            temperature=current_temperature,
            top_p=current_top_p,
            max_new_tokens=current_max_new_tokens
        )
        # --- End Call ---

        # Clean the response
        cleaned_response_text = clean_response(response_text)
        truncated_response_text = truncate_at_stop_token(cleaned_response_text)
        response_data = {"response": truncated_response_text}
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