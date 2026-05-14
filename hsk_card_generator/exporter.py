from __future__ import annotations

import json
import math
import zipfile
from collections import defaultdict
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from hsk_card_generator.geometry import Mesh, Part, ROLE_COLORS, build_card_parts, merge_meshes
from hsk_card_generator.layout import compute_layout
from hsk_card_generator.models import ExportRequest, Language


EXPORT_ROOT = Path("exports")


def export_zip(request: ExportRequest) -> dict:
    EXPORT_ROOT.mkdir(exist_ok=True)
    job_id = _timestamp_job_id()
    job_dir = EXPORT_ROOT / job_id
    job_dir.mkdir()
    zip_path = job_dir / "hsk-card-generator-export.zip"

    selected_words = [w for w in request.words if request.rangeStart <= w.index <= request.rangeEnd]
    layout = compute_layout(selected_words, request.printer, request.design)
    if not layout["valid"]:
        return {"ok": False, "error": "Layout is invalid", "layout": layout}

    all_parts = _build_all_parts(request, selected_words, layout)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.md", _readme(request, selected_words, layout))
        archive.writestr("source/export-request.json", json.dumps(_request_to_json(request), ensure_ascii=False, indent=2))
        archive.writestr("source/layout-preview.json", json.dumps(layout, ensure_ascii=False, indent=2))
        archive.writestr("MANIFEST.json", json.dumps(_manifest(all_parts), ensure_ascii=False, indent=2))
        _write_whole_plate_stls(archive, all_parts)
        _write_plate_role_stls(archive, all_parts)
        _write_card_separate_stls(archive, all_parts)
        _write_whole_plate_3mfs(archive, all_parts)
        _write_3mf_variants(archive, all_parts)

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


def _build_all_parts(request: ExportRequest, words: list, layout: dict) -> list[Part]:
    positions_by_index = {pos["index"]: pos for pos in layout["positions"]}
    from hsk_card_generator.layout import CardPosition

    parts: list[Part] = []
    for language in request.languages:
        for word in words:
            pos_data = positions_by_index[word.index]
            pos = CardPosition(
                index=pos_data["index"],
                page=pos_data["page"],
                row=pos_data["row"],
                column=pos_data["column"],
                x=pos_data["x"],
                y=pos_data["y"],
                width=pos_data["width"],
                height=pos_data["height"],
            )
            parts.extend(build_card_parts(word, language, pos, request.design))
    return parts


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


def _write_whole_plate_3mfs(archive: zipfile.ZipFile, parts: list[Part]) -> None:
    grouped: dict[tuple[Language, int], list[Part]] = defaultdict(list)
    for part in parts:
        grouped[(part.language, part.page)].append(part)
    for (language, page), plate_parts in grouped.items():
        layer_parts = _plate_layer_parts(language, page, plate_parts)
        archive.writestr(
            f"plates_3mf/{language}_page_{page + 1:02d}.3mf",
            build_3mf_assembly(layer_parts, f"{language}_page_{page + 1:02d}_whole_plate_assembly"),
        )
        archive.writestr(
            f"3mf_whole_plate_single/{language}/page_{page + 1:02d}.3mf",
            build_3mf_single_object(plate_parts, f"{language}_page_{page + 1:02d}_whole_plate_single"),
        )
        archive.writestr(
            f"3mf_whole_plate_per_card_objects/{language}/page_{page + 1:02d}.3mf",
            build_3mf(plate_parts, f"{language}_page_{page + 1:02d}_whole_plate_objects"),
        )


def _plate_layer_parts(language: Language, page: int, plate_parts: list[Part]) -> list[Part]:
    grouped: dict[str, list[Mesh]] = defaultdict(list)
    for part in plate_parts:
        grouped[part.role].append(part.mesh)
    role_order = ["base", "frontText", "backNumber", "border", "hanziGuide"]
    layers: list[Part] = []
    for role in role_order:
        meshes = grouped.get(role)
        if not meshes:
            continue
        layers.append(Part(f"{language}_page_{page + 1:02d}_{role}", role, merge_meshes(f"{language}_{page}_{role}", meshes), language, page))
    return layers


def _manifest(parts: list[Part]) -> dict:
    plates = sorted({(part.language, part.page) for part in parts})
    roles_by_plate: dict[tuple[Language, int], list[str]] = {}
    for language, page in plates:
        role_set = {part.role for part in parts if part.language == language and part.page == page}
        roles_by_plate[(language, page)] = [role for role in ["base", "frontText", "backNumber", "border", "hanziGuide"] if role in role_set]
    return {
        "plateCount": len(plates),
        "plates": [
            {
                "language": language,
                "page": page + 1,
                "primary3mf": f"plates_3mf/{language}_page_{page + 1:02d}.3mf",
                "primaryStl": f"plates_stl/{language}_page_{page + 1:02d}.stl",
                "layerObjectCount": len(roles_by_plate[(language, page)]),
                "layers": roles_by_plate[(language, page)],
                "backNumberDeboss": "integratedInBase" if "backNumber" not in roles_by_plate[(language, page)] else "separateColoredInsert",
            }
            for language, page in plates
        ],
    }


def _write_3mf_variants(archive: zipfile.ZipFile, parts: list[Part]) -> None:
    archive.writestr("3mf/hsk_parts_per_card.3mf", build_3mf(parts, "parts_per_card"))

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
    archive.writestr("3mf/hsk_each_card_separate.3mf", build_3mf(card_parts, "each_card_separate"))

    role_parts = [
        Part(f"{language}_page_{page + 1:02d}_{role}", role, merge_meshes(f"{language}_{page}_{role}", meshes), language, page)
        for (language, page, role), meshes in role_grouped.items()
    ]
    archive.writestr("3mf/hsk_plate_role_grouping.3mf", build_3mf(role_parts, "plate_role_grouping"))


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


def build_3mf(parts: list[Part], variant: str) -> bytes:
    model = _model_xml(parts, variant)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types())
        archive.writestr("_rels/.rels", _rels())
        archive.writestr("3D/3dmodel.model", model)
    return buffer.getvalue()


def build_3mf_single_object(parts: list[Part], variant: str) -> bytes:
    model = _single_object_model_xml(parts, variant)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types())
        archive.writestr("_rels/.rels", _rels())
        archive.writestr("3D/3dmodel.model", model)
    return buffer.getvalue()


def build_3mf_assembly(parts: list[Part], variant: str) -> bytes:
    model = _assembly_model_xml(parts, variant)
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", _content_types())
        archive.writestr("_rels/.rels", _rels())
        archive.writestr("3D/3dmodel.model", model)
    return buffer.getvalue()


def _model_xml(parts: list[Part], variant: str) -> str:
    object_xml: list[str] = []
    build_items: list[str] = []
    for object_id, part in enumerate(parts, start=1):
        color = ROLE_COLORS.get(part.role, "#cccccc")
        object_xml.append(f'<object id="{object_id}" type="model" name="{escape(part.name)}" pid="1" pindex="{_color_index(color)}">')
        object_xml.append("<mesh><vertices>")
        for x, y, z in part.mesh.vertices:
            object_xml.append(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}" />')
        object_xml.append("</vertices><triangles>")
        for a, b, c in part.mesh.faces:
            object_xml.append(f'<triangle v1="{a}" v2="{b}" v3="{c}" />')
        object_xml.append("</triangles></mesh></object>")
        build_items.append(f'<item objectid="{object_id}" />')
    colors = "".join(f'<m:color color="{color}" />' for color in _ordered_colors())
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
        f'<metadata name="Title">HSK Card Generator {escape(variant)}</metadata>'
        f'<metadata name="Application">HSK Card Generator Spike</metadata>'
        f"<resources><m:colorgroup id=\"1\">{colors}</m:colorgroup>{''.join(object_xml)}</resources>"
        f"<build>{''.join(build_items)}</build>"
        "</model>"
    )


def _assembly_model_xml(parts: list[Part], variant: str) -> str:
    object_xml: list[str] = []
    component_xml: list[str] = []
    for object_id, part in enumerate(parts, start=1):
        color = ROLE_COLORS.get(part.role, "#cccccc")
        object_xml.append(f'<object id="{object_id}" type="model" name="{escape(part.name)}" pid="1" pindex="{_color_index(color)}">')
        object_xml.append("<mesh><vertices>")
        for x, y, z in part.mesh.vertices:
            object_xml.append(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}" />')
        object_xml.append("</vertices><triangles>")
        for a, b, c in part.mesh.faces:
            object_xml.append(f'<triangle v1="{a}" v2="{b}" v3="{c}" />')
        object_xml.append("</triangles></mesh></object>")
        component_xml.append(f'<component objectid="{object_id}" />')

    assembly_id = len(parts) + 1
    colors = "".join(f'<m:color color="{color}" />' for color in _ordered_colors())
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
        f'<metadata name="Title">HSK Card Generator {escape(variant)}</metadata>'
        '<metadata name="Application">HSK Card Generator Spike</metadata>'
        f'<resources><m:colorgroup id="1">{colors}</m:colorgroup>'
        f'{"".join(object_xml)}'
        f'<object id="{assembly_id}" type="model" name="{escape(variant)}"><components>{"".join(component_xml)}</components></object>'
        f'</resources><build><item objectid="{assembly_id}" /></build></model>'
    )


def _single_object_model_xml(parts: list[Part], variant: str) -> str:
    vertices: list[tuple[float, float, float]] = []
    triangles: list[str] = []
    for part in parts:
        color = ROLE_COLORS.get(part.role, "#cccccc")
        color_index = _color_index(color)
        offset = len(vertices)
        vertices.extend(part.mesh.vertices)
        for a, b, c in part.mesh.faces:
            triangles.append(
                f'<triangle v1="{a + offset}" v2="{b + offset}" v3="{c + offset}" '
                f'pid="1" p1="{color_index}" p2="{color_index}" p3="{color_index}" />'
            )
    vertex_xml = "".join(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}" />' for x, y, z in vertices)
    colors = "".join(f'<m:color color="{color}" />' for color in _ordered_colors())
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<model unit="millimeter" xml:lang="en-US" '
        'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
        'xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
        f'<metadata name="Title">HSK Card Generator {escape(variant)}</metadata>'
        '<metadata name="Application">HSK Card Generator Spike</metadata>'
        f'<resources><m:colorgroup id="1">{colors}</m:colorgroup>'
        f'<object id="1" type="model" name="{escape(variant)}">'
        f'<mesh><vertices>{vertex_xml}</vertices><triangles>{"".join(triangles)}</triangles></mesh>'
        '</object></resources><build><item objectid="1" /></build></model>'
    )


def _ordered_colors() -> list[str]:
    return ["#ffffff", "#111111", "#777777", "#f2b600", "#dd3b2a", "#cccccc"]


def _color_index(color: str) -> int:
    try:
        return _ordered_colors().index(color)
    except ValueError:
        return len(_ordered_colors()) - 1


def _content_types() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '<Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '</Types>'
    )


def _rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
        'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
        '</Relationships>'
    )


def _readme(request: ExportRequest, words: list, layout: dict) -> str:
    lines = [
        "# HSK Card Generator Export",
        "",
        f"Printer: {request.printer.name} ({request.printer.widthMm} x {request.printer.depthMm} mm)",
        f"Card: {request.design.widthMm} x {request.design.heightMm} x {request.design.thicknessMm} mm",
        f"Layout: {layout['columns']} columns x {layout['rows']} rows, {layout['capacity']} cards/page",
        f"Pages per language: {layout['pageCount']}",
        f"Primary plate files: {len(request.languages) * layout['pageCount']} 3MF files in plates_3mf/ and {len(request.languages) * layout['pageCount']} STL files in plates_stl/",
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
        "",
        "## Word Mapping",
        "",
        "| # | Chinese | Pinyin | English | Russian | Hungarian |",
        "|---:|---|---|---|---|---|",
    ]
    for word in words:
        lines.append(f"| {word.index} | {word.chinese} | {word.pinyin} | {word.english} | {word.target} | {word.hungarian} |")
    return "\n".join(lines) + "\n"


def _request_to_json(request: ExportRequest) -> dict:
    return {
        "words": [word.to_dict() for word in request.words],
        "languages": request.languages,
        "rangeStart": request.rangeStart,
        "rangeEnd": request.rangeEnd,
        "printer": request.printer.__dict__,
        "design": request.design.__dict__,
        "formats": request.formats,
    }
