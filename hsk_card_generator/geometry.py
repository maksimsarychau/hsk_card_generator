from __future__ import annotations

from dataclasses import dataclass, field
from math import sqrt

from hsk_card_generator.layout import CardPosition
from hsk_card_generator.models import CardDesign, Language, WordEntry
from hsk_card_generator.text_raster import text_runs


Vector = tuple[float, float, float]
Face = tuple[int, int, int]


ROLE_COLORS: dict[str, str] = {
    "base": "#ffffff",
    "frontText": "#111111",
    "backNumber": "#777777",
    "border": "#f2b600",
    "hanziGuide": "#dd3b2a",
    "divider": "#f2b600",
    "doubleMarker": "#d9a000",
    "plateLabel": "#444444",
}


SURFACE_EMBED_MM = 0.03
CHINESE_RASTER_PX = 192


@dataclass
class Mesh:
    name: str
    vertices: list[Vector] = field(default_factory=list)
    faces: list[Face] = field(default_factory=list)

    def add(self, other: "Mesh") -> None:
        offset = len(self.vertices)
        self.vertices.extend(other.vertices)
        self.faces.extend((a + offset, b + offset, c + offset) for a, b, c in other.faces)

    def transformed(self, name: str, dx: float = 0, dy: float = 0, dz: float = 0) -> "Mesh":
        return Mesh(name, [(x + dx, y + dy, z + dz) for x, y, z in self.vertices], list(self.faces))


@dataclass
class Part:
    name: str
    role: str
    mesh: Mesh
    language: str
    page: int
    card_index: int | None = None


def cuboid(name: str, x: float, y: float, z: float, width: float, depth: float, height: float) -> Mesh:
    if width <= 0 or depth <= 0 or height <= 0:
        return Mesh(name)
    x0, x1 = x, x + width
    y0, y1 = y, y + depth
    z0, z1 = z, z + height
    vertices: list[Vector] = [
        (x0, y0, z0),
        (x1, y0, z0),
        (x1, y1, z0),
        (x0, y1, z0),
        (x0, y0, z1),
        (x1, y0, z1),
        (x1, y1, z1),
        (x0, y1, z1),
    ]
    faces: list[Face] = [
        (0, 2, 1),
        (0, 3, 2),
        (4, 5, 6),
        (4, 6, 7),
        (0, 1, 5),
        (0, 5, 4),
        (1, 2, 6),
        (1, 6, 5),
        (2, 3, 7),
        (2, 7, 6),
        (3, 0, 4),
        (3, 4, 7),
    ]
    return Mesh(name, vertices, faces)


def _corner_radius(design: CardDesign, w: float, h: float) -> float:
    return min(max(0, design.cornerRadiusMm), w / 2, h / 2)


def _rounded_cuboid(
    name: str,
    x: float,
    y: float,
    z: float,
    width: float,
    depth: float,
    height: float,
    clip_x: float,
    clip_y: float,
    clip_w: float,
    clip_h: float,
    radius: float,
) -> list[Mesh]:
    if radius <= 0:
        return [cuboid(name, x, y, z, width, depth, height)]
    x0 = max(x, clip_x)
    x1 = min(x + width, clip_x + clip_w)
    y0 = max(y, clip_y)
    y1 = min(y + depth, clip_y + clip_h)
    if x1 <= x0 or y1 <= y0:
        return []

    bands = _rounded_y_bands(y0, y1, clip_y, clip_h, radius)
    meshes: list[Mesh] = []
    for i, (band_y0, band_y1) in enumerate(zip(bands, bands[1:])):
        if band_y1 <= band_y0:
            continue
        mid_y = (band_y0 + band_y1) / 2
        interval = _rounded_rect_x_interval(clip_x, clip_y, clip_w, clip_h, radius, mid_y)
        if interval is None:
            continue
        allowed_x0, allowed_x1 = interval
        piece_x0 = max(x0, allowed_x0)
        piece_x1 = min(x1, allowed_x1)
        if piece_x1 > piece_x0:
            meshes.append(cuboid(f"{name}_round_{i}", piece_x0, band_y0, z, piece_x1 - piece_x0, band_y1 - band_y0, height))
    return meshes


def _rounded_border_meshes(name: str, x: float, y: float, z: float, w: float, h: float, border_w: float, height: float, radius: float) -> list[Mesh]:
    if radius <= 0:
        return [
            cuboid(f"{name}_top", x, y, z, w, border_w, height),
            cuboid(f"{name}_bottom", x, y + h - border_w, z, w, border_w, height),
            cuboid(f"{name}_left", x, y, z, border_w, h, height),
            cuboid(f"{name}_right", x + w - border_w, y, z, border_w, h, height),
        ]

    inner_x = x + border_w
    inner_y = y + border_w
    inner_w = max(0, w - border_w * 2)
    inner_h = max(0, h - border_w * 2)
    inner_radius = max(0, radius - border_w)
    bands = _rounded_y_bands(y, y + h, y, h, radius)
    bands.extend(_rounded_y_bands(inner_y, inner_y + inner_h, inner_y, inner_h, inner_radius))
    bands = sorted({round(value, 6) for value in bands})
    meshes: list[Mesh] = []
    piece = 0
    for band_y0, band_y1 in zip(bands, bands[1:]):
        if band_y1 <= band_y0:
            continue
        mid_y = (band_y0 + band_y1) / 2
        outer = _rounded_rect_x_interval(x, y, w, h, radius, mid_y)
        if outer is None:
            continue
        inner = _rounded_rect_x_interval(inner_x, inner_y, inner_w, inner_h, inner_radius, mid_y)
        intervals = [outer] if inner is None else [(outer[0], min(inner[0], outer[1])), (max(inner[1], outer[0]), outer[1])]
        for start, end in intervals:
            if end <= start:
                continue
            meshes.append(cuboid(f"{name}_{piece:03d}", start, band_y0, z, end - start, band_y1 - band_y0, height))
            piece += 1
    return meshes


def _rounded_y_bands(y0: float, y1: float, rect_y: float, rect_h: float, radius: float) -> list[float]:
    bands = {y0, y1, rect_y, rect_y + rect_h}
    if radius <= 0:
        return sorted(value for value in bands if y0 <= value <= y1)
    segments = 18
    for i in range(segments + 1):
        offset = radius * i / segments
        bands.add(rect_y + offset)
        bands.add(rect_y + rect_h - offset)
    return sorted(value for value in bands if y0 <= value <= y1)


def _rounded_rect_x_interval(x: float, y: float, w: float, h: float, radius: float, sample_y: float) -> tuple[float, float] | None:
    if w <= 0 or h <= 0 or sample_y < y or sample_y > y + h:
        return None
    radius = min(max(0, radius), w / 2, h / 2)
    if radius <= 0 or y + radius <= sample_y <= y + h - radius:
        return x, x + w
    center_y = y + radius if sample_y < y + radius else y + h - radius
    dy = abs(sample_y - center_y)
    chord = sqrt(max(0, radius * radius - dy * dy))
    inset = radius - chord
    return x + inset, x + w - inset


def merge_meshes(name: str, meshes: list[Mesh]) -> Mesh:
    merged = Mesh(name)
    for mesh in meshes:
        merged.add(mesh)
    return merged


def build_card_parts(
    word: WordEntry,
    language: Language,
    position: CardPosition,
    design: CardDesign,
) -> list[Part]:
    x, y = position.x, position.y
    w, h = position.width, position.height
    t = design.thicknessMm
    z_top = t
    surface_z = max(0, z_top - SURFACE_EMBED_MM)
    guide_z = surface_z
    text_z = surface_z
    base_meshes = _base_meshes(word.index, x, y, w, h, t, design)
    front_text_meshes = _front_text_proxy(word, language, x, y, text_z, w, h, design)
    hanzi_guide_meshes = _hanzi_guide_meshes(word.index, language, x, y, guide_z, w, h, design, word.text_for(language))
    if hanzi_guide_meshes and front_text_meshes:
        hanzi_guide_meshes = _subtract_footprints(hanzi_guide_meshes, front_text_meshes, clearance=0.08 * _card_scale(w, h))
    role_meshes: dict[str, list[Mesh]] = {
        "base": base_meshes,
        "border": _border_meshes(word.index, x, y, surface_z, w, h, design),
        "frontText": front_text_meshes,
        "backNumber": _back_number_meshes(word.index, x, y, w, h, design) if design.backNumberMode == "deboss_colored" else [],
        "hanziGuide": hanzi_guide_meshes,
    }
    parts: list[Part] = []
    for role, meshes in role_meshes.items():
        if not meshes:
            continue
        mesh = merge_meshes(f"{language}_{word.index:03d}_{role}", meshes)
        parts.append(Part(mesh.name, role, mesh, language, position.page, word.index))
    return parts


def build_game_card_parts(
    card_id: int,
    back_id: int,
    language: str,
    text: str,
    deck_name: str,
    position: CardPosition,
    design: CardDesign,
    overrides: dict | None = None,
) -> list[Part]:
    x, y = position.x, position.y
    w, h = position.width, position.height
    t = design.thicknessMm
    surface_z = max(0, t - SURFACE_EMBED_MM)
    text_value = str(text or "?").strip() or "?"
    text_meshes = _text_value_meshes(f"{deck_name}_{card_id:03d}_{language}", text_value, language, x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.7, surface_z, design, overrides)
    role_meshes: dict[str, list[Mesh]] = {
        "base": _base_meshes(back_id, x, y, w, h, t, design),
        "border": _border_meshes(card_id, x, y, surface_z, w, h, design),
        "frontText": text_meshes,
        "hanziGuide": _hanzi_guide_meshes(card_id, language, x, y, surface_z, w, h, design, text_value),
    }
    parts: list[Part] = []
    for role, meshes in role_meshes.items():
        if not meshes:
            continue
        mesh = merge_meshes(f"{deck_name}_{card_id:03d}_{role}", meshes)
        parts.append(Part(mesh.name, role, mesh, deck_name, position.page, card_id))
    return parts


def _base_meshes(index: int, x: float, y: float, w: float, h: float, thickness: float, design: CardDesign) -> list[Mesh]:
    slots = _back_number_rects(index, x, y, w, h, design)
    return _base_meshes_from_slots(index, x, y, w, h, thickness, design, slots)


def _base_meshes_from_slots(
    index: int,
    x: float,
    y: float,
    w: float,
    h: float,
    thickness: float,
    design: CardDesign,
    slots: list[tuple[float, float, float, float]],
) -> list[Mesh]:
    recess_depth = min(max(0.05, design.backNumberDepthMm), max(0.05, thickness - 0.05))
    radius = _corner_radius(design, w, h)
    if not slots or recess_depth <= 0:
        return _rounded_cuboid(f"card_{index:03d}_base", x, y, 0, w, h, thickness, x, y, w, h, radius)

    meshes: list[Mesh] = []
    meshes.extend(
        _rounded_cuboid(
            f"card_{index:03d}_base_above_deboss",
            x,
            y,
            recess_depth,
            w,
            h,
            thickness - recess_depth,
            x,
            y,
            w,
            h,
            radius,
        )
    )
    bands = sorted({y, y + h, *[sy for _, sy, _, _ in slots], *[sy + sd for _, sy, _, sd in slots]})
    for band_index, (y0, y1) in enumerate(zip(bands, bands[1:])):
        if y1 <= y0:
            continue
        intervals = [(sx, sx + sw) for sx, sy, sw, sd in slots if sy < y1 and sy + sd > y0]
        intervals.sort()
        cursor = x
        segment = 0
        for start, end in intervals:
            start = max(x, start)
            end = min(x + w, end)
            if start > cursor:
                meshes.extend(
                    _rounded_cuboid(
                        f"card_{index:03d}_base_deboss_band_{band_index}_{segment}",
                        cursor,
                        y0,
                        0,
                        start - cursor,
                        y1 - y0,
                        recess_depth,
                        x,
                        y,
                        w,
                        h,
                        radius,
                    )
                )
                segment += 1
            cursor = max(cursor, end)
        if cursor < x + w:
            meshes.extend(
                _rounded_cuboid(
                    f"card_{index:03d}_base_deboss_band_{band_index}_{segment}",
                    cursor,
                    y0,
                    0,
                    x + w - cursor,
                    y1 - y0,
                    recess_depth,
                    x,
                    y,
                    w,
                    h,
                    radius,
                )
            )
    return meshes


def build_domino_tile_parts(tile, position: CardPosition, design: CardDesign) -> list[Part]:
    x, y = position.x, position.y
    w, h = position.width, position.height
    t = design.thicknessMm
    surface_z = max(0, t - SURFACE_EMBED_MM)
    half_gap = max(0.35, design.borderWidthMm * 0.45)
    half_w = (w - half_gap) / 2
    left_box = (x + design.borderWidthMm * 1.0, y + h * 0.13, half_w - design.borderWidthMm * 1.55, h * 0.74)
    right_box = (x + half_w + half_gap + design.borderWidthMm * 0.55, y + h * 0.13, half_w - design.borderWidthMm * 1.55, h * 0.74)
    slots = _domino_back_number_rects(tile, x, y, w, h, design)
    role_meshes: dict[str, list[Mesh]] = {
        "base": _base_meshes_from_slots(tile.cardId, x, y, w, h, t, design, slots),
        "border": _border_meshes(tile.cardId, x, y, surface_z, w, h, design),
        "divider": _divider_meshes(tile, x, y, surface_z, w, h, design),
        "frontText": [
            *_text_value_meshes(f"domino_{tile.cardId:03d}_left", tile.left.text, tile.left.languageCode, *left_box, surface_z, design, getattr(tile.left, "overrides", None)),
            *_text_value_meshes(f"domino_{tile.cardId:03d}_right", tile.right.text, tile.right.languageCode, *right_box, surface_z, design, getattr(tile.right, "overrides", None)),
        ],
        "backNumber": _domino_back_number_meshes(tile, x, y, w, h, design) if design.backNumberMode == "deboss_colored" else [],
        "doubleMarker": _double_marker_meshes(tile, x, y, surface_z, w, h, design) if tile.tileType == "double" else [],
    }
    parts: list[Part] = []
    for role, meshes in role_meshes.items():
        if not meshes:
            continue
        mesh = merge_meshes(f"domino_{tile.cardId:03d}_{role}", meshes)
        parts.append(Part(mesh.name, role, mesh, "domino", position.page, tile.cardId))
    return parts


def build_plate_label_part(text: str, language: str, page: int, x: float, y: float, z: float, width: float, height: float, label_height: float) -> Part | None:
    if not text.strip() or width <= 0 or height <= 0:
        return None
    design = CardDesign(widthMm=width, heightMm=height, textHeightMm=label_height, hanziGuideMode="none")
    meshes = _text_value_meshes(f"{language}_page_{page + 1:02d}_plate_label", text, "english", x, y, width, height, z, design)
    if not meshes:
        return None
    mesh = merge_meshes(f"{language}_page_{page + 1:02d}_plateLabel", meshes)
    return Part(mesh.name, "plateLabel", mesh, language, page)


def _text_value_meshes(
    name: str,
    text: str,
    language: str,
    x: float,
    y: float,
    w: float,
    h: float,
    z: float,
    design: CardDesign,
    overrides: dict | None = None,
) -> list[Mesh]:
    text = _apply_line_char_limit(str(text or "?").strip() or "?", language, design, overrides)
    if design.textRenderMode == "proxy_blocks":
        fake = _fake_word_for_text(text, language, overrides)
        return _fallback_text_proxy(fake, language, x, y, z, w, h, design)
    fine = design.textRenderMode == "raster_fine"
    px = (256 if fine else CHINESE_RASTER_PX) if language == "chinese" else (192 if fine else 128)
    py = (256 if fine else CHINESE_RASTER_PX) if language == "chinese" else (144 if fine else 96)
    runs = text_runs(text, language, px, py, _max_lines(language, design, overrides))
    if not runs:
        fake = _fake_word_for_text(text, language, overrides)
        return _fallback_text_proxy(fake, language, x, y, z, w, h, design)
    min_rx = min(rx for rx, _, _, _ in runs)
    max_rx = max(rx + rw for rx, _, rw, _ in runs)
    min_ry = min(ry for _, ry, _, _ in runs)
    max_ry = max(ry + rh for _, ry, _, rh in runs)
    text_scale = _text_scale(language, design, overrides=overrides)
    scale = min(w / max(1, max_rx - min_rx), h / max(1, max_ry - min_ry)) * text_scale
    scale_x = scale
    scale_y = scale
    ink_w = (max_rx - min_rx) * scale
    ink_h = (max_ry - min_ry) * scale
    offset_x = x + (w - ink_w) / 2
    offset_y = y + (h - ink_h) / 2
    meshes: list[Mesh] = []
    for i, (rx, ry, rw, rh) in enumerate(runs):
        block_w = max(0.03, rw * scale_x)
        block_h = max(0.03, rh * scale_y)
        meshes.append(
            cuboid(
                f"{name}_text_{i:04d}",
                offset_x + (rx - min_rx) * scale_x,
                offset_y + ink_h - ((ry - min_ry) * scale_y) - block_h,
                z,
                block_w,
                block_h,
                _raised_height(design.textHeightMm),
            )
        )
    return meshes


def _divider_meshes(tile, x: float, y: float, z: float, w: float, h: float, design: CardDesign) -> list[Mesh]:
    divider_w = max(0.45, design.borderWidthMm * (1.1 if tile.tileType == "double" else 0.7))
    height = _raised_height(design.borderHeightMm)
    return [cuboid(f"domino_{tile.cardId:03d}_divider", x + w / 2 - divider_w / 2, y + design.borderWidthMm * 1.2, z, divider_w, h - design.borderWidthMm * 2.4, height)]


def _double_marker_meshes(tile, x: float, y: float, z: float, w: float, h: float, design: CardDesign) -> list[Mesh]:
    marker_w = max(1.2, min(w, h) * 0.08)
    height = _raised_height(design.borderHeightMm * 1.1)
    return [
        cuboid(f"domino_{tile.cardId:03d}_double_marker_h", x + w / 2 - marker_w * 1.2, y + h / 2 - marker_w / 2, z, marker_w * 2.4, marker_w, height),
        cuboid(f"domino_{tile.cardId:03d}_double_marker_v", x + w / 2 - marker_w / 2, y + h / 2 - marker_w * 1.2, z, marker_w, marker_w * 2.4, height),
    ]


def _domino_back_number_rects(tile, x: float, y: float, w: float, h: float, design: CardDesign) -> list[tuple[float, float, float, float]]:
    half_w = w / 2
    left = _back_number_rects(tile.backIds[0], x, y, half_w, h, design)
    right = _back_number_rects(tile.backIds[1], x + half_w, y, half_w, h, design)
    return left + right


def _domino_back_number_meshes(tile, x: float, y: float, w: float, h: float, design: CardDesign) -> list[Mesh]:
    insert_height = max(0.05, design.backNumberDepthMm)
    return [cuboid(f"domino_back_{tile.cardId:03d}_{i:02d}", sx, sy, 0, sw, sd, insert_height) for i, (sx, sy, sw, sd) in enumerate(_domino_back_number_rects(tile, x, y, w, h, design))]


def _border_meshes(index: int, x: float, y: float, z: float, w: float, h: float, design: CardDesign) -> list[Mesh]:
    bw = max(0.2, design.borderWidthMm)
    bh = _raised_height(design.borderHeightMm)
    return _rounded_border_meshes(f"card_{index:03d}_border", x, y, z, w, h, bw, bh, _corner_radius(design, w, h))


def _front_text_proxy(
    word: WordEntry,
    language: Language,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    design: CardDesign,
) -> list[Mesh]:
    text = _apply_line_char_limit(word.text_for(language).strip() or "?", language, design, _word_overrides(word, language))
    text_scale = _text_scale(language, design, word)
    if design.textRenderMode == "proxy_blocks":
        return _fallback_text_proxy(word, language, x, y, z, w, h, design)
    if language == "chinese":
        chars = _cjk_chars(text)
        if 1 < len(chars) <= 3:
            return _multi_hanzi_text_meshes(
                word.index,
                chars,
                _hanzi_cell_boxes(x, y, w, h, design, len(chars)),
                z,
                design,
                text_scale,
                fine=design.textRenderMode == "raster_fine",
            )
    inset_x = w * (0.12 if language == "chinese" else 0.1)
    inset_y = h * (0.14 if language == "chinese" else 0.18)
    area_x, area_y = x + inset_x, y + inset_y
    area_w, area_h = w - inset_x * 2, h - inset_y * 2
    if design.textRenderMode == "proxy_blocks":
        return _fallback_text_proxy(word, language, x, y, z, w, h, design)
    fine = design.textRenderMode == "raster_fine"
    px = (256 if fine else CHINESE_RASTER_PX) if language == "chinese" else (192 if fine else 128)
    py = (256 if fine else CHINESE_RASTER_PX) if language == "chinese" else (144 if fine else 96)
    runs = text_runs(text, language, px, py, _max_lines(language, design, _word_overrides(word, language)))
    if not runs:
        return _fallback_text_proxy(word, language, x, y, z, w, h, design)

    scale_x = area_w / px * text_scale
    scale_y = area_h / py * text_scale
    min_rx = min(rx for rx, _, _, _ in runs)
    max_rx = max(rx + rw for rx, _, rw, _ in runs)
    min_ry = min(ry for _, ry, _, _ in runs)
    max_ry = max(ry + rh for _, ry, _, rh in runs)
    ink_w = (max_rx - min_rx) * scale_x
    ink_h = (max_ry - min_ry) * scale_y
    offset_x = area_x + (area_w - ink_w) / 2
    offset_y = area_y + (area_h - ink_h) / 2
    meshes: list[Mesh] = []
    for i, (rx, ry, rw, rh) in enumerate(runs):
        block_w = max(0.03, rw * scale_x)
        block_h = max(0.03, rh * scale_y)
        meshes.append(
            cuboid(
                f"text_{word.index:03d}_{language}_{i:04d}",
                offset_x + (rx - min_rx) * scale_x,
                offset_y + ink_h - ((ry - min_ry) * scale_y) - block_h,
                z,
                block_w,
                block_h,
                _raised_height(design.textHeightMm),
            )
        )
    return meshes


def _multi_hanzi_text_meshes(
    index: int,
    chars: list[str],
    cells: list[tuple[float, float, float, float]],
    z: float,
    design: CardDesign,
    text_scale: float,
    fine: bool = False,
) -> list[Mesh]:
    meshes: list[Mesh] = []
    raster_px = 256 if fine else CHINESE_RASTER_PX
    fill = 0.68 if fine else 0.82
    for char_index, char in enumerate(chars):
        cell_x, cell_y, cell_w, cell_h = cells[char_index]
        runs = text_runs(char, "chinese", raster_px, raster_px)
        if not runs:
            continue
        min_rx = min(rx for rx, _, _, _ in runs)
        max_rx = max(rx + rw for rx, _, rw, _ in runs)
        min_ry = min(ry for _, ry, _, _ in runs)
        max_ry = max(ry + rh for _, ry, _, rh in runs)
        scale = min(cell_w * fill / max(1, max_rx - min_rx), cell_h * fill / max(1, max_ry - min_ry)) * text_scale
        ink_w = (max_rx - min_rx) * scale
        ink_h = (max_ry - min_ry) * scale
        offset_x = cell_x + (cell_w - ink_w) / 2
        offset_y = cell_y + (cell_h - ink_h) / 2
        for run_index, (rx, ry, rw, rh) in enumerate(runs):
            block_w = max(0.03, rw * scale)
            block_h = max(0.03, rh * scale)
            meshes.append(
                cuboid(
                    f"text_{index:03d}_chinese_{char_index}_{run_index:04d}",
                    offset_x + (rx - min_rx) * scale,
                    offset_y + ink_h - ((ry - min_ry) * scale) - block_h,
                    z,
                    block_w,
                    block_h,
                    _raised_height(design.textHeightMm),
                )
            )
    return meshes


def _fallback_text_proxy(
    word: WordEntry,
    language: Language,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    design: CardDesign,
) -> list[Mesh]:
    text = word.text_for(language).strip() or "?"
    line_count = 1 if language in ("chinese", "pinyin") or len(text) <= 14 else 2
    text_scale = _text_scale(language, design, word)
    max_text_w = w * (0.72 if language == "chinese" else 0.78) * min(1.8, text_scale)
    line_h = h * (0.16 if line_count == 2 else 0.2) * min(1.8, text_scale)
    proxy_h = _raised_height(design.textHeightMm)
    meshes: list[Mesh] = []
    for line in range(line_count):
        length_factor = min(1.0, max(0.22, len(text) / (4 if language == "chinese" else 18)))
        bar_w = max_text_w * length_factor
        bar_h = line_h
        bx = x + (w - bar_w) / 2
        by = y + (h - line_count * bar_h) / 2 + line * bar_h * 1.15
        meshes.append(cuboid(f"text_proxy_{word.index:03d}_{language}_{line}", bx, by, z, bar_w, bar_h, proxy_h))
    return meshes


def _hanzi_guide_cells(index: int, x: float, y: float, z: float, w: float, h: float, design: CardDesign, cells: int) -> list[Mesh]:
    guide_scale = max(0.2, design.hanziGuideScale)
    card_scale = _card_scale(w, h)
    line_w = max(0.28, 0.35 * card_scale) * guide_scale
    gh = _hanzi_guide_height(design, card_scale)
    cell_boxes = _hanzi_cell_boxes(x, y, w, h, design, cells)
    meshes: list[Mesh] = []
    for cell, (cx, y0, cell_w, gd) in enumerate(cell_boxes):
        meshes.extend(
            [
                cuboid(f"guide_{index:03d}_{cell}_vertical", cx + cell_w / 2 - line_w / 2, y0, z, line_w, gd, gh),
                cuboid(f"guide_{index:03d}_{cell}_horizontal", cx, y0 + gd / 2 - line_w / 2, z, cell_w, line_w, gh),
            ]
        )
        if design.hanziGuideMode == "mi_8":
            meshes.extend(_diagonal_proxy(index, cx, y0, z, cell_w, gd, line_w, gh, suffix=f"_{cell}"))
    return meshes


def _hanzi_cell_boxes(x: float, y: float, w: float, h: float, design: CardDesign, cells: int) -> list[tuple[float, float, float, float]]:
    cells = max(1, cells)
    guide_scale = max(0.2, design.hanziGuideScale)
    card_scale = _card_scale(w, h)
    inset = max(_scaled_inset(w, h), design.borderWidthMm + 0.3 * card_scale)
    x0, y0 = x + inset, y + inset
    gw, gd = w - inset * 2, h - inset * 2
    cell_gap = 0.8 * guide_scale * card_scale if cells > 1 else 0
    cell_w = (gw - cell_gap * (cells - 1)) / cells
    return [(x0 + cell * (cell_w + cell_gap), y0, cell_w, gd) for cell in range(cells)]


def _cjk_chars(text: str) -> list[str]:
    return [char for char in text if "\u3400" <= char <= "\u9fff"]


def _hanzi_guide_meshes(
    index: int,
    language: Language,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    design: CardDesign,
    text: str = "",
) -> list[Mesh]:
    if language != "chinese" or design.hanziGuideMode == "none":
        return []
    count = len(_cjk_chars(text))
    if count == 0:
        count = 1
    if count > 3:
        return []
    return _hanzi_guide_cells(index, x, y, z, w, h, design, count)


def _hanzi_guide_height(design: CardDesign, card_scale: float = 1.0) -> float:
    return max(0.16, design.borderHeightMm * 0.9 * card_scale) * max(0.2, design.hanziGuideScale) + SURFACE_EMBED_MM


def _raised_height(value: float) -> float:
    return max(0.05, value) + SURFACE_EMBED_MM


def _card_scale(w: float, h: float) -> float:
    return max(0.35, min(w, h) / 30)


def _scaled_inset(w: float, h: float) -> float:
    return max(1.2, min(w, h) * 0.073)


def _subtract_footprints(guide_meshes: list[Mesh], blockers: list[Mesh], clearance: float) -> list[Mesh]:
    blocker_rects = [_expanded_bbox_xy(mesh, clearance) for mesh in blockers if mesh.vertices]
    if not blocker_rects:
        return guide_meshes
    pieces: list[Mesh] = []
    for mesh in guide_meshes:
        pieces.extend(_subtract_rects_from_box_mesh(mesh, blocker_rects))
    return pieces


def _expanded_bbox_xy(mesh: Mesh, clearance: float) -> tuple[float, float, float, float]:
    xs = [x for x, _, _ in mesh.vertices]
    ys = [y for _, y, _ in mesh.vertices]
    return min(xs) - clearance, min(ys) - clearance, max(xs) + clearance, max(ys) + clearance


def _subtract_rects_from_box_mesh(mesh: Mesh, blockers: list[tuple[float, float, float, float]]) -> list[Mesh]:
    if not mesh.vertices:
        return []
    xs = [x for x, _, _ in mesh.vertices]
    ys = [y for _, y, _ in mesh.vertices]
    zs = [z for _, _, z in mesh.vertices]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    z0, z1 = min(zs), max(zs)
    clipped = [
        (max(x0, bx0), max(y0, by0), min(x1, bx1), min(y1, by1))
        for bx0, by0, bx1, by1 in blockers
        if bx0 < x1 and bx1 > x0 and by0 < y1 and by1 > y0
    ]
    clipped = [(bx0, by0, bx1, by1) for bx0, by0, bx1, by1 in clipped if bx1 > bx0 and by1 > by0]
    if not clipped:
        return [mesh]

    bands = sorted({y0, y1, *[by0 for _, by0, _, _ in clipped], *[by1 for _, _, _, by1 in clipped]})
    pieces: list[Mesh] = []
    piece_index = 0
    for band_y0, band_y1 in zip(bands, bands[1:]):
        if band_y1 <= band_y0:
            continue
        intervals = [(bx0, bx1) for bx0, by0, bx1, by1 in clipped if by0 < band_y1 and by1 > band_y0]
        intervals.sort()
        cursor = x0
        for start, end in intervals:
            start = max(x0, start)
            end = min(x1, end)
            if start > cursor:
                pieces.append(cuboid(f"{mesh.name}_cut_{piece_index}", cursor, band_y0, z0, start - cursor, band_y1 - band_y0, z1 - z0))
                piece_index += 1
            cursor = max(cursor, end)
        if cursor < x1:
            pieces.append(cuboid(f"{mesh.name}_cut_{piece_index}", cursor, band_y0, z0, x1 - cursor, band_y1 - band_y0, z1 - z0))
            piece_index += 1
    return pieces


def _fake_word_for_text(text: str, language: Language, overrides: dict | None = None) -> WordEntry:
    return WordEntry(
        1,
        text if language == "chinese" else "",
        text if language == "pinyin" else "",
        text if language == "english" else "",
        text if language == "target" else "",
        text if language == "hungarian" else "",
        overrides={language: overrides or {}} if overrides else {},
    )


def _text_scale(language: Language, design: CardDesign, word: WordEntry | None = None, overrides: dict | None = None) -> float:
    if language == "chinese":
        base = design.chineseTextScale
    elif language == "pinyin":
        base = design.pinyinTextScale
    elif language == "english":
        base = design.englishTextScale
    elif language == "hungarian":
        base = design.hungarianTextScale
    else:
        base = design.targetTextScale
    override = overrides if overrides is not None else _word_overrides(word, language)
    scale = _override_number(override, "scale", 1.0)
    return max(0.2, base * scale)


def _word_overrides(word: WordEntry | None, language: Language) -> dict:
    if not word:
        return {}
    overrides = getattr(word, "overrides", None) or {}
    value = overrides.get(language) if isinstance(overrides, dict) else None
    return value if isinstance(value, dict) else {}


def _override_number(overrides: dict | None, key: str, default: float) -> float:
    if not overrides:
        return default
    value = overrides.get(key)
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _override_int(overrides: dict | None, key: str, default: int) -> int:
    if not overrides:
        return default
    value = overrides.get(key)
    if value in (None, ""):
        return default
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return default


def _line_char_limit(language: Language, design: CardDesign, overrides: dict | None = None) -> int:
    if language == "pinyin":
        return max(2, _override_int(overrides, "lineChars", int(design.pinyinLineChars)))
    if language == "english":
        return max(2, _override_int(overrides, "lineChars", int(design.englishLineChars)))
    if language == "hungarian":
        return max(2, _override_int(overrides, "lineChars", int(design.hungarianLineChars)))
    if language == "target":
        return max(2, _override_int(overrides, "lineChars", int(design.targetLineChars)))
    return 0


def _max_lines(language: Language, design: CardDesign, overrides: dict | None = None) -> int:
    default = 2 if language == "pinyin" else 3
    return _override_int(overrides, "maxLines", default)


def _apply_line_char_limit(text: str, language: Language, design: CardDesign, overrides: dict | None = None) -> str:
    limit = _line_char_limit(language, design, overrides)
    if not limit:
        return text
    return "\n".join(_wrap_hard_line(line, limit) for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"))


def _wrap_hard_line(line: str, limit: int) -> str:
    normalized = " / ".join(part.strip() for part in line.split("/")).strip()
    if not normalized:
        return ""
    lines: list[str] = []
    current = ""
    for token in normalized.split():
        for chunk in _split_token(token, limit):
            candidate = f"{current} {chunk}".strip() if current else chunk
            if len(candidate) <= limit or not current:
                current = candidate
            else:
                lines.append(current)
                current = chunk
    if current:
        lines.append(current)
    return "\n".join(lines)


def _split_token(token: str, limit: int) -> list[str]:
    if len(token) <= limit:
        return [token]
    return [token[index : index + limit] for index in range(0, len(token), limit)]


def _diagonal_proxy(index: int, x: float, y: float, z: float, w: float, h: float, line_w: float, height: float, suffix: str = "") -> list[Mesh]:
    # Dependency-free spike approximation: use stepped blocks instead of rotated geometry.
    meshes: list[Mesh] = []
    steps = 12
    for i in range(steps):
        bx = x + i * w / steps
        by_a = y + i * h / steps
        by_b = y + h - (i + 1) * h / steps
        meshes.append(cuboid(f"guide_{index:03d}{suffix}_diag_a_{i}", bx, by_a, z, w / steps, line_w, height))
        meshes.append(cuboid(f"guide_{index:03d}{suffix}_diag_b_{i}", bx, by_b, z, w / steps, line_w, height))
    return meshes


SEGMENTS = {
    "0": "abcfed",
    "1": "bc",
    "2": "abged",
    "3": "abgcd",
    "4": "fgbc",
    "5": "afgcd",
    "6": "afgecd",
    "7": "abc",
    "8": "abcdefg",
    "9": "abfgcd",
}


def _back_number_meshes(index: int, x: float, y: float, w: float, h: float, design: CardDesign) -> list[Mesh]:
    rects = _back_number_rects(index, x, y, w, h, design)
    insert_height = max(0.05, design.backNumberDepthMm)
    return [cuboid(f"back_{index:03d}_{i:02d}", sx, sy, 0, sw, sd, insert_height) for i, (sx, sy, sw, sd) in enumerate(rects)]


def _back_number_rects(index: int, x: float, y: float, w: float, h: float, design: CardDesign) -> list[tuple[float, float, float, float]]:
    number = f"{index:02d}"
    digit_w = w * 0.16
    digit_h = h * 0.28
    spacing = digit_w * 0.25
    total_w = len(number) * digit_w + (len(number) - 1) * spacing
    start_x = x + (w - total_w) / 2
    base_y = y + h * 0.12
    rects: list[tuple[float, float, float, float]] = []
    for i, digit in enumerate(number):
        normal_x = start_x + i * (digit_w + spacing)
        rects.extend(_seven_segment_digit_rects(digit, normal_x, base_y, digit_w, digit_h, mirror_y=y + h / 2))
    return rects


def _seven_segment_digit_rects(digit: str, x: float, y: float, w: float, h: float, mirror_y: float | None = None) -> list[tuple[float, float, float, float]]:
    active = SEGMENTS.get(digit, "")
    th = max(0.35, w * 0.16)
    specs = {
        "a": (x + th, y + h - th, w - 2 * th, th),
        "b": (x + w - th, y + h / 2, th, h / 2 - th),
        "c": (x + w - th, y + th, th, h / 2 - th),
        "d": (x + th, y, w - 2 * th, th),
        "e": (x, y + th, th, h / 2 - th),
        "f": (x, y + h / 2, th, h / 2 - th),
        "g": (x + th, y + h / 2 - th / 2, w - 2 * th, th),
    }
    rects: list[tuple[float, float, float, float]] = []
    for seg, (sx, sy, sw, sd) in specs.items():
        if seg not in active:
            continue
        if mirror_y is not None:
            sy = mirror_y * 2 - (sy + sd)
        rects.append((sx, sy, sw, sd))
    return rects
