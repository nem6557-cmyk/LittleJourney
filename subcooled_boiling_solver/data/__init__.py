"""Experimental-data ingest and synthetic self-consistency data."""

from .loader import RunData, COLS, load_sheet, load_workbook, WorkbookSpec
from .synthetic import generate_run, generate_campaign, RunSpec

__all__ = [
    "RunData", "COLS", "load_sheet", "load_workbook", "WorkbookSpec",
    "generate_run", "generate_campaign", "RunSpec",
]
