from __future__ import annotations

from datetime import date, datetime, time, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)
