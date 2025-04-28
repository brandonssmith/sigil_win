from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import List, Optional

# Import the utility functions and exceptions
from backend.utils.huggingface_utils import (
    search_models,
    download_model,
    get_hf_token,
    validate_token_and_get_username,
    save_hf_token,
    ModelSearchError,
    ModelDownloadError,
    HuggingFaceError,
    TokenValidationError,
    TokenSaveError
)
# Import common schemas used
from ..schemas.common import ModelStatusResponse

# ---------------------------------------------------------------------------
# Router Setup
# ---------------------------------------------------------------------------
router = APIRouter(
    tags=["models"],
)

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class ModelSearchResult(BaseModel):
    id: str
    private: bool
    likes: int
    pipeline_tag: Optional[str] = None
    last_modified: Optional[str] = None

class ModelDownloadRequest(BaseModel):
    model_name: str

class ModelDownloadResponse(BaseModel):
    message: str
    download_path: Optional[str] = None

class HFTokenStatusResponse(BaseModel):
    status: str  # 'valid', 'invalid', 'not_found'
    username: Optional[str] = None
    message: Optional[str] = None

class SaveTokenRequest(BaseModel):
    token: str

class SaveTokenResponse(BaseModel):
    status: str # 'success' or 'error'
    message: str

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/token/status", response_model=HFTokenStatusResponse)
async def get_huggingface_token_status():
    """Return token status and username if token is valid."""
    token = get_hf_token()
    if not token:
        return HFTokenStatusResponse(status="not_found", message="Hugging Face token not found in ~/.env")

    try:
        username = validate_token_and_get_username(token)
        if username:
            return HFTokenStatusResponse(status="valid", username=username)
        return HFTokenStatusResponse(status="invalid", message="Token validation failed (no username returned)")
    except TokenValidationError as e:
        return HFTokenStatusResponse(status="invalid", message=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during token validation: {e}")


@router.get("/status", response_model=ModelStatusResponse)
def get_model_status(request: Request):
    """Checks if a model is currently loaded and returns its status."""
    app_state = request.app.state
    if app_state.model and app_state.tokenizer:
        return {
            "loaded": True,
            "path": app_state.model_path,
            "device": app_state.device
        }
    else:
        return {"loaded": False}


@router.get("/search", response_model=List[ModelSearchResult])
async def search_huggingface_models(
    query: str = Query(..., min_length=1, description="Search query for Hugging Face models"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return"),
):
    """Search the Hugging Face Hub for models."""
    token = get_hf_token()
    try:
        return search_models(query=query, token=token, limit=limit)
    except ModelSearchError as e:
        raise HTTPException(status_code=500, detail=f"Model search failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {e}")


@router.post("/token/save", response_model=SaveTokenResponse)
async def save_huggingface_token(request: SaveTokenRequest):
    """
    Saves the provided Hugging Face token to the ~/.env file.
    """
    try:
        save_hf_token(request.token)
        return SaveTokenResponse(status="success", message="Token saved successfully to ~/.env and loaded.")
    except TokenSaveError as e:
        # Log the error e
        print(f"API: Failed to save token: {e}") # Replace with logging
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # Log unexpected errors
        print(f"API: Unexpected error saving token: {e}") # Replace with logging
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred while saving the token: {e}")


@router.post("/download", response_model=ModelDownloadResponse)
async def download_huggingface_model(request: ModelDownloadRequest):
    """Download the specified model from Hugging Face Hub."""
    token = get_hf_token()
    model_name = request.model_name.strip() if request.model_name else ""
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name cannot be empty.")

    try:
        download_path = download_model(model_name=model_name, token=token)
        return ModelDownloadResponse(
            message=f"Model '{model_name}' downloaded successfully or already exists.",
            download_path=str(download_path),
        )
    except HuggingFaceError as e:
        # Handle gated or access-related issues
        if "gated" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except ModelDownloadError as e:
        # Differentiate between auth/permission issues and generic errors
        if "401" in str(e) or "403" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected server error during download: {e}") 