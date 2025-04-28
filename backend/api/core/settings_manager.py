'''Manages application-wide settings, currently focusing on model precision.'''

from typing import Literal

# Type alias for allowed precision values
PrecisionType = Literal["fp32", "fp16"]

# Global variable to store the current precision setting
_current_precision: PrecisionType = "fp32" # Default to fp32

VALID_PRECISIONS = {"fp32", "fp16"}

def set_precision(precision: str) -> None:
    """Sets the global model precision setting."""
    global _current_precision
    if precision not in VALID_PRECISIONS:
        raise ValueError(f"Invalid precision value '{precision}'. Must be one of {VALID_PRECISIONS}")
    _current_precision = precision # type: ignore
    print(f"Model precision set to: {_current_precision}") # Log the change

def get_precision() -> PrecisionType:
    """Gets the current global model precision setting."""
    return _current_precision 