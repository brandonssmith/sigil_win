import subprocess
import time
import sys
import os
import signal
import atexit
import requests
# import tkinter as tk                # Remove Tkinter
# from tkinter import filedialog     # Remove Tkinter

BACKEND_DIR = os.path.join(os.path.dirname(__file__), 'backend', 'api')
# MODEL_PATH_CONFIG_FILE = os.path.join(BACKEND_DIR, '.model_path.cfg') # Not using config file
BACKEND_SCRIPT = os.path.join(BACKEND_DIR, 'main.py')
BACKEND_HOST = "127.0.0.1" # Use 127.0.0.1 for local communication
BACKEND_PORT = 8000
BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
HEALTH_CHECK_URL = f"{BACKEND_URL}/health"

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'frontend')

backend_process = None

# Remove get_model_path_gui
# def get_model_path_gui():
#    ...

def prompt_for_model_path():
    """Prompts user for the model path via the command line."""
    while True:
        print("\nPlease enter the path to the directory containing your model files.")
        print("You can use an absolute path (e.g., /path/to/your/model)")
        print("or a path relative to the current directory ('.')")
        print(f"(e.g., ./models/my_llama or ../downloaded_models/model_v1)")
        print("The directory should contain files like .safetensors, config.json, etc.")
        try:
            user_path = input("Model directory path: ").strip()
            if not user_path:
                print("Error: Path cannot be empty.")
                continue

            # Expand ~ to user's home directory
            expanded_path = os.path.expanduser(user_path)

            # Check if the path (absolute or relative) points to a directory
            if os.path.isdir(expanded_path):
                # Return the potentially relative path as entered by the user,
                # after validation using the expanded path.
                # The backend process will resolve it relative to its CWD (BACKEND_DIR)
                # if it's relative, but we pass the user's input for clarity.
                # Actually, let's resolve it to absolute here for less ambiguity in backend.
                absolute_path = os.path.abspath(expanded_path)
                print(f"Using model directory: {absolute_path}")
                return absolute_path
            else:
                print(f"Error: '{expanded_path}' is not a valid directory.")
                print("Please check the path and try again.")

        except EOFError:
            print("\nOperation cancelled by user (EOF).")
            sys.exit(1)
        except KeyboardInterrupt:
             print("\nOperation cancelled by user (Ctrl+C).")
             sys.exit(1)

def start_backend(model_path):
    global backend_process
    print("Starting backend server...")
    # Ensure venv is activated. Assuming this script is run from an activated venv.
    python_executable = sys.executable # Get python executable from current venv

    # Pass the model path as an environment variable
    env = os.environ.copy()
    env['PROMETHEUS_MODEL_PATH'] = model_path

    backend_process = subprocess.Popen(
        [python_executable, "-m", "uvicorn", "main:app", "--host", BACKEND_HOST, "--port", str(BACKEND_PORT)],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE, # Capture stdout
        stderr=subprocess.PIPE, # Capture stderr
        env=env # Pass the modified environment
    )

    # Wait for backend to be ready
    max_wait = 30 # seconds
    start_time = time.time()
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(HEALTH_CHECK_URL, timeout=1)
            if response.status_code == 200:
                print("Backend server started successfully.")
                return True
        except requests.ConnectionError:
            pass # Backend not ready yet
        except requests.Timeout:
            pass # Health check timed out, try again
        time.sleep(0.5)

    print("Error: Backend server failed to start within the time limit.")
    # Print backend logs if it failed
    stdout, stderr = backend_process.communicate()
    print("--- Backend stdout ---")
    print(stdout.decode() if stdout else "(empty)")
    print("--- Backend stderr ---")
    print(stderr.decode() if stderr else "(empty)")
    stop_backend() # Clean up the failed process
    return False

def stop_backend():
    global backend_process
    if backend_process and backend_process.poll() is None: # Check if process exists and is running
        print("\nStopping backend server...")
        # Send SIGTERM (graceful shutdown) first
        backend_process.terminate()
        try:
            # Wait a bit for graceful shutdown
            backend_process.wait(timeout=5)
            print("Backend server stopped gracefully.")
        except subprocess.TimeoutExpired:
            # Force kill if it doesn't terminate
            print("Backend server did not stop gracefully, forcing kill...")
            backend_process.kill()
            backend_process.wait()
            print("Backend server killed.")
        backend_process = None
    elif backend_process:
        print("Backend server already stopped.")
        backend_process = None

def signal_handler(sig, frame):
    print("\nCtrl+C detected. Shutting down...")
    # stop_backend() is registered with atexit, so it should be called automatically
    # We just need to exit gracefully here
    sys.exit(0)

if __name__ == "__main__":
    # Get model path using CLI prompt
    model_directory_path = prompt_for_model_path()

    # Register cleanup function to run on exit (normal or error)
    atexit.register(stop_backend)

    # Register signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)

    if start_backend(model_directory_path): # Pass path to start_backend
        # Remove the call to run_frontend()
        # run_frontend()
        print("Backend server running. Start the frontend separately (cd frontend && npm run dev).")
        # Keep the backend running until interrupted (e.g., by Ctrl+C)
        # The backend process runs in the background, wait for it here
        # or simply let the script wait indefinitely.
        try:
            # Wait for the backend process indefinitely, or handle shutdown signals
            backend_process.wait()
        except KeyboardInterrupt: # Handle Ctrl+C in the main script as well
            print("\nMain script interrupted. Shutting down...")
            # stop_backend() is called by atexit
            sys.exit(0)
    else:
        print("Failed to start backend. Exiting.", file=sys.stderr)
        sys.exit(1)

    # The script will block on run_frontend() until the UI exits.
    # stop_backend() will be called automatically via atexit.
    # print("Frontend UI finished.") # Remove this line as well 