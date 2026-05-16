from __future__ import annotations

import json
import re
import unittest
import zipfile
from io import BytesIO

from hsk_card_generator.data import HSK1_SAMPLE
from hsk_card_generator.domino import build_domino_tiles
from hsk_card_generator.exporter import export_zip
from hsk_card_generator.geometry import build_domino_tile_parts
from hsk_card_generator.layout import CardPosition
from hsk_card_generator.models import CardDesign, DominoSettings, ExportRequest, PlateLabelSettings, PrinterProfile


class DominoTests(unittest.TestCase):
    def test_compact_deck_generates_doubles_and_sequential_bridges(self) -> None:
        settings = DominoSettings(languageOrder=["chinese", "pinyin", "english"], circular=True)
        tiles = build_domino_tiles(HSK1_SAMPLE[:4], settings)
        self.assertEqual(len(tiles), 8)
        doubles = [tile for tile in tiles if tile.tileType == "double"]
        normals = [tile for tile in tiles if tile.tileType == "normal"]
        self.assertEqual(len(doubles), 4)
        self.assertEqual(len(normals), 4)
        self.assertTrue(all(tile.left.wordId == tile.right.wordId for tile in doubles))
        self.assertTrue(all(tile.branchPoint for tile in doubles))
        self.assertEqual((normals[0].left.wordId, normals[0].right.wordId), (1, 2))
        self.assertEqual((normals[-1].left.wordId, normals[-1].right.wordId), (4, 1))

    def test_complete_cycle_uses_language_order(self) -> None:
        settings = DominoSettings(density="complete_cycle", languageOrder=["chinese", "pinyin", "english"], circular=True)
        tiles = build_domino_tiles(HSK1_SAMPLE[:2], settings)
        edges = [(tile.left.languageCode, tile.right.languageCode) for tile in tiles[:3]]
        self.assertEqual(edges, [("chinese", "pinyin"), ("pinyin", "english"), ("english", "chinese")])

    def test_domino_geometry_has_divider_and_two_back_numbers(self) -> None:
        settings = DominoSettings(languageOrder=["chinese", "pinyin", "english"], circular=True)
        tile = build_domino_tiles(HSK1_SAMPLE[:2], settings)[-1]
        design = CardDesign(widthMm=60, heightMm=30, thicknessMm=2.2, gapMm=1, backNumberMode="deboss_colored")
        pos = CardPosition(tile.cardId, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
        parts = build_domino_tile_parts(tile, pos, design)
        roles = {part.role for part in parts}
        self.assertIn("divider", roles)
        self.assertIn("frontText", roles)
        self.assertIn("backNumber", roles)
        back = next(part for part in parts if part.role == "backNumber")
        self.assertEqual(min(z for _, _, z in back.mesh.vertices), 0)
        self.assertAlmostEqual(max(z for _, _, z in back.mesh.vertices), design.backNumberDepthMm)
        xs = [x for x, _, _ in back.mesh.vertices]
        self.assertLess(min(xs), design.widthMm / 2)
        self.assertGreater(max(xs), design.widthMm / 2)

    def test_domino_base_thickness_changes_geometry_bounds(self) -> None:
        settings = DominoSettings(languageOrder=["chinese", "pinyin", "english"], circular=True)
        tile = build_domino_tiles(HSK1_SAMPLE[:2], settings)[0]
        heights = []
        for thickness in (1.2, 3.4):
            design = CardDesign(widthMm=60, heightMm=30, thicknessMm=thickness, gapMm=1)
            pos = CardPosition(tile.cardId, 0, 0, 0, 0, 0, design.widthMm, design.heightMm)
            base = next(part for part in build_domino_tile_parts(tile, pos, design) if part.role == "base")
            heights.append(max(z for _, _, z in base.mesh.vertices))
        self.assertEqual(heights, [1.2, 3.4])

    def test_domino_export_stl_and_3mf_bounds_follow_thickness(self) -> None:
        heights = []
        for thickness in (1.0, 4.0):
            request = ExportRequest(
                words=HSK1_SAMPLE[:3],
                languages=["chinese", "pinyin", "english"],
                rangeStart=1,
                rangeEnd=3,
                printer=PrinterProfile(),
                design=CardDesign(widthMm=60, heightMm=30, thicknessMm=thickness, gapMm=1, rows=1, columns=2, hanziGuideMode="none"),
                formats=["stl", "3mf", "zip"],
                gameMode="domino",
                domino=DominoSettings(languageOrder=["chinese", "pinyin", "english"], circular=True),
            )
            result = export_zip(request)
            self.assertTrue(result["ok"], json.dumps(result, ensure_ascii=False))
            with zipfile.ZipFile(result["downloadPath"]) as archive:
                stl = archive.read("plates_stl/domino_page_01.stl").decode("utf-8")
                stl_z = [float(match.group(1)) for match in re.finditer(r"vertex\s+[-0-9.]+\s+[-0-9.]+\s+([-0-9.]+)", stl)]
                with zipfile.ZipFile(BytesIO(archive.read("plates_3mf/domino_page_01.3mf"))) as model_archive:
                    model = model_archive.read("3D/3dmodel.model").decode("utf-8")
                model_z = [float(match.group(1)) for match in re.finditer(r'z="([-0-9.]+)"', model)]
                manifest = json.loads(archive.read("MANIFEST.json").decode("utf-8"))
            heights.append((max(stl_z), max(model_z), manifest["dimensions"]["baseThicknessMm"]))
        self.assertEqual(heights[0][2], 1.0)
        self.assertEqual(heights[1][2], 4.0)
        self.assertGreater(heights[1][0], heights[0][0] + 2.9)
        self.assertGreater(heights[1][1], heights[0][1] + 2.9)

    def test_domino_export_contains_tile_plan_answer_sheet_rules_and_manifest(self) -> None:
        request = ExportRequest(
            words=HSK1_SAMPLE[:4],
            languages=["chinese", "pinyin", "english"],
            rangeStart=1,
            rangeEnd=4,
            printer=PrinterProfile(),
            design=CardDesign(widthMm=60, heightMm=30, thicknessMm=2.2, gapMm=1, rows=2, columns=2),
            formats=["stl", "3mf", "zip"],
            gameMode="domino",
            domino=DominoSettings(languageOrder=["chinese", "pinyin", "english"], includeRules=True, rulesLanguage="ru"),
            colors={"roles": {"divider": "#00aaff", "doubleMarker": "#ffaa00"}},
            datasetId="hsk1_old",
            plateLabel=PlateLabelSettings(mode="visible"),
        )
        result = export_zip(request)
        self.assertTrue(result["ok"], json.dumps(result, ensure_ascii=False))
        with zipfile.ZipFile(result["downloadPath"]) as archive:
            names = set(archive.namelist())
            self.assertIn("source/tile-plan.json", names)
            self.assertIn("source/card-plan.json", names)
            self.assertIn("source/game-plan.json", names)
            self.assertIn("answer_sheets/domino.md", names)
            self.assertIn("answer_sheets/domino.csv", names)
            self.assertIn("answer_sheets/domino.json", names)
            self.assertIn("print_profiles/bambu_a1_mini_quality.md", names)
            self.assertIn("print_profiles/profile-summary.json", names)
            self.assertIn("rules/ru/domino_beginner.md", names)
            self.assertIn("plates_3mf/domino_page_01.3mf", names)
            manifest = json.loads(archive.read("MANIFEST.json").decode("utf-8"))
            self.assertEqual(manifest["gameMode"], "domino")
            self.assertEqual(manifest["tileCount"], 8)
            self.assertEqual(manifest["colors"]["divider"], "#00aaff")
            self.assertEqual(manifest["dimensions"]["baseThicknessMm"], 2.2)
            self.assertGreater(manifest["dimensions"]["totalModelHeightMm"], 2.2)
            self.assertIn("plateLabel", manifest["plates"][0]["layers"])
            self.assertIn("divider", manifest["plates"][0]["layers"])
            model_data = archive.read("plates_3mf/domino_page_01.3mf")
        import io

        with zipfile.ZipFile(io.BytesIO(model_data)) as model_zip:
            model = model_zip.read("3D/3dmodel.model").decode("utf-8")
            self.assertIn("RecommendedLayerHeightMm", model)
            self.assertIn("hsk1_old_001-004_domino_domino_page_01", model)

    def test_matching_exports_single_printable_game_deck(self) -> None:
        request = ExportRequest(
            words=HSK1_SAMPLE[:3],
            languages=["chinese", "pinyin", "english"],
            rangeStart=1,
            rangeEnd=3,
            printer=PrinterProfile(),
            design=CardDesign(rows=2, columns=4),
            formats=["stl", "3mf", "zip"],
            gameMode="matching",
            domino=DominoSettings(languageOrder=["chinese", "pinyin", "english"], includeRules=True, rulesLanguage="en"),
        )
        result = export_zip(request)
        self.assertTrue(result["ok"], json.dumps(result, ensure_ascii=False))
        with zipfile.ZipFile(result["downloadPath"]) as archive:
            names = set(archive.namelist())
            self.assertIn("plates_3mf/matching_page_01.3mf", names)
            self.assertIn("plates_stl/matching_page_01.stl", names)
            self.assertIn("answer_sheets/matching.md", names)
            manifest = json.loads(archive.read("MANIFEST.json").decode("utf-8"))
        self.assertEqual(manifest["plateCount"], 2)
        self.assertEqual(manifest["layout"]["pageCount"], 2)
        self.assertEqual(manifest["plates"][0]["language"], "matching")

    def test_game_plan_simulator_is_deterministic(self) -> None:
        from hsk_card_generator.domino import build_game_plan
        from hsk_card_generator.models import SimulatorSettings

        settings = DominoSettings(languageOrder=["chinese", "pinyin", "english"], circular=True)
        simulator = SimulatorSettings(seed=42, playerCount=2, handSize=3)
        first = build_game_plan(HSK1_SAMPLE[:6], "domino", settings, simulator)
        second = build_game_plan(HSK1_SAMPLE[:6], "domino", settings, simulator)
        self.assertEqual(first["simulator"]["hands"], second["simulator"]["hands"])
        self.assertIn("legalMoves", first["simulator"])


if __name__ == "__main__":
    unittest.main()
