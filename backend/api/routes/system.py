from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.api.core.gpu_check import get_device_status
from backend.api.core.settings_manager import get_precision, set_precision, VALID_PRECISIONS

router = APIRouter()

@router.get("/device", tags=["System"])
def read_device_status():
    """Returns the current compute device status (CPU or CUDA GPU)."""
    return get_device_status()

@router.get("/get_precision", tags=["System"])
def read_precision():
    """Returns the current global precision setting (fp32 or fp16)."""
    return {"current_precision": get_precision()}

class PrecisionRequest(BaseModel):
    precision: str

@router.post("/set_precision", tags=["System"])
def update_precision(req: PrecisionRequest):
    """Sets the global precision setting. Accepts 'fp32' or 'fp16'."""
    if req.precision not in VALID_PRECISIONS:
        raise HTTPException(status_code=400, detail=f"Invalid precision '{req.precision}'. Must be one of {VALID_PRECISIONS}.")
    set_precision(req.precision)
    return {"status": "ok", "new_precision": get_precision()}