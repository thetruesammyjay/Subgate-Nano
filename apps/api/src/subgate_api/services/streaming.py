from datetime import UTC, datetime
from math import ceil


def now_utc() -> datetime:
    return datetime.now(UTC)


def metered_amount(rate_atomic_per_minute: int, elapsed_seconds: int) -> int:
    """Round up so each billed second is represented in whole USDC atomic units."""
    return ceil(rate_atomic_per_minute * elapsed_seconds / 60)


def billable_seconds(previous_heartbeat: datetime, current_time: datetime, maximum_interval_seconds: int) -> int:
    """Derive usage from server timestamps and bound gaps from abandoned browser tabs."""
    if previous_heartbeat.tzinfo is None:
        previous_heartbeat = previous_heartbeat.replace(tzinfo=UTC)
    elapsed = int((current_time - previous_heartbeat).total_seconds())
    return max(0, min(elapsed, maximum_interval_seconds))
