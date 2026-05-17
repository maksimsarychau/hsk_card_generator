from __future__ import annotations

import json
import math
import zipfile
from collections import defaultdict
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from hsk_card_generator.domino import TilePlan, build_game_plan, build_game_tiles, language_label
from hsk_card_generator.geometry import Mesh, Part, ROLE_COLORS, build_card_parts, build_domino_tile_parts, build_game_card_parts, build_plate_label_part, merge_meshes
from hsk_card_generator.layout import CardPosition, compute_index_layout, compute_layout
from hsk_card_generator.models import ExportRequest, Language


EXPORT_ROOT = Path("exports")


def export_zip(request: ExportRequest) -> dict:
    EXPORT_ROOT.mkdir(exist_ok=True)
    job_id = _timestamp_job_id()
    job_dir = EXPORT_ROOT / job_id
    job_dir.mkdir()
    zip_path = job_dir / "hsk-card-generator-export.zip"

    selected_words = [w for w in request.words if request.rangeStart <= w.index <= request.rangeEnd]
    tile_plans = build_game_tiles(selected_words, request.gameMode, request.domino)
    game_plan = build_game_plan(selected_words, request.gameMode, request.domino, request.simulator)
    layout = _layout_for_request(request, selected_words, tile_plans, game_plan)
    if not layout["valid"]:
        return {"ok": False, "error": "Layout is invalid", "layout": layout}

    all_parts = _build_all_parts(request, selected_words, layout, tile_plans, game_plan)
    all_parts.extend(_build_plate_labels(request, layout, all_parts, tile_plans))
    colors = _active_colors(request)
    dimensions = _dimension_summary(all_parts, request)
    metadata = _model_metadata(request, layout, tile_plans, dimensions)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.md", _readme(request, selected_words, layout, tile_plans, dimensions))
        archive.writestr("source/export-request.json", json.dumps(_request_to_json(request), ensure_ascii=False, indent=2))
        archive.writestr("source/settings.json", json.dumps(_settings_snapshot(request, colors), ensure_ascii=False, indent=2))
        archive.writestr("source/text-overrides.json", json.dumps(_text_overrides(selected_words), ensure_ascii=False, indent=2))
        archive.writestr("source/layout-preview.json", json.dumps(layout, ensure_ascii=False, indent=2))
        archive.writestr("source/game-plan.json", json.dumps(game_plan, ensure_ascii=False, indent=2))
        archive.writestr("source/card-plan.json", json.dumps(_card_plan(request, selected_words, tile_plans), ensure_ascii=False, indent=2))
        if tile_plans:
            archive.writestr("source/tile-plan.json", json.dumps([tile.to_dict() for tile in tile_plans], ensure_ascii=False, indent=2))
        _write_answer_sheets(archive, request, selected_words, tile_plans, game_plan)
        _write_rule_docs(archive, request)
        _write_print_profiles(archive, request, dimensions)
        archive.writestr("MANIFEST.json", json.dumps(_manifest(all_parts, request, layout, tile_plans, colors, dimensions), ensure_ascii=False, indent=2))
        _write_whole_plate_stls(archive, all_parts)
        _write_plate_role_stls(archive, all_parts)
        _write_card_separate_stls(archive, all_parts)
        _write_whole_plate_3mfs(archive, all_parts, colors, metadata)
        _write_3mf_variants(archive, all_parts, colors, metadata)

    return {
        "ok": True,
        "jobId": job_id,
        "downloadPath": str(zip_path.resolve()),
        "layout": layout,
        "files": {"zip": str(zip_path.resolve())},
    }


def _timestamp_job_id() -> str:
    base = datetime.now().strftime("%Y%m%d%H%M")
    candidate = base
    counter = 2
    while (EXPORT_ROOT / candidate).exists():
        candidate = f"{base}-{counter:02d}"
        counter += 1
    return candidate


def _layout_for_request(request: ExportRequest, words: list, tile_plans: list[TilePlan], game_plan: dict) -> dict:
    if _single_card_game(request.gameMode):
        cards = game_plan.get("cards") or []
        layout = compute_index_layout([card["cardId"] for card in cards], request.printer, request.design)
        layout["gameMode"] = request.gameMode
        layout["cards"] = cards
        layout["gameCards"] = True
        layout["cardCount"] = len(cards)
        return layout
    if tile_plans:
        layout = compute_index_layout([tile.cardId for tile in tile_plans], request.printer, request.design)
        layout["gameMode"] = request.gameMode
        layout["cards"] = [tile.to_dict() for tile in tile_plans]
        return layout
    layout = compute_layout(words, request.printer, request.design)
    layout["gameMode"] = request.gameMode
    return layout


def _build_all_parts(request: ExportRequest, words: list, layout: dict, tile_plans: list[TilePlan], game_plan: dict) -> list[Part]:
    positions_by_index = {pos["index"]: pos for pos in layout["positions"]}

    parts: list[Part] = []
    if _single_card_game(request.gameMode):
        for card in game_plan.get("cards") or []:
            pos = _position_from_dict(positions_by_index[card["cardId"]])
            parts.extend(build_game_card_parts(card["cardId"], card["wordId"], card["languageCode"], card["text"], request.gameMode, pos, request.design, card.get("overrides") or None))
        return parts

    if tile_plans:
        for tile in tile_plans:
            pos_data = positions_by_index[tile.cardId]
            pos = _position_from_dict(pos_data)
            parts.extend(build_domino_tile_parts(tile, pos, request.design))
        return parts

    for language in request.languages:
        for word in words:
            pos_data = positions_by_index[word.index]
            pos = _position_from_dict(pos_data)
            parts.extend(build_card_parts(word, language, pos, request.design))
    return parts


def _single_card_game(game_mode: str) -> bool:
    return game_mode in {"matching", "memory"}


def _position_from_dict(pos_data: dict) -> CardPosition:
    return CardPosition(
        index=pos_data["index"],
        page=pos_data["page"],
        row=pos_data["row"],
        column=pos_data["column"],
        x=pos_data["x"],
        y=pos_data["y"],
        width=pos_data["width"],
        height=pos_data["height"],
    )


def _write_plate_role_stls(archive: zipfile.ZipFile, parts: list[Part]) -> None:
    grouped: dict[tuple[Language, int, str], list[Mesh]] = defaultdict(list)
    for part in parts:
        grouped[(part.language, part.page, part.role)].append(part.mesh)
    for (language, page, role), meshes in grouped.items():
        mesh = merge_meshes(f"{language}_page_{page + 1:02d}_{role}", meshes)
        archive.writestr(f"stl_plate_roles/{language}/page_{page + 1:02d}/{role}.stl", mesh_to_stl(mesh))


def _write_whole_plate_stls(archive: zipfile.ZipFile, parts: list[Part]) -> None:
    grouped: dict[tuple[Language, int], list[Mesh]] = defaultdict(list)
    for part in parts:
        grouped[(part.language, part.page)].append(part.mesh)
    for (language, page), meshes in grouped.items():
        mesh = merge_meshes(f"{language}_page_{page + 1:02d}_all_objects", meshes)
        archive.writestr(f"plates_stl/{language}_page_{page + 1:02d}.stl", mesh_to_stl(mesh))


def _write_card_separate_stls(archive: zipfile.ZipFile, parts: list[Part]) -> None:
    for part in parts:
        if part.card_index is None:
            continue
        path = f"stl_each_card/{part.language}/page_{part.page + 1:02d}/card_{part.card_index:03d}/{part.role}.stl"
        archive.writestr(path, mesh_to_stl(part.mesh))


def _build_plate_labels(request: ExportRequest, layout: dict, parts: list[Part], tile_plans: list[TilePlan]) -> list[Part]:
    if request.gameMode == "flashcards":
        return []
    enabled = request.plateLabel.mode == "visible" or request.plateLabel.mode != "none"
    if not enabled or not parts:
        return []
    labels: list[Part] = []
    pages = sorted({(part.language, part.page) for part in parts})
    used_by_page = {page: [pos for pos in layout["positions"] if pos["page"] == page] for _, page in pages}
    for language, page in pages:
        positions = used_by_page.get(page) or []
        if not positions:
            continue
        min_y = min(pos["y"] for pos in positions)
        max_y = max(pos["y"] + pos["height"] for pos in positions)
        label_h = 4.0
        y = 1.0 if min_y >= label_h + 2 else max_y + 1.0
        if y + label_h > request.printer.depthMm:
            continue
        text = _plate_label_text(request, page, len(tile_plans) if tile_plans else len({part.card_index for part in parts if part.card_index}))
        part = build_plate_label_part(text, language, page, 2.0, y, max(0, request.design.thicknessMm - 0.03), min(120.0, request.printer.widthMm - 4), label_h, request.plateLabel.heightMm)
        if part:
            labels.append(part)
    return labels


def _plate_label_text(request: ExportRequest, page: int, count: int) -> str:
    return request.plateLabel.textTemplate.format(
        dataset=request.datasetId,
        range=f"{request.rangeStart:03d}-{request.rangeEnd:03d}",
        mode=request.gameMode,
        page=page + 1,
        count=count,
    )


def _write_whole_plate_3mfs(archive: zipfile.ZipFile, parts: list[Part], colors: dict[str, str], metadata: dict[str, str]) -> None:
    grouped: dict[tuple[Language, int], list[Part]] = defaultdict(list)
    for part in parts:
        grouped[(part.language, part.page)].append(part)
    for (language, page), plate_parts in grouped.items():
        layer_parts = _plate_layer_parts(language, page, plate_parts)
        plate_name = _plate_file_stem(language, page)
        archive.writestr(
            f"plates_3mf/{plate_name}.3mf",
            build_3mf_assembly(layer_parts, _plate_title(language, page, metadata), colors, metadata),
        )
        archive.writestr(
            f"3mf_whole_plate_single/{_language_file_label(language)}/page_{page + 1:02d}.3mf",
            build_3mf_single_object(plate_parts, f"{_plate_title(language, page, metadata)} single", colors, metadata),
        )
        archive.writestr(
            f"3mf_whole_plate_per_card_objects/{_language_file_label(language)}/page_{page + 1:02d}.3mf",
            build_3mf(plate_parts, f"{_plate_title(language, page, metadata)} per-card", colors, metadata),
        )


def _plate_layer_parts(language: Language, page: int, plate_parts: list[Part]) -> list[Part]:
    grouped: dict[str, list[Mesh]] = defaultdict(list)
    for part in plate_parts:
        grouped[part.role].append(part.mesh)
    role_order = ["base", "frontText", "backNumber", "border", "divider", "doubleMarker", "hanziGuide", "plateLabel"]
    layers: list[Part] = []
    for role in role_order:
        meshes = grouped.get(role)
        if not meshes:
            continue
        label = _language_file_label(language)
        layers.append(Part(f"{label}_page_{page + 1:02d}_{role}", role, merge_meshes(f"{label}_{page}_{role}", meshes), language, page))
    return layers


def _manifest(parts: list[Part], request: ExportRequest, layout: dict, tile_plans: list[TilePlan], colors: dict[str, str], dimensions: dict) -> dict:
    plates = sorted({(part.language, part.page) for part in parts})
    roles_by_plate: dict[tuple[Language, int], list[str]] = {}
    role_order = ["base", "frontText", "backNumber", "border", "divider", "doubleMarker", "hanziGuide", "plateLabel"]
    for language, page in plates:
        role_set = {part.role for part in parts if part.language == language and part.page == page}
        roles_by_plate[(language, page)] = [role for role in role_order if role in role_set]
    return {
        "gameMode": request.gameMode,
        "datasetId": request.datasetId,
        "range": [request.rangeStart, request.rangeEnd],
        "layout": {"rows": layout["rows"], "columns": layout["columns"], "capacity": layout["capacity"], "pageCount": layout["pageCount"]},
        "domino": request.domino.__dict__ if request.gameMode == "domino" else None,
        "tileCount": len(tile_plans) if tile_plans else None,
        "colors": colors,
        "settings": _settings_snapshot(request, colors),
        "textOverrideCount": sum(len((word.overrides or {})) for word in request.words),
        "dimensions": dimensions,
        "plateLabel": request.plateLabel.__dict__,
        "printProfile": request.printProfile.__dict__,
        "textFit": request.textFit.__dict__,
        "simulator": request.simulator.__dict__,
        "rulesFiles": _rules_file_names(request) if request.domino.includeRules else [],
        "plateCount": len(plates),
        "plates": [
            {
                "language": language,
                "languageLabel": _language_file_label(language),
                "page": page + 1,
                "primary3mf": f"plates_3mf/{_plate_file_stem(language, page)}.3mf",
                "primaryStl": f"plates_stl/{language}_page_{page + 1:02d}.stl",
                "layerObjectCount": len(roles_by_plate[(language, page)]),
                "layers": roles_by_plate[(language, page)],
                "backNumberDeboss": "integratedInBase" if "backNumber" not in roles_by_plate[(language, page)] else "separateColoredInsert",
            }
            for language, page in plates
        ],
    }


def _write_3mf_variants(archive: zipfile.ZipFile, parts: list[Part], colors: dict[str, str], metadata: dict[str, str]) -> None:
    archive.writestr("3mf/hsk_parts_per_card.3mf", build_3mf(parts, "parts_per_card", colors, metadata))

    card_grouped: dict[tuple[Language, int, int], list[Mesh]] = defaultdict(list)
    role_grouped: dict[tuple[Language, int, str], list[Mesh]] = defaultdict(list)
    for part in parts:
        if part.card_index is not None:
            card_grouped[(part.language, part.page, part.card_index)].append(part.mesh)
        role_grouped[(part.language, part.page, part.role)].append(part.mesh)

    card_parts = [
        Part(f"{language}_page_{page + 1:02d}_card_{card:03d}", "base", merge_meshes(f"{language}_{card:03d}", meshes), language, page, card)
        for (language, page, card), meshes in card_grouped.items()
    ]
    archive.writestr("3mf/hsk_each_card_separate.3mf", build_3mf(card_parts, "each_card_separate", colors, metadata))

    role_parts = [
        Part(f"{language}_page_{page + 1:02d}_{role}", role, merge_meshes(f"{language}_{page}_{role}", meshes), language, page)
        for (language, page, role), meshes in role_grouped.items()
    ]
    archive.writestr("3mf/hsk_plate_role_grouping.3mf", build_3mf(role_parts, "plate_role_grouping", colors, metadata))


def _plate_title(language: str, page: int, metadata: dict[str, str]) -> str:
    return f"{metadata.get('Dataset', 'HSK')}_{metadata.get('Range', '')}_{metadata.get('GameMode', '')}_{_language_file_label(language)}_page_{page + 1:02d}"


def _language_file_label(language: str) -> str:
    labels = {
        "chinese": "Chinese",
        "pinyin": "Pinyin",
        "english": "English",
        "target": "Russian",
        "hungarian": "Hungarian",
        "domino": "Domino",
        "matching": "Matching",
        "memory": "Memory",
        "pair_cards": "PairCards",
        "modular_expansion": "ModularExpansion",
        "mixed_challenge": "MixedChallenge",
    }
    return labels.get(language, "".join(part.capitalize() for part in str(language).replace("-", "_").split("_") if part) or "Plate")


def _plate_file_stem(language: str, page: int) -> str:
    return f"{_language_file_label(language)}_page_{page + 1:02d}"


def mesh_to_stl(mesh: Mesh) -> str:
    lines = [f"solid {mesh.name}"]
    for a, b, c in mesh.faces:
        va, vb, vc = mesh.vertices[a], mesh.vertices[b], mesh.vertices[c]
        nx, ny, nz = _normal(va, vb, vc)
        lines.append(f"  facet normal {nx:.6f} {ny:.6f} {nz:.6f}")
        lines.append("    outer loop")
        lines.append(f"      vertex {va[0]:.6f} {va[1]:.6f} {va[2]:.6f}")
        lines.append(f"      vertex {vb[0]:.6f} {vb[1]:.6f} {vb[2]:.6f}")
        lines.append(f"      vertex {vc[0]:.6f} {vc[1]:.6f} {vc[2]:.6f}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append(f"endsolid {mesh.name}")
    return "\n".join(lines)


def _normal(a: tuple[float, float, float], b: tuple[float, float, float], c: tuple[float, float, float]) -> tuple[float, float, float]:
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    return nx / length, ny / length, nz / length


def build_3mf(parts: list[Part], variant: str, colors: dict[str, str] | None = None, metadata: dict[str, str] | None = None) -> bytes:
    model = _model_xml(parts, variant, colors or ROLE_COLORS, metadata or {})
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types())
        archive.writestr("_rels/.rels", _rels())
        archive.writestr("3D/3dmodel.model", model)
    return buffer.getvalue()


def build_3mf_single_object(parts: list[Part], variant: str, colors: dict[str, str] | None = None, metadata: dict[str, str] | None = None) -> bytes:
    model = _single_object_model_xml(parts, variant, colors or ROLE_COLORS, metadata or {})
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types())
        archive.writestr("_rels/.rels", _rels())
        archive.writestr("3D/3dmodel.model", model)
    return buffer.getvalue()


def build_3mf_assembly(parts: list[Part], variant: str, colors: dict[str, str] | None = None, metadata: dict[str, str] | None = None) -> bytes:
    model = _assembly_model_xml(parts, variant, colors or ROLE_COLORS, metadata or {})
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types())
        archive.writestr("_rels/.rels", _rels())
        archive.writestr("3D/3dmodel.model", model)
    return buffer.getvalue()


def _model_xml(parts: list[Part], variant: str, colors_by_role: dict[str, str], metadata: dict[str, str]) -> str:
    object_xml: list[str] = []
    build_items: list[str] = []
    for object_id, part in enumerate(parts, start=1):
        color = _part_color(part, colors_by_role)
        object_xml.append(f'<object id="{object_id}" type="model" name="{escape(part.name)}" pid="1" pindex="{_color_index(color, colors_by_role)}">')
        object_xml.append("<mesh><vertices>")
        for x, y, z in part.mesh.vertices:
            object_xml.append(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}" />')
        object_xml.append("</vertices><triangles>")
        for a, b, c in part.mesh.faces:
            object_xml.append(f'<triangle v1="{a}" v2="{b}" v3="{c}" />')
        object_xml.append("</triangles></mesh></object>")
        build_items.append(f'<item objectid="{object_id}" />')
    colors = "".join(f'<m:color color="{color}" />' for color in _ordered_colors(colors_by_role))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
        f'<metadata name="Title">HSK Card Generator {escape(variant)}</metadata>'
        f'<metadata name="Application">HSK Card Generator Spike</metadata>'
        f'{_metadata_xml(metadata)}'
        f"<resources><m:colorgroup id=\"1\">{colors}</m:colorgroup>{''.join(object_xml)}</resources>"
        f"<build>{''.join(build_items)}</build>"
        "</model>"
    )


def _assembly_model_xml(parts: list[Part], variant: str, colors_by_role: dict[str, str], metadata: dict[str, str]) -> str:
    object_xml: list[str] = []
    component_xml: list[str] = []
    for object_id, part in enumerate(parts, start=1):
        color = _part_color(part, colors_by_role)
        object_xml.append(f'<object id="{object_id}" type="model" name="{escape(part.name)}" pid="1" pindex="{_color_index(color, colors_by_role)}">')
        object_xml.append("<mesh><vertices>")
        for x, y, z in part.mesh.vertices:
            object_xml.append(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}" />')
        object_xml.append("</vertices><triangles>")
        for a, b, c in part.mesh.faces:
            object_xml.append(f'<triangle v1="{a}" v2="{b}" v3="{c}" />')
        object_xml.append("</triangles></mesh></object>")
        component_xml.append(f'<component objectid="{object_id}" />')

    assembly_id = len(parts) + 1
    colors = "".join(f'<m:color color="{color}" />' for color in _ordered_colors(colors_by_role))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
        f'<metadata name="Title">HSK Card Generator {escape(variant)}</metadata>'
        '<metadata name="Application">HSK Card Generator Spike</metadata>'
        f'{_metadata_xml(metadata)}'
        f'<resources><m:colorgroup id="1">{colors}</m:colorgroup>'
        f'{"".join(object_xml)}'
        f'<object id="{assembly_id}" type="model" name="{escape(variant)}"><components>{"".join(component_xml)}</components></object>'
        f'</resources><build><item objectid="{assembly_id}" /></build></model>'
    )


def _single_object_model_xml(parts: list[Part], variant: str, colors_by_role: dict[str, str], metadata: dict[str, str]) -> str:
    vertices: list[tuple[float, float, float]] = []
    triangles: list[str] = []
    for part in parts:
        color = _part_color(part, colors_by_role)
        color_index = _color_index(color, colors_by_role)
        offset = len(vertices)
        vertices.extend(part.mesh.vertices)
        for a, b, c in part.mesh.faces:
            triangles.append(
                f'<triangle v1="{a + offset}" v2="{b + offset}" v3="{c + offset}" '
                f'pid="1" p1="{color_index}" p2="{color_index}" p3="{color_index}" />'
            )
    vertex_xml = "".join(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}" />' for x, y, z in vertices)
    colors = "".join(f'<m:color color="{color}" />' for color in _ordered_colors(colors_by_role))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
        f'<metadata name="Title">HSK Card Generator {escape(variant)}</metadata>'
        '<metadata name="Application">HSK Card Generator Spike</metadata>'
        f'{_metadata_xml(metadata)}'
        f'<resources><m:colorgroup id="1">{colors}</m:colorgroup>'
        f'<object id="1" type="model" name="{escape(variant)}">'
        f'<mesh><vertices>{vertex_xml}</vertices><triangles>{"".join(triangles)}</triangles></mesh>'
        '</object></resources><build><item objectid="1" /></build></model>'
    )


def _ordered_colors(colors_by_role: dict[str, str] | None = None) -> list[str]:
    colors_by_role = colors_by_role or ROLE_COLORS
    ordered: list[str] = []
    for role in ["base", "frontText", "backNumber", "border", "divider", "doubleMarker", "hanziGuide", "plateLabel"]:
        color = colors_by_role.get(role)
        if color and color not in ordered:
            ordered.append(color)
    for key in sorted(colors_by_role):
        if key.startswith("language:"):
            color = colors_by_role.get(key)
            if color and color not in ordered:
                ordered.append(color)
    if "#cccccc" not in ordered:
        ordered.append("#cccccc")
    return ordered


def _color_index(color: str, colors_by_role: dict[str, str] | None = None) -> int:
    try:
        return _ordered_colors(colors_by_role).index(color)
    except ValueError:
        return len(_ordered_colors(colors_by_role)) - 1


def _part_color(part: Part, colors_by_role: dict[str, str]) -> str:
    if part.role == "base":
        language_color = colors_by_role.get(f"language:{part.language}")
        if language_color:
            return language_color
    return colors_by_role.get(part.role, "#cccccc")


def _content_types() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '<Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '</Types>'
    )


def _metadata_xml(metadata: dict[str, str]) -> str:
    return "".join(f'<metadata name="{escape(str(key))}">{escape(str(value))}</metadata>' for key, value in metadata.items() if value is not None)


def _rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
        'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
        '</Relationships>'
    )


def _dimension_summary(parts: list[Part], request: ExportRequest) -> dict:
    zs = [z for part in parts for _, _, z in part.mesh.vertices]
    total_height = max(zs) - min(zs) if zs else 0
    return {
        "baseThicknessMm": round(request.design.thicknessMm, 4),
        "raisedTextHeightMm": round(request.design.textHeightMm, 4),
        "raisedBorderHeightMm": round(request.design.borderHeightMm, 4),
        "surfaceEmbedMm": 0.03,
        "totalModelHeightMm": round(total_height, 4),
        "bambuDimensionNote": "Bambu Studio may show total model height, which includes raised text, border, guide, and labels above the base thickness.",
    }


def _model_metadata(request: ExportRequest, layout: dict, tile_plans: list[TilePlan], dimensions: dict) -> dict[str, str]:
    return {
        "Dataset": request.datasetId,
        "Range": f"{request.rangeStart:03d}-{request.rangeEnd:03d}",
        "GameMode": request.gameMode,
        "Printer": request.printer.name,
        "NozzleMm": f"{request.printProfile.nozzleMm:.2f}",
        "RecommendedLayerHeightMm": f"{request.printProfile.layerHeightMm:.2f}",
        "MaterialSaver": str(request.printProfile.materialSaver).lower(),
        "CardSizeMm": f"{request.design.widthMm:g}x{request.design.heightMm:g}x{request.design.thicknessMm:g}",
        "TotalModelHeightMm": str(dimensions["totalModelHeightMm"]),
        "PageCount": str(layout["pageCount"]),
        "TileCount": str(len(tile_plans)) if tile_plans else "",
        "BambuProfileStatus": "recommendations-only; Bambu-specific project metadata is experimental",
    }


def _card_plan(request: ExportRequest, words: list, tile_plans: list[TilePlan]) -> dict:
    if tile_plans:
        return {"mode": request.gameMode, "cards": [tile.to_dict() for tile in tile_plans]}
    return {
        "mode": request.gameMode,
        "cards": [
            {
                "cardId": f"{word.index:03d}_{language}",
                "wordId": word.index,
                "languageCode": language,
                "text": word.text_for(language),
                "overrides": (word.overrides or {}).get(language, {}),
            }
            for word in words
            for language in request.languages
        ],
    }


def _text_overrides(words: list[WordEntry]) -> dict:
    entries = []
    for word in words:
        overrides = word.overrides or {}
        if not overrides:
            continue
        entries.append(
            {
                "wordId": word.index,
                "texts": {
                    "chinese": word.chinese,
                    "pinyin": word.pinyin,
                    "english": word.english,
                    "russian": word.target,
                    "hungarian": word.hungarian,
                },
                "overrides": overrides,
            }
        )
    return {"count": len(entries), "entries": entries}


def _write_answer_sheets(archive: zipfile.ZipFile, request: ExportRequest, words: list, tile_plans: list[TilePlan], game_plan: dict) -> None:
    if tile_plans:
        _write_domino_answer_sheets(archive, tile_plans, request.gameMode)
        return
    mode = request.gameMode
    md_lines = [
        f"# {mode.replace('_', ' ').title()} Answer Sheet",
        "",
        "| ID | Chinese | Pinyin | English | Russian | Hungarian |",
        "|---:|---|---|---|---|---|",
    ]
    csv_lines = ["id,chinese,pinyin,english,russian,hungarian"]
    json_rows = []
    for word in words:
        row = [word.index, word.chinese, word.pinyin, word.english, word.target, word.hungarian]
        md_lines.append(f"| {word.index:03d} | {word.chinese} | {word.pinyin} | {word.english} | {word.target} | {word.hungarian} |")
        csv_lines.append(",".join(_csv_cell(value) for value in row))
        json_rows.append(word.to_dict())
    archive.writestr(f"answer_sheets/{mode}.md", "\n".join(md_lines) + "\n")
    archive.writestr(f"answer_sheets/{mode}.csv", "\n".join(csv_lines) + "\n")
    archive.writestr(f"answer_sheets/{mode}.json", json.dumps({"rows": json_rows, "gamePlan": game_plan}, ensure_ascii=False, indent=2))


def _write_domino_answer_sheets(archive: zipfile.ZipFile, tile_plans: list[TilePlan], mode: str = "domino") -> None:
    md_lines = [
        "# Domino Answer Sheet",
        "",
        "| Tile | Type | Left ID | Left Text | Left Lang | Right ID | Right Text | Right Lang | Match Rule |",
        "|---:|---|---:|---|---|---:|---|---|---|",
    ]
    csv_lines = ["tile,type,left_id,left_text,left_lang,right_id,right_text,right_lang,match_rule"]
    json_rows = []
    for tile in tile_plans:
        match_rule = "double / branch point" if tile.tileType == "double" else f"{tile.left.wordId} connects by meaning; {tile.right.wordId} continues the chain"
        md_lines.append(
            f"| {tile.cardId:03d} | {tile.tileType} | {tile.left.wordId:03d} | {tile.left.text} | {language_label(tile.left.languageCode)} | "
            f"{tile.right.wordId:03d} | {tile.right.text} | {language_label(tile.right.languageCode)} | {match_rule} |"
        )
        csv_lines.append(
            ",".join(
                _csv_cell(value)
                for value in [
                    f"{tile.cardId:03d}",
                    tile.tileType,
                    f"{tile.left.wordId:03d}",
                    tile.left.text,
                    tile.left.languageCode,
                    f"{tile.right.wordId:03d}",
                    tile.right.text,
                    tile.right.languageCode,
                    match_rule,
                ]
            )
        )
        json_rows.append({**tile.to_dict(), "matchRule": match_rule})
    archive.writestr(f"answer_sheets/{mode}.md", "\n".join(md_lines) + "\n")
    archive.writestr(f"answer_sheets/{mode}.csv", "\n".join(csv_lines) + "\n")
    archive.writestr(f"answer_sheets/{mode}.json", json.dumps(json_rows, ensure_ascii=False, indent=2))


def _write_print_profiles(archive: zipfile.ZipFile, request: ExportRequest, dimensions: dict) -> None:
    quality = [
        "# Bambu A1 Mini Quality Profile",
        "",
        f"Nozzle: {request.printProfile.nozzleMm:.2f} mm",
        f"Layer height: {request.printProfile.layerHeightMm:.2f} mm",
        "Walls: 3",
        "Top/bottom shells: 4",
        "Infill: 10-15%",
        "Ironing: off by default for raised text",
        "AMS: assign base/text/border/divider objects by role color.",
        "",
        f"Base thickness: {dimensions['baseThicknessMm']} mm",
        f"Total model height: {dimensions['totalModelHeightMm']} mm",
    ]
    saver = [
        "# Bambu A1 Mini Material Saver Profile",
        "",
        f"Nozzle: {request.printProfile.nozzleMm:.2f} mm",
        "Layer height: 0.16-0.20 mm",
        "Walls: 2",
        "Infill: 0-8% for solid-looking thin cards",
        "Top/bottom shells: enough to keep surfaces closed",
        "Use one plate-role 3MF at a time to reduce setup mistakes.",
    ]
    summary = {
        "target": request.printProfile.target,
        "nozzleMm": request.printProfile.nozzleMm,
        "layerHeightMm": request.printProfile.layerHeightMm,
        "materialSaver": request.printProfile.materialSaver,
        "includeBambuMetadata": request.printProfile.includeBambuMetadata,
        "bambuSpecificProjectMetadata": "experimental_not_auto_applied",
        "dimensions": dimensions,
    }
    archive.writestr("print_profiles/bambu_a1_mini_quality.md", "\n".join(quality) + "\n")
    archive.writestr("print_profiles/bambu_a1_mini_material_saver.md", "\n".join(saver) + "\n")
    archive.writestr("print_profiles/profile-summary.json", json.dumps(summary, ensure_ascii=False, indent=2))


def _csv_cell(value: object) -> str:
    text = str(value)
    if any(char in text for char in [",", "\"", "\n"]):
        return "\"" + text.replace("\"", "\"\"") + "\""
    return text


def _write_rule_docs(archive: zipfile.ZipFile, request: ExportRequest) -> None:
    if not request.domino.includeRules:
        return
    language = "en" if request.domino.rulesLanguage == "en" else "ru"
    for name, content in _rules_docs(language).items():
        archive.writestr(f"rules/{language}/{name}.md", content)


def _rules_file_names(request: ExportRequest) -> list[str]:
    language = "en" if request.domino.rulesLanguage == "en" else "ru"
    return [f"rules/{language}/{name}.md" for name in _rules_docs(language)]


def _rules_docs(language: str) -> dict[str, str]:
    if language == "en":
        return {
            "flashcards": "# Flashcards\n\nUse cards as direct vocabulary prompts. Cards with the same hidden ID belong to the same word.\n",
            "matching": "# Matching\n\nFind all visible representations that share the same hidden semantic ID.\n",
            "memory": "# Memory\n\nPlace cards face down, flip two or more cards, and keep matches that share the same hidden ID.\n",
            "pair_cards": "# Pair Cards\n\nEach tile shows two representations of one word. Say both sides aloud before keeping the tile.\n",
            "domino_beginner": "# Domino Beginner\n\nPlace tiles so touching halves have the same meaning. Doubles are branch points. After the game, flip tiles and verify the left/right back IDs.\n",
            "domino_normal": "# Domino Normal\n\nPlayers keep hidden hands, draw when blocked, and place tiles by semantic match. Doubles may be placed as branch points.\n",
            "modular_expansion": "# Modular Expansion\n\nExpansion packs add new language edges. Previously printed tiles remain valid because every connection is based on stable word IDs.\n",
            "mixed_challenge": "# Mixed Challenge\n\nLanguages are mixed. Players match by meaning, not by visible text or language.\n",
        }
    return {
        "flashcards": "# Флеш-карточки\n\nИспользуйте карточки как прямые подсказки словаря. Карточки с одинаковым скрытым ID относятся к одному слову.\n",
        "matching": "# Matching\n\nНайдите все видимые представления, которые имеют один и тот же скрытый смысловой ID.\n",
        "memory": "# Memory\n\nРазложите карточки рубашкой вверх, открывайте две или больше карточек и забирайте совпадения с одинаковым скрытым ID.\n",
        "pair_cards": "# Парные карточки\n\nКаждая плитка показывает два представления одного слова. Перед тем как забрать плитку, произнесите обе стороны.\n",
        "domino_beginner": "# Домино для начинающих\n\nКладите плитки так, чтобы соприкасающиеся половины имели один смысл. Doubles работают как точки ветвления. После игры переверните плитки и проверьте левый/правый ID на обратной стороне.\n",
        "domino_normal": "# Обычное домино\n\nИгроки держат плитки закрыто, добирают из банка при блокировке и выкладывают плитки по смысловому совпадению. Doubles можно класть как точки ветвления.\n",
        "modular_expansion": "# Модульные расширения\n\nExpansion packs добавляют новые языковые связи. Старые плитки остаются валидными, потому что все совпадения основаны на стабильных ID слов.\n",
        "mixed_challenge": "# Mixed Challenge\n\nЯзыки перемешаны. Игроки сопоставляют по смыслу, а не по видимому тексту или языку.\n",
    }


def _readme(request: ExportRequest, words: list, layout: dict, tile_plans: list[TilePlan], dimensions: dict) -> str:
    lines = [
        "# HSK Card Generator Export",
        "",
        f"Mode: {request.gameMode}",
        f"Printer: {request.printer.name} ({request.printer.widthMm} x {request.printer.depthMm} mm)",
        f"Card: {request.design.widthMm} x {request.design.heightMm} x {request.design.thicknessMm} mm",
        f"Base thickness: {dimensions['baseThicknessMm']} mm",
        f"Total model height: {dimensions['totalModelHeightMm']} mm",
        f"Layout: {layout['columns']} columns x {layout['rows']} rows, {layout['capacity']} cards/page",
        f"Pages: {layout['pageCount']}",
        f"Primary plate files: {_primary_plate_description(request)} across {layout['pageCount']} page(s).",
        "",
        "## Compatibility",
        "",
        "This spike exports three 3MF variants: parts per card, each card separate, and plate-role grouping.",
        "Primary physical plates are exported under plates_3mf/ and plates_stl/.",
        "Each primary 3MF file represents exactly one physical plate. In normal deboss mode the back number is cut into the base mesh, not exported as a separate color object.",
        "Deboss + color mode adds a separate backNumber insert object. Chinese plates also include a separate Hanzi guide object when enabled.",
        "Single-object fallback files are kept under 3mf_whole_plate_single/.",
        "Per-card object compatibility files are kept under 3mf_whole_plate_per_card_objects/.",
        "Front text is rasterized into raised run-block geometry so Hanzi, Cyrillic, tone marks, and Latin labels appear in slicers without font dependencies.",
        "Back numbers use mirrored seven-segment proxy geometry on the underside.",
        "Bambu Studio dimensions may show total model height, which includes raised text, border, Hanzi guide, and physical plate labels above the base thickness.",
        "Print profile recommendations are exported under print_profiles/; Bambu-specific project metadata is experimental until manually verified.",
        "",
    ]
    if tile_plans:
        lines.extend(
            [
                "## Domino Set",
                "",
                f"Tile count: {len(tile_plans)}",
                f"Density: {request.domino.density}",
                f"Language order: {' -> '.join(request.domino.languageOrder)}",
                "Doubles are marked as branch points and use same-word left/right IDs.",
                "Normal bridge tiles connect different word IDs by the generated sequence.",
                "",
            ]
        )
    lines.extend(
        [
        "## Word Mapping",
        "",
        "| # | Chinese | Pinyin | English | Russian | Hungarian |",
        "|---:|---|---|---|---|---|",
        ]
    )
    for word in words:
        lines.append(f"| {word.index} | {word.chinese} | {word.pinyin} | {word.english} | {word.target} | {word.hungarian} |")
    return "\n".join(lines) + "\n"


def _primary_plate_description(request: ExportRequest) -> str:
    if request.gameMode == "domino":
        return "1 domino group"
    if _single_card_game(request.gameMode):
        return f"1 {request.gameMode.replace('_', ' ')} deck"
    return str(len(request.languages)) + " language groups"


def _request_to_json(request: ExportRequest) -> dict:
    return {
        "words": [word.to_dict() for word in request.words],
        "languages": request.languages,
        "rangeStart": request.rangeStart,
        "rangeEnd": request.rangeEnd,
        "printer": request.printer.__dict__,
        "design": request.design.__dict__,
        "formats": request.formats,
        "gameMode": request.gameMode,
        "domino": request.domino.__dict__,
        "colors": request.colors,
        "datasetId": request.datasetId,
        "plateLabel": request.plateLabel.__dict__,
        "printProfile": request.printProfile.__dict__,
        "textFit": request.textFit.__dict__,
        "simulator": request.simulator.__dict__,
        "ui": request.ui,
    }


def _settings_snapshot(request: ExportRequest, active_colors: dict[str, str]) -> dict:
    return {
        "datasetId": request.datasetId,
        "gameMode": request.gameMode,
        "languages": request.languages,
        "range": {"start": request.rangeStart, "end": request.rangeEnd},
        "printer": request.printer.__dict__,
        "design": request.design.__dict__,
        "domino": request.domino.__dict__,
        "plateLabel": request.plateLabel.__dict__,
        "printProfile": request.printProfile.__dict__,
        "textFit": request.textFit.__dict__,
        "simulator": request.simulator.__dict__,
        "colors": {
            "requested": request.colors,
            "active3mfColors": active_colors,
        },
        "ui": request.ui,
        "notes": {
            "allGeometryAffectingSettings": "Stored here and in source/export-request.json.",
            "perWordTextOverrides": "Stored in source/text-overrides.json and repeated in source/card-plan.json or source/tile-plan.json.",
            "bambuProfile": "Standard 3MF metadata is included; Bambu-specific project profile application remains recommendations-only until compatibility validation.",
        },
    }


def _active_colors(request: ExportRequest) -> dict[str, str]:
    colors = dict(ROLE_COLORS)
    role_colors = request.colors.get("roles") if isinstance(request.colors.get("roles"), dict) else request.colors
    for role, value in (role_colors or {}).items():
        if role in colors and isinstance(value, str) and value.startswith("#") and len(value) in (4, 7):
            colors[role] = value
    language_colors = request.colors.get("languages") if isinstance(request.colors.get("languages"), dict) else {}
    for language, value in (language_colors or {}).items():
        if isinstance(value, str) and value.startswith("#") and len(value) in (4, 7):
            colors[f"language:{language}"] = value
    return colors
