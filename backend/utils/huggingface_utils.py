#!/usr/bin/env python3
import os
from pathlib import Path
from dotenv import load_dotenv
from huggingface_hub import snapshot_download, HfApi
from huggingface_hub.utils import HfHubHTTPError, LocalEntryNotFoundError
from huggingface_hub.hf_api import ModelInfo
import requests
from typing import List, Optional, Dict # Added Dict for type hinting

# Define the target download directory relative to the script's execution context (adjust as needed)
# Consider making this configurable or passed in
DEFAULT_DOWNLOAD_ROOT = Path(__file__).parent.parent / "models" # Relative to backend/

class HuggingFaceError(Exception):
    """Base exception for Hugging Face utility errors."""
    pass

class TokenValidationError(HuggingFaceError):
    """Exception raised for invalid Hugging Face tokens."""
    pass

class ModelDownloadError(HuggingFaceError):
    """Exception raised for errors during model download."""
    pass

class ModelSearchError(HuggingFaceError):
    """Exception raised for errors during model search."""
    pass


def get_hf_token() -> Optional[str]:
    """Loads the Hugging Face token from the ~/.env file."""
    env_path = Path.home() / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True) # Override allows reloading if called again
    else:
        # Log this or handle appropriately if the file MUST exist
        print(f"Info: Environment file not found at {env_path}") # Keep print for now, replace with logging
    return os.getenv("HUGGINGFACE_TOKEN")

def validate_token_and_get_username(token: str) -> Optional[str]:
    """
    Validates the Hugging Face token using the whoami endpoint and returns the username.
    Raises TokenValidationError on failure.
    """
    if not token:
        return None # Or raise an error? Depends on desired behavior.

    try:
        api = HfApi(token=token)
        user_info = api.whoami(token=token)

        if isinstance(user_info, dict) and 'name' in user_info:
            return user_info.get('name')
        else:
            # Log this unexpected format
            raise TokenValidationError("Unexpected response format from Hugging Face whoami endpoint.")

    except HfHubHTTPError as e:
        error_message = f"Error validating token (HTTP Error {e.response.status_code if e.response else 'N/A'}): {e}"
        if e.response and e.response.status_code == 401:
             error_message = "Hugging Face token appears to be invalid or expired (401 Unauthorized)."
        raise TokenValidationError(error_message) from e
    except requests.exceptions.RequestException as e:
        raise TokenValidationError(f"Error validating token (Network Error): {e}") from e
    except Exception as e:
        raise TokenValidationError(f"An unexpected error occurred during token validation: {e}") from e

def search_models(query: str, token: Optional[str], limit: int = 10) -> List[Dict]:
    """
    Searches Hugging Face Hub for models matching the query.
    Returns a list of model dictionaries.
    Raises ModelSearchError on failure.
    """
    try:
        api = HfApi(token=token)
        # Specify full_info=False unless more details are needed, might be faster
        model_generator = api.list_models(search=query, limit=limit, sort="likes", direction=-1, full=False)
        models_info = list(model_generator) # Convert generator to list

        if not models_info:
            return [] # Return empty list if no models found

        # Convert ModelInfo objects to simple dictionaries for API response
        models_list = [
            {
                "id": model.id,
                "private": model.private,
                "likes": model.likes,
                "pipeline_tag": model.pipeline_tag,
                "last_modified": model.lastModified.isoformat() if model.lastModified else None,
                # Add other relevant fields if needed: model.tags
            }
            for model in models_info
        ]
        return models_list

    except requests.exceptions.RequestException as e:
        raise ModelSearchError(f"Network error during model search: {e}") from e
    except Exception as e:
        raise ModelSearchError(f"An unexpected error occurred during model search: {e}") from e


def is_model_gated(model_name: str, token: Optional[str]) -> bool:
    """
    Checks if a model on Hugging Face Hub is gated.
    Returns True if gated, False otherwise.
    Raises HuggingFaceError on failure to retrieve info.
    """
    try:
        api = HfApi(token=token)
        model_info = api.model_info(model_name, token=token) # Use token here too

        # The 'gated' attribute exists on ModelInfo and can be True, 'auto', or 'manual'
        return bool(getattr(model_info, 'gated', False))

    except HfHubHTTPError as e:
        # Handle specific errors like 404 Not Found gracefully if needed
        if e.response and e.response.status_code == 404:
            raise HuggingFaceError(f"Model '{model_name}' not found on Hugging Face Hub.") from e
        raise HuggingFaceError(f"Could not retrieve model info for '{model_name}' to check gated status: {e}") from e
    except requests.exceptions.RequestException as e:
        raise HuggingFaceError(f"Network error checking gated status for '{model_name}': {e}") from e
    except Exception as e:
        raise HuggingFaceError(f"Unexpected error checking gated status for '{model_name}': {e}") from e

def download_model(model_name: str, token: Optional[str], download_dir: Path = DEFAULT_DOWNLOAD_ROOT) -> Path:
    """
    Downloads a model from Hugging Face Hub.
    Returns the path to the downloaded model directory.
    Raises ModelDownloadError on failure or HuggingFaceError for gating issues.
    """
    # Ensure the root download directory exists
    try:
        download_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise ModelDownloadError(f"Error creating root download directory {download_dir}: {e}") from e

    # Construct the specific path for this model
    # Replace slashes with something else, '--' is common
    model_local_name = model_name.replace("/", "--")
    model_path = download_dir / model_local_name

    # Basic check if model *directory* exists and seems populated (e.g., has a config file)
    config_file = model_path / "config.json" # A common file to check for
    if model_path.is_dir() and config_file.exists():
        print(f"Model directory {model_path} seems to exist and has config.json. Skipping download.")
        return model_path # Assume already downloaded

    # --- Gated Model Check ---
    # Check *before* attempting download if gated status requires user interaction
    # In an API context, we can't prompt the user. We should report the gated status.
    try:
        if is_model_gated(model_name, token):
            model_url = f"https://huggingface.co/{model_name}"
            # Raise a specific error indicating user action is needed
            raise HuggingFaceError(
                f"Model '{model_name}' is gated. Please visit {model_url} "
                "to accept the terms before attempting download via the API."
            )
    except HuggingFaceError as e:
        # Re-raise if it's the specific gating error, or another error from is_model_gated
        raise e

    print(f"Attempting to download {model_name} to {model_path}...") # Replace with logging
    try:
        snapshot_path = snapshot_download(
            repo_id=model_name,
            local_dir=str(model_path),
            token=token,
            local_dir_use_symlinks=False, # Avoid symlinks for simplicity unless needed
            # Consider adding ignore_patterns if certain files aren't needed (e.g., "*.safetensors")
        )
        print(f"Download complete. Model saved to: {snapshot_path}") # Replace with logging
        return Path(snapshot_path) # snapshot_download returns the path as a string

    except HfHubHTTPError as e:
        error_message = f"HTTP Error downloading model: {e}."
        if e.response and e.response.status_code == 401:
             error_message += " This model might require authentication (valid token) or acceptance of terms on the Hugging Face website."
        elif e.response and e.response.status_code == 403: # Often related to gated models without access
             error_message += f" Access denied (403). If '{model_name}' is gated, ensure you've accepted terms at https://huggingface.co/{model_name} and your token is valid."
        # Clean up potentially incomplete download
        _cleanup_incomplete_download(model_path)
        raise ModelDownloadError(error_message) from e
    except LocalEntryNotFoundError as e:
         _cleanup_incomplete_download(model_path)
         raise ModelDownloadError(f"Model or specific file not found on Hugging Face Hub: {e}") from e
    except requests.exceptions.RequestException as e:
        _cleanup_incomplete_download(model_path)
        raise ModelDownloadError(f"Network error during download: {e}") from e
    except Exception as e:
        _cleanup_incomplete_download(model_path)
        raise ModelDownloadError(f"An unexpected error occurred during download: {e}") from e

def _cleanup_incomplete_download(model_path: Path):
    """Attempts to remove a directory if a download failed."""
    if model_path.exists() and model_path.is_dir():
        try:
            import shutil
            shutil.rmtree(model_path)
            print(f"Cleaned up potentially incomplete directory: {model_path}") # Replace with logging
        except Exception as cleanup_e:
            # Log this cleanup error but don't let it mask the original download error
            print(f"Error during cleanup of {model_path}: {cleanup_e}") # Replace with logging

# Example usage (optional, for testing the module directly)
if __name__ == '__main__':
    print("Testing Hugging Face Utilities...")

    # Test getting token
    token = get_hf_token()
    if token:
        print("Token found.")
        try:
            username = validate_token_and_get_username(token)
            if username:
                print(f"Token validated for user: {username}")
            else:
                # This case might occur if token is empty but file existed
                 print("Token validation returned no username (token might be empty/invalid?).")
        except TokenValidationError as e:
            print(f"Token validation failed: {e}")
    else:
        print("No token found in ~/.env")

    # Test search (use a common model)
    print("Testing model search (flan-t5-small):")
    try:
        search_results = search_models("flan-t5-small", token, limit=3)
        if search_results:
            print(f"Found {len(search_results)} models:")
            for model in search_results:
                print(f"  - {model['id']} (Likes: {model['likes']}, Private: {model['private']})")
        else:
            print("No models found.")
    except ModelSearchError as e:
        print(f"Search failed: {e}")

    # Test gated check (use a known gated model like meta-llama/Llama-2-7b-chat-hf)
    # Note: This will require agreement on HF website + valid token to pass checks later
    gated_model_name = "meta-llama/Llama-2-7b-chat-hf"
    print(f"Testing gated check ({gated_model_name}):")
    try:
        is_gated = is_model_gated(gated_model_name, token)
        print(f"Is '{gated_model_name}' gated? {is_gated}")
        if is_gated and not token:
            print("Note: Cannot download gated models without a valid token and accepting terms.")
    except HuggingFaceError as e:
        print(f"Gated check failed: {e}")


    # Test download (use a small, non-gated model like 'bert-base-uncased')
    # Uncomment carefully - this will actually download files!
    # model_to_download = "google/flan-t5-small" # Small T5 model
    # print(f"Testing download ({model_to_download}):")
    # try:
    #     download_path = download_model(model_to_download, token)
    #     print(f"Model downloaded/found at: {download_path}")
    # except (ModelDownloadError, HuggingFaceError) as e:
    #     print(f"Download failed: {e}") 