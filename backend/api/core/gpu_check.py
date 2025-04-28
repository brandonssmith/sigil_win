import torch

def get_device_status() -> dict:
    """Checks for CUDA availability and returns device information."""
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        return {"device": "cuda", "device_name": device_name}
    else:
        return {"device": "cpu", "device_name": "CPU"} 