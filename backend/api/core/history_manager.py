import os
import json
import datetime
from typing import Optional, List, Dict, Any

# Define the directory where chat histories will be stored
# --- MODIFIED: Point to 'saved_chats' at the project root level --- 
# Assumes history_manager.py is in backend/api/core
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
HISTORY_DIR = os.path.join(PROJECT_ROOT, "saved_chats")
# HISTORY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "chat_history") # Old path
# --- END MODIFICATION ---

os.makedirs(HISTORY_DIR, exist_ok=True)

def generate_thread_id() -> str:
    """Generates a unique thread ID based on timestamp."""
    now = datetime.datetime.now()
    return now.strftime("%Y%m%d_%H%M%S_%f")

def get_session_filepath(thread_id: str) -> str:
    """Gets the full path for a session's JSON file."""
    # Basic sanitization to prevent path traversal
    if ".." in thread_id or "/" in thread_id or "\\" in thread_id:
        raise ValueError("Invalid thread_id format containing path elements.")
    return os.path.join(HISTORY_DIR, f"{thread_id}.json")

def save_chat_messages(
    thread_id: Optional[str], 
    messages: List[Dict[str, Any]],
    sampling_settings: Optional[Dict[str, Any]] = None,
    system_prompt: Optional[str] = None
) -> str:
    """
    Saves a list of messages and associated settings to a chat session file.
    If thread_id is None, creates a new session.
    Saves sampling settings and system prompt if provided.
    Returns the thread_id of the saved session.
    """
    if thread_id is None:
        thread_id = generate_thread_id()
        # For a new thread, create the full structure
        session_data = {
            "thread_id": thread_id, 
            "messages": messages, 
            "metadata": {"created_at": datetime.datetime.utcnow().isoformat()},
            "sampling_settings": sampling_settings,
            "system_prompt": system_prompt
        }
    else:
        try:
            filepath = get_session_filepath(thread_id)
        except ValueError as e:
             print(f"Error saving: {e}")
             raise 

        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    session_data = json.load(f)
                # Append new messages
                session_data["messages"].extend(messages)
                session_data["metadata"]["last_updated"] = datetime.datetime.utcnow().isoformat()
                # Update settings only if they are explicitly passed in
                if sampling_settings is not None:
                    session_data["sampling_settings"] = sampling_settings
                if system_prompt is not None:
                    session_data["system_prompt"] = system_prompt
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error reading session file {thread_id}: {e}. Overwriting with new data.")
                # If file is corrupted, overwrite with current state
                session_data = {
                    "thread_id": thread_id, 
                    "messages": messages, 
                    "metadata": {"last_updated": datetime.datetime.utcnow().isoformat()},
                    "sampling_settings": sampling_settings,
                    "system_prompt": system_prompt
                }
        else:
             # If file doesn't exist for the given ID, create it
             session_data = {
                 "thread_id": thread_id, 
                 "messages": messages, 
                 "metadata": {"created_at": datetime.datetime.utcnow().isoformat()},
                 "sampling_settings": sampling_settings,
                 "system_prompt": system_prompt
             }

    # Get filepath again (needed if it was a new thread_id or file didn't exist)
    try:
        filepath = get_session_filepath(thread_id)
    except ValueError as e:
         print(f"Error getting filepath for saving: {e}")
         raise
         
    try:
        with open(filepath, 'w') as f:
            json.dump(session_data, f, indent=2)
    except IOError as e:
        print(f"Error writing session file {thread_id}: {e}")
        raise # Re-raise the exception to signal failure

    return thread_id

def get_session(thread_id: str) -> Optional[Dict[str, Any]]:
    """Loads a chat session from its JSON file."""
    try:
        filepath = get_session_filepath(thread_id)
    except ValueError:
        return None # Invalid thread_id format
        
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, 'r') as f:
            session_data = json.load(f)
        # Add title generation here if needed, or handle in list_sessions
        return session_data
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading session file {thread_id}: {e}")
        return None # Indicate failure to load

def list_sessions() -> List[Dict[str, Any]]:
    """Lists all available chat sessions with basic metadata."""
    sessions_list = []
    if not os.path.isdir(HISTORY_DIR):
        print(f"History directory not found: {HISTORY_DIR}")
        return []
    try:
        for filename in os.listdir(HISTORY_DIR):
            if filename.endswith(".json"):
                thread_id = filename[:-5] # Remove .json extension
                # Add basic check for potentially invalid filenames from listdir
                if ".." in thread_id or "/" in thread_id or "\\" in thread_id:
                    print(f"Skipping potentially unsafe filename: {filename}")
                    continue
                filepath = get_session_filepath(thread_id)
                try:
                    with open(filepath, 'r') as f:
                        session_data = json.load(f)
                    
                    # Attempt to create a title (e.g., from first user message)
                    title = thread_id # Default title is the ID
                    if session_data.get("messages") and len(session_data["messages"]) > 0:
                         # Find first user message maybe? Or first message overall?
                         first_message = session_data["messages"][0]["content"]
                         title = first_message[:50] + ('...' if len(first_message) > 50 else '') # Truncate

                    sessions_list.append({
                        "thread_id": thread_id,
                        "title": title, # Or generate a title based on content/timestamp
                        "last_updated": session_data.get("metadata", {}).get("last_updated"),
                        "created_at": session_data.get("metadata", {}).get("created_at")
                    })
                except (json.JSONDecodeError, IOError, KeyError, ValueError) as e: # Added ValueError
                    print(f"Error reading or parsing session file {filename}: {e}. Skipping.")
                    continue # Skip corrupted files
        
        # Sort sessions, e.g., by last updated descending (most recent first)
        sessions_list.sort(key=lambda x: x.get("last_updated") or x.get("created_at") or '', reverse=True)

    except OSError as e:
        print(f"Error listing directory {HISTORY_DIR}: {e}")
        return [] # Return empty list on error

    return sessions_list

# --- NEW: Function to delete a session file ---
def delete_session(thread_id: str) -> bool:
    """
    Deletes a session file based on thread_id.
    Returns True if successful, False otherwise.
    Raises ValueError on invalid thread_id format.
    """
    try:
        filepath = get_session_filepath(thread_id)
    except ValueError as e:
        print(f"Invalid thread_id for deletion: {e}")
        raise # Re-raise the specific error

    if not os.path.exists(filepath):
        print(f"Session file not found for deletion: {filepath}")
        return False # Indicate file not found

    try:
        os.remove(filepath)
        print(f"Successfully deleted session file: {filepath}")
        return True
    except OSError as e:
        print(f"Error deleting session file {filepath}: {e}")
        return False # Indicate deletion failed
# --- End Delete Function --- 