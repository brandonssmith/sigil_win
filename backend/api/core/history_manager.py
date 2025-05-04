import os
import json
import datetime
from typing import Optional, List, Dict, Any

# Define the directory where chat histories will be stored
HISTORY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "chat_history") # Adjust path as needed
os.makedirs(HISTORY_DIR, exist_ok=True)

def generate_thread_id() -> str:
    """Generates a unique thread ID based on timestamp."""
    now = datetime.datetime.now()
    return now.strftime("%Y%m%d_%H%M%S_%f")

def get_session_filepath(thread_id: str) -> str:
    """Gets the full path for a session's JSON file."""
    return os.path.join(HISTORY_DIR, f"{thread_id}.json")

def save_chat_messages(thread_id: Optional[str], messages: List[Dict[str, Any]]) -> str:
    """
    Saves a list of messages to a chat session file.
    If thread_id is None, creates a new session.
    Returns the thread_id of the saved session.
    """
    if thread_id is None:
        thread_id = generate_thread_id()
        # For a new thread, we assume the messages list is the start of the chat
        session_data = {"thread_id": thread_id, "messages": messages, "metadata": {"created_at": datetime.datetime.utcnow().isoformat()}}
    else:
        filepath = get_session_filepath(thread_id)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    session_data = json.load(f)
                # Append new messages to existing ones
                session_data["messages"].extend(messages)
                session_data["metadata"]["last_updated"] = datetime.datetime.utcnow().isoformat()
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error reading session file {thread_id}: {e}. Starting fresh.")
                # If file is corrupted or unreadable, overwrite with new messages
                session_data = {"thread_id": thread_id, "messages": messages, "metadata": {"last_updated": datetime.datetime.utcnow().isoformat()}}
        else:
             # If file doesn't exist for the given ID (unexpected case, but handle it)
             session_data = {"thread_id": thread_id, "messages": messages, "metadata": {"created_at": datetime.datetime.utcnow().isoformat()}}

    filepath = get_session_filepath(thread_id)
    try:
        with open(filepath, 'w') as f:
            json.dump(session_data, f, indent=2)
    except IOError as e:
        print(f"Error writing session file {thread_id}: {e}")
        raise # Re-raise the exception to signal failure

    return thread_id

def get_session(thread_id: str) -> Optional[Dict[str, Any]]:
    """Loads a chat session from its JSON file."""
    filepath = get_session_filepath(thread_id)
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
    try:
        for filename in os.listdir(HISTORY_DIR):
            if filename.endswith(".json"):
                thread_id = filename[:-5] # Remove .json extension
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
                except (json.JSONDecodeError, IOError, KeyError) as e:
                    print(f"Error reading or parsing session file {filename}: {e}. Skipping.")
                    continue # Skip corrupted files
        
        # Sort sessions, e.g., by last updated descending (most recent first)
        sessions_list.sort(key=lambda x: x.get("last_updated") or x.get("created_at") or '', reverse=True)

    except OSError as e:
        print(f"Error listing directory {HISTORY_DIR}: {e}")
        return [] # Return empty list on error

    return sessions_list 