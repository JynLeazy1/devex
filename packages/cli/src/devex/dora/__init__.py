"""DORA event emission for the CLI."""

from devex.dora.emitter import (
    CollectorError,
    build_event,
    emit_to_collector,
    emit_to_stdout,
)

__all__ = ["CollectorError", "build_event", "emit_to_collector", "emit_to_stdout"]
