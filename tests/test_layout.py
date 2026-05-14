from __future__ import annotations

import unittest

from hsk_card_generator.data import HSK1_SAMPLE, get_dataset
from hsk_card_generator.layout import compute_layout
from hsk_card_generator.models import CardDesign, PrinterProfile


class LayoutTests(unittest.TestCase):
    def test_default_30mm_a1_mini_splits_50_into_two_pages(self) -> None:
        layout = compute_layout(HSK1_SAMPLE, PrinterProfile(), CardDesign())
        self.assertEqual(layout["columns"], 5)
        self.assertEqual(layout["rows"], 5)
        self.assertEqual(layout["capacity"], 25)
        self.assertEqual(layout["pageCount"], 2)
        self.assertTrue(layout["valid"])

    def test_35_by_24_has_a_30_card_capacity(self) -> None:
        design = CardDesign(widthMm=35, heightMm=24, gapMm=1, rows="auto", columns="auto")
        layout = compute_layout(HSK1_SAMPLE[:30], PrinterProfile(), design)
        self.assertEqual(layout["columns"], 5)
        self.assertEqual(layout["rows"], 7)
        self.assertGreaterEqual(layout["capacity"], 30)
        self.assertTrue(layout["valid"])

    def test_manual_overflow_is_invalid(self) -> None:
        design = CardDesign(widthMm=30, heightMm=30, gapMm=2.8, rows=10, columns=5)
        layout = compute_layout(HSK1_SAMPLE, PrinterProfile(), design)
        self.assertFalse(layout["valid"])
        self.assertTrue(any(w["code"] == "layout_overflow" for w in layout["warnings"]))

    def test_builtin_dataset_counts_match_range_maximums(self) -> None:
        self.assertEqual(get_dataset("hsk1_old")["count"], 150)
        self.assertEqual(get_dataset("hsk2_old")["count"], 300)
        self.assertEqual(get_dataset("hsk1_new")["count"], 300)
        self.assertEqual(get_dataset("hsk2_new")["count"], 497)

    def test_card_design_from_dict_preserves_zero_settings(self) -> None:
        design = CardDesign.from_dict(
            {
                "cornerRadiusMm": 0,
                "borderWidthMm": 0,
                "plateMargin": 0,
                "gapMm": 0,
            }
        )
        self.assertEqual(design.cornerRadiusMm, 0)
        self.assertEqual(design.borderWidthMm, 0)
        self.assertEqual(design.gapMm, 0)

    def test_printer_profile_from_dict_preserves_zero_margin(self) -> None:
        printer = PrinterProfile.from_dict({"marginMm": 0, "widthMm": 180, "depthMm": 180})
        self.assertEqual(printer.marginMm, 0)


if __name__ == "__main__":
    unittest.main()
