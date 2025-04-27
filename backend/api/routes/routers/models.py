from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

# Import the utility functions and exceptions from the correct path
from backend.utils.huggingface_utils import (
    search_models,
    download_model,
    get_hf_token,
    ModelSearchError,
    ModelDownloadError,
    HuggingFaceError,
    # Consider importing TokenValidationError if you add a token validation endpoint
)

router = APIRouter(
    prefix="/models",
    tags=["models"], # Tag for Swagger UI documentation
)

# --- Pydantic Models for Request/Response ---

class ModelSearchResult(BaseModel):
    id: str
    private: bool
    likes: int
    pipeline_tag: Optional[str] = None
    last_modified: Optional[str] = None

class ModelDownloadRequest(BaseModel):
    model_name: str # e.g., "google/flan-t5-small"

class ModelDownloadResponse(BaseModel):
    message: str
    download_path: Optional[str] = None # Path relative to the server

# --- API Endpoints ---

@router.get("/search", response_model=List[ModelSearchResult])
async def search_huggingface_models(
    query: str = Query(..., min_length=1, description="Search query for Hugging Face models"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return")
):
    """
    Searches the Hugging Face Hub for models based on a query.
    """
    token = get_hf_token() # Get token from environment for potential private model visibility
    try:
        results = search_models(query=query, token=token, limit=limit)
        return results # FastAPI will automatically convert the list of dicts
    except ModelSearchError as e:
        # Log the error e
        raise HTTPException(status_code=500, detail=f"Model search failed: {e}")
    except Exception as e:
        # Log the unexpected error e
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred during search: {e}")


@router.post("/download", response_model=ModelDownloadResponse)
async def download_huggingface_model(request: ModelDownloadRequest):
    """
    Downloads a specified model from Hugging Face Hub.
    Handles gated models by returning an error asking the user to accept terms online.
    """
    token = get_hf_token() # Token needed for gated models and potentially private ones
    model_name = request.model_name

    if not model_name:
         raise HTTPException(status_code=400, detail="Model name cannot be empty.")

    try:
        # The download_model function now handles the gated check internally and raises HuggingFaceError
        print(f"API: Request to download model: {model_name}") # Replace with logging
        download_path = download_model(model_name=model_name, token=token)
        print(f"API: Model download successful: {download_path}") # Replace with logging
        return ModelDownloadResponse(
            message=f"Model '{model_name}' downloaded successfully or already exists.",
            download_path=str(download_path) # Convert Path object to string for response
        )
    except HuggingFaceError as e:
        # This catches errors from is_model_gated and the specific gated error raised by download_model
        # Log the error e
        # If it's the specific gated model error, return 403 Forbidden
        if "gated" in str(e) and "accept the terms" in str(e):
             print(f"API: Gated model error for {model_name}: {e}") # Replace with logging
             raise HTTPException(status_code=403, detail=str(e))
        # Handle other HF errors (like model not found)
        print(f"API: HuggingFace API error for {model_name}: {e}") # Replace with logging
        raise HTTPException(status_code=404, detail=str(e)) # Or 500 depending on the error
    except ModelDownloadError as e:
        # Log the error e
        print(f"API: Download failed for {model_name}: {e}") # Replace with logging
        # Determine appropriate status code (e.g., 401/403 for auth/permission, 500 for others)
        status_code = 500
        if "401" in str(e) or "403" in str(e) or "authentication" in str(e):
            status_code = 403 # Forbidden or Unauthorized
        elif "not found" in str(e):
            status_code = 404
        raise HTTPException(status_code=status_code, detail=f"Model download failed: {e}")
    except Exception as e:
        # Log the unexpected error e
        print(f"API: Unexpected error during download of {model_name}: {e}") # Replace with logging
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred during download: {e}")

# Potential future endpoints:
# - GET /models/downloaded : List locally available models
# - POST /models/token/validate : Validate a user-provided token (if needed) 