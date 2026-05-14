from __future__ import annotations

import json
import unittest
import zipfile
from pathlib import Path

from hsk_card_generator.data import HSK1_SAMPLE
from hsk_card_generator.exporter import build_3mf, build_3mf_assembly, build_3mf_single_object, export_zip
from hsk_card_generator.geometry import build_card_parts
from hsk_card_generator.layout import CardPosition
from hsk_card_generator.models import CardDesign, ExportRequest, PrinterProfile, WordEntry


class ExporterTests(unittest.TestCase):
    def test_hanzi_text_mesh_is_real_geometry(self) -> None:
        design = CardDesign()
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design)
        text = next(part for part in parts if part.role == "frontText")
        self.assertGreater(len(text.mesh.faces), 100)

    def test_front_text_uses_3d_y_up_orientation(self) -> None:
        design = CardDesign()
        pos = CardPosition(7, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[6], "chinese", pos, design)
        text = next(part for part in parts if part.role == "frontText")
        ys = [y for _, y, _ in text.mesh.vertices]
        self.assertGreater(max(ys), design.heightMm * 0.6)
        self.assertLess(min(ys), design.heightMm * 0.5)

    def test_chinese_text_ink_bbox_is_centered_on_card(self) -> None:
        design = CardDesign()
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design)
        text = next(part for part in parts if part.role == "frontText")
        xs = [x for x, _, _ in text.mesh.vertices]
        ys = [y for _, y, _ in text.mesh.vertices]
        center_x = (min(xs) + max(xs)) / 2
        center_y = (min(ys) + max(ys)) / 2
        self.assertAlmostEqual(center_x, design.widthMm / 2, delta=0.4)
        self.assertAlmostEqual(center_y, design.heightMm / 2, delta=0.4)

    def test_two_hanzi_get_two_guide_cells(self) -> None:
        design = CardDesign()
        pos = CardPosition(21, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[20], "chinese", pos, design)
        guide = next(part for part in parts if part.role == "hanziGuide")
        self.assertGreaterEqual(len(guide.mesh.faces), 48)
        xs = [x for x, _, _ in guide.mesh.vertices]
        self.assertLess(min(xs), design.widthMm * 0.15)
        self.assertGreater(max(xs), design.widthMm * 0.85)

    def test_two_hanzi_text_centers_align_with_guide_cells(self) -> None:
        design = CardDesign()
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        word = WordEntry(index=1, chinese="飞机")
        parts = build_card_parts(word, "chinese", pos, design)
        text = next(part for part in parts if part.role == "frontText")
        left_xs = [x for x, _, _ in text.mesh.vertices if x < design.widthMm / 2]
        right_xs = [x for x, _, _ in text.mesh.vertices if x > design.widthMm / 2]
        left_center = (min(left_xs) + max(left_xs)) / 2
        right_center = (min(right_xs) + max(right_xs)) / 2
        inset = design.widthMm * 0.073
        gap = 0.8
        cell_width = (design.widthMm - inset * 2 - gap) / 2
        expected_left = inset + cell_width / 2
        expected_right = inset + cell_width + gap + cell_width / 2
        self.assertAlmostEqual(left_center, expected_left, delta=0.35)
        self.assertAlmostEqual(right_center, expected_right, delta=0.35)

    def test_chinese_text_scale_changes_export_geometry(self) -> None:
        small = CardDesign(chineseTextScale=0.7)
        large = CardDesign(chineseTextScale=1.3)
        pos = CardPosition(1, 0, 0, 0, 0, 0, small.widthMm, small.heightMm)
        small_text = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", pos, small) if part.role == "frontText")
        large_text = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", pos, large) if part.role == "frontText")
        small_width = max(x for x, _, _ in small_text.mesh.vertices) - min(x for x, _, _ in small_text.mesh.vertices)
        large_width = max(x for x, _, _ in large_text.mesh.vertices) - min(x for x, _, _ in large_text.mesh.vertices)
        self.assertGreater(large_width, small_width)

    def test_hanzi_guide_scale_changes_export_geometry(self) -> None:
        small = CardDesign(hanziGuideScale=0.7)
        large = CardDesign(hanziGuideScale=1.4)
        pos = CardPosition(1, 0, 0, 0, 0, 0, small.widthMm, small.heightMm)
        small_guide = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", pos, small) if part.role == "hanziGuide")
        large_guide = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", pos, large) if part.role == "hanziGuide")
        small_height = max(z for _, _, z in small_guide.mesh.vertices) - min(z for _, _, z in small_guide.mesh.vertices)
        large_height = max(z for _, _, z in large_guide.mesh.vertices) - min(z for _, _, z in large_guide.mesh.vertices)
        self.assertGreater(large_height, small_height)

    def test_hanzi_guide_export_scales_with_card_size(self) -> None:
        small = CardDesign(widthMm=25, heightMm=25)
        large = CardDesign(widthMm=35, heightMm=35)
        small_pos = CardPosition(1, 0, 0, 0, 0, 0, small.widthMm, small.heightMm)
        large_pos = CardPosition(1, 0, 0, 0, 0, 0, large.widthMm, large.heightMm)
        small_guide = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", small_pos, small) if part.role == "hanziGuide")
        large_guide = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", large_pos, large) if part.role == "hanziGuide")
        small_width = max(x for x, _, _ in small_guide.mesh.vertices) - min(x for x, _, _ in small_guide.mesh.vertices)
        large_width = max(x for x, _, _ in large_guide.mesh.vertices) - min(x for x, _, _ in large_guide.mesh.vertices)
        self.assertGreater(large_width, small_width * 1.25)
        self.assertAlmostEqual(min(x for x, _, _ in large_guide.mesh.vertices), 35 * 0.073, delta=0.05)

    def test_hanzi_guide_export_uses_preview_inset_for_default_card(self) -> None:
        design = CardDesign()
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        guide = next(part for part in build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design) if part.role == "hanziGuide")
        self.assertAlmostEqual(min(x for x, _, _ in guide.mesh.vertices), 30 * 0.073, delta=0.05)

    def test_hanzi_guide_and_text_are_embedded_into_card_surface(self) -> None:
        design = CardDesign()
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design)
        text = next(part for part in parts if part.role == "frontText")
        guide = next(part for part in parts if part.role == "hanziGuide")
        self.assertLess(min(z for _, _, z in text.mesh.vertices), design.thicknessMm)
        self.assertLess(min(z for _, _, z in guide.mesh.vertices), design.thicknessMm)
        self.assertGreater(max(z for _, _, z in text.mesh.vertices), design.thicknessMm)
        self.assertGreater(max(z for _, _, z in guide.mesh.vertices), design.thicknessMm)
        guide_widths = [abs(guide.mesh.vertices[face[1]][0] - guide.mesh.vertices[face[0]][0]) for face in guide.mesh.faces]
        self.assertTrue(any(width >= 0.34 for width in guide_widths))

    def test_export_base_has_rounded_corners(self) -> None:
        design = CardDesign(cornerRadiusMm=3)
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design)
        base = next(part for part in parts if part.role == "base")
        near_origin = [(x, y) for x, y, _ in base.mesh.vertices if x < 0.5 and y < 0.5]
        self.assertEqual(near_origin, [])

    def test_export_border_has_rounded_corners(self) -> None:
        design = CardDesign(cornerRadiusMm=3)
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design)
        border = next(part for part in parts if part.role == "border")
        near_origin = [(x, y) for x, y, _ in border.mesh.vertices if x < 0.5 and y < 0.5]
        self.assertEqual(near_origin, [])

    def test_plain_deboss_integrates_back_number_into_base(self) -> None:
        design = CardDesign()
        pos = CardPosition(12, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[11], "chinese", pos, design)
        self.assertNotIn("backNumber", {part.role for part in parts})
        base = next(part for part in parts if part.role == "base")
        zs = {round(z, 6) for _, _, z in base.mesh.vertices}
        self.assertIn(0, zs)
        self.assertIn(round(design.backNumberDepthMm, 6), zs)
        self.assertIn(round(design.thicknessMm, 6), zs)

    def test_colored_back_number_keeps_digit_order_and_flips_vertically(self) -> None:
        design = CardDesign(backNumberMode="deboss_colored")
        pos = CardPosition(12, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[11], "chinese", pos, design)
        back = next(part for part in parts if part.role == "backNumber")
        one_xs = [x for x, _, _ in back.mesh.vertices[: 2 * 8]]
        two_xs = [x for x, _, _ in back.mesh.vertices[2 * 8 :]]
        self.assertLess(max(one_xs), min(two_xs))
        self.assertGreater(min(y for _, y, _ in back.mesh.vertices), design.heightMm / 2)
        self.assertEqual(min(z for _, _, z in back.mesh.vertices), 0)
        self.assertAlmostEqual(max(z for _, _, z in back.mesh.vertices), design.backNumberDepthMm)

    def test_3mf_is_valid_zip_with_model(self) -> None:
        design = CardDesign()
        pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_card_parts(HSK1_SAMPLE[0], "chinese", pos, design)
        data = build_3mf(parts, "test")
        path = Path("exports/test_unit.3mf")
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(data)
        with zipfile.ZipFile(path) as archive:
            self.assertIn("3D/3dmodel.model", archive.namelist())
            model = archive.read("3D/3dmodel.model").decode("utf-8")
            self.assertIn("unit=\"millimeter\"", model)
            self.assertIn("colorgroup", model)

    def test_whole_plate_3mf_is_single_large_object(self) -> None:
        design = CardDesign(rows=2, columns=2)
        all_parts = []
        for i, word in enumerate(HSK1_SAMPLE[:4]):
            pos = CardPosition(word.index, 0, i // 2, i % 2, (i % 2) * 32.8, (i // 2) * 32.8, design.widthMm, design.heightMm)
            all_parts.extend(build_card_parts(word, "chinese", pos, design))
        data = build_3mf_single_object(all_parts, "single")
        path = Path("exports/test_single_unit.3mf")
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(data)
        with zipfile.ZipFile(path) as archive:
            model = archive.read("3D/3dmodel.model").decode("utf-8")
            self.assertEqual(model.count("<object "), 1)
            self.assertIn('unit="millimeter"', model)
            self.assertIn('pid="1"', model)

    def test_whole_plate_layer_3mf_has_role_objects(self) -> None:
        request = ExportRequest(
            words=HSK1_SAMPLE[:4],
            languages=["chinese"],
            rangeStart=1,
            rangeEnd=4,
            printer=PrinterProfile(),
            design=CardDesign(rows=2, columns=2, backNumberMode="deboss_colored"),
            formats=["stl", "3mf", "zip"],
        )
        result = export_zip(request)
        with zipfile.ZipFile(result["downloadPath"]) as outer:
            data = outer.read("plates_3mf/chinese_page_01.3mf")
        layer_path = Path("exports/test_layers.3mf")
        layer_path.write_bytes(data)
        with zipfile.ZipFile(layer_path) as archive:
            model = archive.read("3D/3dmodel.model").decode("utf-8")
            self.assertEqual(model.count("<component "), 5)
            self.assertEqual(model.count("<build><item "), 1)
            for role in ["base", "frontText", "backNumber", "border", "hanziGuide"]:
                self.assertIn(role, model)

    def test_assembly_3mf_has_one_build_item_and_components(self) -> None:
        design = CardDesign(rows=2, columns=2, backNumberMode="deboss_colored")
        layer_parts = []
        for role in ["base", "frontText", "backNumber", "border"]:
            pos = CardPosition(1, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
            part = next(item for item in build_card_parts(HSK1_SAMPLE[0], "english", pos, design) if item.role == role)
            layer_parts.append(part)
        data = build_3mf_assembly(layer_parts, "assembly")
        path = Path("exports/test_assembly.3mf")
        path.write_bytes(data)
        with zipfile.ZipFile(path) as archive:
            model = archive.read("3D/3dmodel.model").decode("utf-8")
            self.assertEqual(model.count("<component "), 4)
            self.assertIn("<components>", model)
            self.assertEqual(model.count("<build><item "), 1)

    def test_default_primary_3mf_omits_separate_back_number_layer(self) -> None:
        request = ExportRequest(
            words=HSK1_SAMPLE[:4],
            languages=["english"],
            rangeStart=1,
            rangeEnd=4,
            printer=PrinterProfile(),
            design=CardDesign(rows=2, columns=2),
            formats=["stl", "3mf", "zip"],
        )
        result = export_zip(request)
        with zipfile.ZipFile(result["downloadPath"]) as outer:
            data = outer.read("plates_3mf/english_page_01.3mf")
            manifest = json.loads(outer.read("MANIFEST.json").decode("utf-8"))
        layer_path = Path("exports/test_default_layers.3mf")
        layer_path.write_bytes(data)
        with zipfile.ZipFile(layer_path) as archive:
            model = archive.read("3D/3dmodel.model").decode("utf-8")
            self.assertNotIn("backNumber", model)
            self.assertEqual(model.count("<component "), 3)
        self.assertEqual(manifest["plates"][0]["layers"], ["base", "frontText", "border"])
        self.assertEqual(manifest["plates"][0]["backNumberDeboss"], "integratedInBase")

    def test_export_zip_contains_expected_artifacts(self) -> None:
        request = ExportRequest(
            words=HSK1_SAMPLE[:4],
            languages=["chinese", "pinyin", "english", "target", "hungarian"],
            rangeStart=1,
            rangeEnd=4,
            printer=PrinterProfile(),
            design=CardDesign(rows=2, columns=2),
            formats=["stl", "3mf", "zip"],
        )
        result = export_zip(request)
        self.assertTrue(result["ok"], json.dumps(result, ensure_ascii=False))
        with zipfile.ZipFile(result["downloadPath"]) as archive:
            names = set(archive.namelist())
            self.assertIn("README.md", names)
            self.assertIn("MANIFEST.json", names)
            self.assertIn("plates_3mf/chinese_page_01.3mf", names)
            self.assertIn("plates_3mf/english_page_01.3mf", names)
            self.assertIn("plates_3mf/hungarian_page_01.3mf", names)
            self.assertIn("3mf_whole_plate_single/chinese/page_01.3mf", names)
            self.assertIn("3mf_whole_plate_per_card_objects/chinese/page_01.3mf", names)
            self.assertIn("3mf/hsk_parts_per_card.3mf", names)
            self.assertIn("3mf/hsk_each_card_separate.3mf", names)
            self.assertIn("3mf/hsk_plate_role_grouping.3mf", names)
            self.assertIn("plates_stl/chinese_page_01.stl", names)
            self.assertIn("stl_plate_roles/chinese/page_01/base.stl", names)
            self.assertIn("stl_plate_roles/chinese/page_01/hanziGuide.stl", names)

    def test_primary_plate_file_count_matches_preview_pages(self) -> None:
        request = ExportRequest(
            words=HSK1_SAMPLE,
            languages=["chinese", "pinyin", "english", "target", "hungarian"],
            rangeStart=1,
            rangeEnd=50,
            printer=PrinterProfile(),
            design=CardDesign(),
            formats=["stl", "3mf", "zip"],
        )
        result = export_zip(request)
        with zipfile.ZipFile(result["downloadPath"]) as archive:
            names = archive.namelist()
            primary_3mf = [name for name in names if name.startswith("plates_3mf/") and name.endswith(".3mf")]
            primary_stl = [name for name in names if name.startswith("plates_stl/") and name.endswith(".stl")]
            self.assertEqual(len(primary_3mf), 10)
            self.assertEqual(len(primary_stl), 10)


if __name__ == "__main__":
    unittest.main()
