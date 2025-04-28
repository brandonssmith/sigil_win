from fastapi import APIRouter
from backend.api.core.gpu_check import get_device_status

router = APIRouter()

@router.get("/device", tags=["System"])
def read_device_status():
    """Returns the current compute device status (CPU or CUDA GPU)."""
    return get_device_status() 