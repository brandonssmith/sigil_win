"""Deprecated settings manager. Use :pymod:`backend.api.core.config` instead."""

from typing import Literal

# Re-export from the new central config for backward-compatibility.

from .config import settings, PrecisionType  # noqa: F401  (re-export)

VALID_PRECISIONS = {"fp32", "fp16"}


def get_precision() -> PrecisionType:  # type: ignore[override]
    """Return the globally configured model precision.

    This function remains for legacy imports but simply proxies to
    :pydataattr:`backend.api.core.config.settings.model_precision`.
    """

    return settings.model_precision  # type: ignore


def set_precision(precision: str) -> None:
    """Update the model precision at runtime.

    NOTE: This only mutates the in-memory :pyclass:`settings` instance. If you
    need this change to persist across process restarts you should set the
    corresponding environment variable (e.g. ``SIGIL_MODEL_PRECISION``) or
    update your `.env` file.
    """

    if precision not in VALID_PRECISIONS:
        raise ValueError(
            f"Invalid precision value '{precision}'. Must be one of {VALID_PRECISIONS}"
        )

    # pydantic BaseSettings instances are immutable by default, so we have to
    # use object.__setattr__ to mutate it at runtime.
    object.__setattr__(settings, "model_precision", precision)
    print(f"Model precision (runtime) set to: {settings.model_precision}")

# Keep the original name available for internal logic expecting it
# (e.g. torch dtype checks)
_current_precision = settings.model_precision 