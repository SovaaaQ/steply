from __future__ import annotations

from threading import Lock
from time import monotonic


_ATTEMPTS: dict[str, list[float]] = {}
_LOCK = Lock()


def is_rate_limited(key: str, *, limit: int, window_seconds: int) -> bool:
    now = monotonic()
    cutoff = now - window_seconds

    with _LOCK:
        attempts = [timestamp for timestamp in _ATTEMPTS.get(key, []) if timestamp >= cutoff]
        if len(attempts) >= limit:
            _ATTEMPTS[key] = attempts
            return True

        attempts.append(now)
        _ATTEMPTS[key] = attempts
        return False


def reset_rate_limits() -> None:
    with _LOCK:
        _ATTEMPTS.clear()
