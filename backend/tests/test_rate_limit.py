from app.core.rate_limit import is_rate_limited, reset_rate_limits


def test_rate_limit_allows_requests_until_limit() -> None:
    reset_rate_limits()

    assert not is_rate_limited("login:test@example.com", limit=2, window_seconds=60)
    assert not is_rate_limited("login:test@example.com", limit=2, window_seconds=60)
    assert is_rate_limited("login:test@example.com", limit=2, window_seconds=60)


def test_rate_limit_is_scoped_by_key() -> None:
    reset_rate_limits()

    assert not is_rate_limited("login:first@example.com", limit=1, window_seconds=60)
    assert not is_rate_limited("login:second@example.com", limit=1, window_seconds=60)
    assert is_rate_limited("login:first@example.com", limit=1, window_seconds=60)
