from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from hsk_card_generator.models import CardDesign, PrinterProfile, WordEntry


@dataclass
class CardPosition:
    index: int
    page: int
    row: int
    column: int
    x: float
    y: float
    width: float
    height: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "page": self.page,
            "row": self.row,
            "column": self.column,
            "x": round(self.x, 4),
            "y": round(self.y, 4),
            "width": round(self.width, 4),
            "height": round(self.height, 4),
        }


def _auto_count(available: float, size: float, gap: float) -> int:
    if size <= 0:
        return 0
    return max(1, math.floor((available + gap) / (size + gap)))


def resolve_grid(printer: PrinterProfile, design: CardDesign) -> tuple[int, int]:
    available_w = max(0.0, printer.widthMm - printer.marginMm * 2)
    available_d = max(0.0, printer.depthMm - printer.marginMm * 2)
    auto_columns = _auto_count(available_w, design.widthMm, design.gapMm)
    auto_rows = _auto_count(available_d, design.heightMm, design.gapMm)
    columns = auto_columns if design.columns == "auto" else int(design.columns)
    rows = auto_rows if design.rows == "auto" else int(design.rows)
    return max(1, rows), max(1, columns)


def used_area(rows: int, columns: int, design: CardDesign) -> tuple[float, float]:
    width = columns * design.widthMm + max(0, columns - 1) * design.gapMm
    depth = rows * design.heightMm + max(0, rows - 1) * design.gapMm
    return width, depth


def compute_layout(words: list[WordEntry], printer: PrinterProfile, design: CardDesign) -> dict[str, Any]:
    return compute_index_layout([word.index for word in words], printer, design, words)


def compute_index_layout(indices: list[int], printer: PrinterProfile, design: CardDesign, words_for_warnings: list[WordEntry] | None = None) -> dict[str, Any]:
    rows, columns = resolve_grid(printer, design)
    used_w, used_d = used_area(rows, columns, design)
    capacity = max(1, rows * columns)
    pages = max(1, math.ceil(len(indices) / capacity))

    origin_x = printer.marginMm + max(0.0, (printer.widthMm - printer.marginMm * 2 - used_w) / 2)
    origin_y = printer.marginMm + max(0.0, (printer.depthMm - printer.marginMm * 2 - used_d) / 2)

    positions: list[CardPosition] = []
    for offset, index in enumerate(indices):
        page = offset // capacity
        local = offset % capacity
        row = local // columns
        column = local % columns
        positions.append(
            CardPosition(
                index=index,
                page=page,
                row=row,
                column=column,
                x=origin_x + column * (design.widthMm + design.gapMm),
                y=origin_y + row * (design.heightMm + design.gapMm),
                width=design.widthMm,
                height=design.heightMm,
            )
        )

    words = words_for_warnings or []
    warnings = validate_layout(words, printer, design, rows, columns, used_w, used_d, capacity)
    if len(indices) > capacity:
        warnings = [warning for warning in warnings if warning["code"] != "page_split"]
        warnings.append(
            {
                "severity": "info",
                "code": "page_split",
                "message": f"{len(indices)} cards split across {math.ceil(len(indices) / capacity)} physical pages at {capacity} cards/page.",
            }
        )
    return {
        "rows": rows,
        "columns": columns,
        "capacity": capacity,
        "pageCount": pages,
        "usedWidthMm": round(used_w, 4),
        "usedDepthMm": round(used_d, 4),
        "positions": [pos.to_dict() for pos in positions],
        "warnings": warnings,
        "valid": not any(w["severity"] == "error" for w in warnings),
    }


def validate_layout(
    words: list[WordEntry],
    printer: PrinterProfile,
    design: CardDesign,
    rows: int,
    columns: int,
    used_w: float,
    used_d: float,
    capacity: int,
) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    available_w = printer.widthMm - printer.marginMm * 2
    available_d = printer.depthMm - printer.marginMm * 2
    if used_w > available_w or used_d > available_d:
        warnings.append(
            {
                "severity": "error",
                "code": "layout_overflow",
                "message": f"Layout {used_w:.1f} x {used_d:.1f} mm exceeds printable area {available_w:.1f} x {available_d:.1f} mm.",
            }
        )
    if len(words) > capacity:
        warnings.append(
            {
                "severity": "info",
                "code": "page_split",
                "message": f"{len(words)} cards split across {math.ceil(len(words) / capacity)} physical pages at {capacity} cards/page.",
            }
        )
    if design.gapMm < 1.0:
        warnings.append(
            {
                "severity": "warning",
                "code": "small_gap",
                "message": "Gap is below 1 mm; cards may be hard to separate or inspect.",
            }
        )
    min_side = min(design.widthMm, design.heightMm)
    if min_side < 20:
        warnings.append(
            {
                "severity": "warning",
                "code": "small_card",
                "message": "Card side is below 20 mm; translations and Hanzi guides may become hard to read.",
            }
        )
    for word in words:
        for field_name, text in (("english", word.english), ("target", word.target), ("hungarian", word.hungarian)):
            if len(text) > 34:
                warnings.append(
                    {
                        "severity": "warning",
                        "code": "long_translation",
                        "message": f"Card {word.index} {field_name} text may need more than two lines.",
                    }
                )
                return warnings
    return warnings
