from __future__ import annotations

import ctypes
import platform
from pathlib import Path
from ctypes import wintypes
from functools import lru_cache


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", wintypes.DWORD * 3)]


def text_runs(text: str, language: str, width_px: int, height_px: int) -> list[tuple[int, int, int, int]]:
    pillow_runs = _pillow_text_runs(text, language, width_px, height_px)
    if pillow_runs:
        return pillow_runs
    if platform.system() != "Windows":
        return []
    lines, font_px = _fit_lines(text, language, width_px, height_px)
    return _render_lines_to_runs(tuple(lines), font_px, width_px, height_px, _font_for(language))


def _pillow_text_runs(text: str, language: str, width_px: int, height_px: int) -> list[tuple[int, int, int, int]]:
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return []

    lines, font_px = _fit_lines(text, language, width_px, height_px)
    font_path = _font_path_for(language)
    try:
        font = ImageFont.truetype(font_path, font_px) if font_path else ImageFont.load_default()
    except OSError:
        font = ImageFont.load_default()

    image = Image.new("L", (width_px, height_px), 255)
    draw = ImageDraw.Draw(image)
    line_height = max(1, int(font_px * 1.12))
    total_height = line_height * len(lines)
    y = max(0, int((height_px - total_height) / 2))
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        x = max(0, int((width_px - text_width) / 2))
        draw.text((x, y), line, fill=0, font=font)
        y += line_height

    return _merge_vertical_runs(_image_to_row_runs(image, width_px, height_px))


def _fit_lines(text: str, language: str, width_px: int, height_px: int) -> tuple[list[str], int]:
    text = (text or "?").strip() or "?"
    if language == "chinese":
        return [text], max(12, int(height_px * (0.68 if len(text) <= 1 else 0.5)))
    max_lines = 2 if language == "pinyin" else 3
    start_size = int(height_px * (0.42 if language == "pinyin" else 0.34))
    min_size = max(10, int(height_px * (0.16 if language == "pinyin" else 0.14)))
    for font_px in range(start_size, min_size - 1, -1):
        lines = _wrap_text(text, width_px, font_px, max_lines)
        if len(lines) * font_px * 1.18 <= height_px and max(_estimate_width(line, font_px) for line in lines) <= width_px:
            return lines, font_px
    return _wrap_text(text, width_px, min_size, max_lines), min_size


def _wrap_text(text: str, max_width: int, font_px: int, max_lines: int) -> list[str]:
    tokens = _tokens(text)
    lines: list[str] = []
    current = ""
    for token in tokens:
        candidate = f"{current} {token}".strip()
        if not current or _estimate_width(candidate, font_px) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = token
    if current:
        lines.append(current)
    if len(lines) <= max_lines:
        return lines
    kept = lines[:max_lines]
    overflow = " ".join(lines[max_lines - 1 :])
    kept[-1] = _ellipsize(overflow, max_width, font_px)
    return kept


def _tokens(text: str) -> list[str]:
    return text.replace("/", " / ").split()


def _estimate_width(text: str, font_px: int) -> float:
    units = 0.0
    for char in text:
        if char == " ":
            units += 0.28
        elif char == "/":
            units += 0.35
        elif char in "ilI.,'":
            units += 0.28
        elif char.lower() in "mw":
            units += 0.8
        elif "\u0400" <= char <= "\u052f":
            units += 0.68
        else:
            units += 0.58
    return units * font_px


def _ellipsize(text: str, max_width: int, font_px: int) -> str:
    value = text.strip()
    while len(value) > 1 and _estimate_width(value + "...", font_px) > max_width:
        value = value[:-1].rstrip()
    return value + "..."


def _font_for(language: str) -> str:
    if language == "chinese":
        return "Microsoft YaHei"
    if language in ("target", "hungarian"):
        return "Arial"
    return "Arial"


def _font_path_for(language: str) -> str | None:
    if language == "chinese":
        candidates = [
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


@lru_cache(maxsize=2048)
def _render_lines_to_runs(lines: tuple[str, ...], font_px: int, width_px: int, height_px: int, font_name: str) -> list[tuple[int, int, int, int]]:
    gdi = ctypes.windll.gdi32
    user = ctypes.windll.user32

    bmi = BITMAPINFO()
    bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.bmiHeader.biWidth = width_px
    bmi.bmiHeader.biHeight = -height_px
    bmi.bmiHeader.biPlanes = 1
    bmi.bmiHeader.biBitCount = 32
    bmi.bmiHeader.biCompression = 0

    bits = ctypes.c_void_p()
    hdc = gdi.CreateCompatibleDC(0)
    hbmp = gdi.CreateDIBSection(hdc, ctypes.byref(bmi), 0, ctypes.byref(bits), None, 0)
    old_bitmap = gdi.SelectObject(hdc, hbmp)

    white = 0x00FFFFFF
    black = 0x00000000
    gdi.SetBkColor(hdc, white)
    gdi.SetTextColor(hdc, black)
    gdi.PatBlt(hdc, 0, 0, width_px, height_px, 0x00F00021)

    font = gdi.CreateFontW(font_px, 0, 0, 0, 700, 0, 0, 0, 1, 0, 0, 4, 0, font_name)
    old_font = gdi.SelectObject(hdc, font)

    line_height = max(1, int(font_px * 1.12))
    total_height = line_height * len(lines)
    y = max(0, int((height_px - total_height) / 2))
    for line in lines:
        rect = wintypes.RECT(0, y, width_px, y + line_height)
        user.DrawTextW(hdc, line, -1, ctypes.byref(rect), 0x00000001 | 0x00000004 | 0x00000020)
        y += line_height

    runs: list[tuple[int, int, int, int]] = []
    buffer = (ctypes.c_ubyte * (width_px * height_px * 4)).from_address(bits.value)
    for row in range(height_px):
        start: int | None = None
        for col in range(width_px):
            offset = (row * width_px + col) * 4
            blue, green, red = buffer[offset], buffer[offset + 1], buffer[offset + 2]
            ink = red < 190 or green < 190 or blue < 190
            if ink and start is None:
                start = col
            elif not ink and start is not None:
                runs.append((start, row, col - start, 1))
                start = None
        if start is not None:
            runs.append((start, row, width_px - start, 1))

    gdi.SelectObject(hdc, old_font)
    gdi.SelectObject(hdc, old_bitmap)
    gdi.DeleteObject(font)
    gdi.DeleteObject(hbmp)
    gdi.DeleteDC(hdc)
    return _merge_vertical_runs(runs)


def _image_to_row_runs(image: object, width_px: int, height_px: int) -> list[tuple[int, int, int, int]]:
    pixels = image.load()
    runs: list[tuple[int, int, int, int]] = []
    for row in range(height_px):
        start: int | None = None
        for col in range(width_px):
            ink = pixels[col, row] < 190
            if ink and start is None:
                start = col
            elif not ink and start is not None:
                runs.append((start, row, col - start, 1))
                start = None
        if start is not None:
            runs.append((start, row, width_px - start, 1))
    return runs


def _merge_vertical_runs(runs: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int, int]]:
    active: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    merged: list[tuple[int, int, int, int]] = []
    for x, y, w, h in runs:
        key = (x, w)
        previous = active.get(key)
        if previous and previous[1] + previous[3] == y:
            active[key] = (previous[0], previous[1], previous[2], previous[3] + h)
        else:
            if previous:
                merged.append(previous)
            active[key] = (x, y, w, h)
        for other_key in list(active):
            if other_key != key and active[other_key][1] + active[other_key][3] < y:
                merged.append(active.pop(other_key))
    merged.extend(active.values())
    merged.sort(key=lambda item: (item[1], item[0], item[2], item[3]))
    return merged
