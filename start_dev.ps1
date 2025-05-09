# Ensure the script is run from the project root
if (-not (Test-Path "backend/api/main.py") -or -not (Test-Path "frontend")) {
    Write-Error "Error: This script must be run from the project root directory containing 'frontend' and 'backend/api'"
    exit 1
}

# --- Configuration ---
$PROJECT_ROOT = $PSScriptRoot  # Path to the directory containing this script
$PYTHON_CMD = Join-Path $PROJECT_ROOT "venv\Scripts\python.exe"  # Windows path to Python in venv

# If the venv interpreter is not found, fall back to system Python
if (-not (Test-Path $PYTHON_CMD)) {
    Write-Warning "Warning: Virtual environment python '$PYTHON_CMD' not found."
    $PYTHON_CMD = (Get-Command python -ErrorAction SilentlyContinue).Source
    if ($null -eq $PYTHON_CMD) {
        Write-Error "Error: No usable Python interpreter found. Please create a virtual environment with 'python -m venv venv' in the project root or ensure python is on your PATH."
        exit 1
    }
    Write-Host "Falling back to system python: $PYTHON_CMD"
}

$FRONTEND_DIR = "frontend"
$BACKEND_HOST = "127.0.0.1"
$BACKEND_PORT = 8000
$BACKEND_LOG_FILE = "backend_api.log"

# --- Global Process Variables ---
$frontendProcess = $null
$backendProcess = $null

# --- Cleanup Function ---
function Cleanup {
    Write-Host "Cleaning up..."
    
    if ($frontendProcess -ne $null) {
        Write-Host "Stopping frontend..."
        Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    if ($backendProcess -ne $null) {
        Write-Host "Stopping backend API..."
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "Cleanup finished."
}

# Register cleanup on script exit
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

# --- Start Backend API ---
Write-Host "Starting backend API server (uvicorn)..."
$backendProcess = Start-Process -FilePath $PYTHON_CMD -ArgumentList "-m uvicorn backend.api.main:app --host $BACKEND_HOST --port $BACKEND_PORT" -RedirectStandardOutput $BACKEND_LOG_FILE -PassThru -NoNewWindow

# Check if backend process started successfully
Start-Sleep -Seconds 2
if ($backendProcess.HasExited) {
    Write-Error "Error: Failed to start backend API server or it exited immediately."
    Write-Host "Check logs in $BACKEND_LOG_FILE"
    exit 1
}

Write-Host "Backend API server started (PID: $($backendProcess.Id)). Logs in $BACKEND_LOG_FILE"

# --- Start Frontend ---
Write-Host "Starting frontend dev server..."
Set-Location $FRONTEND_DIR

# Ensure dependencies are installed
Write-Host "Checking/installing frontend dependencies (npm install)..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: npm install failed. Please check for errors."
    exit 1
}

# Start npm run dev using cmd.exe
Write-Host "Starting frontend with npm run dev..."
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -PassThru -NoNewWindow

Set-Location ..  # Go back to project root

# Check if frontend process started successfully
Start-Sleep -Seconds 2
if ($frontendProcess.HasExited) {
    Write-Error "Error: Failed to start 'npm run dev' or it exited immediately."
    exit 1
}

Write-Host "Frontend started successfully (PID: $($frontendProcess.Id))."

# --- Wait ---
Write-Host "Backend API and Frontend are running. Press Ctrl+C to stop."
try {
    Wait-Process -Id $backendProcess.Id, $frontendProcess.Id
} catch {
    Write-Host "A process finished or was interrupted."
} 