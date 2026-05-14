from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


Language = Literal["chinese", "pinyin", "english", "target", "hungarian"]
LockedField = Literal["pinyin", "english", "target", "hungarian"]
HanziGuideMode = Literal["none", "tian_4", "mi_8"]
BackNumberMode = Literal["deboss", "deboss_colored"]
RowsColumns = int | Literal["auto"]


@dataclass
class WordEntry:
    index: int
    chinese: str
    pinyin: str = ""
    english: str = ""
    target: str = ""
    hungarian: str = ""
    lockedFields: list[LockedField] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any], fallback_index: int = 1) -> "WordEntry":
        return cls(
            index=int(data.get("index") or fallback_index),
            chinese=str(data.get("chinese") or ""),
            pinyin=str(data.get("pinyin") or ""),
            english=str(data.get("english") or ""),
            target=str(data.get("target") or data.get("russian") or ""),
            hungarian=str(data.get("hungarian") or data.get("hu") or ""),
            lockedFields=list(data.get("lockedFields") or []),
        )

    def text_for(self, language: Language) -> str:
        if language == "chinese":
            return self.chinese
        if language == "pinyin":
            return self.pinyin
        if language == "english":
            return self.english
        if language == "hungarian":
            return self.hungarian
        return self.target

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "chinese": self.chinese,
            "pinyin": self.pinyin,
            "english": self.english,
            "target": self.target,
            "hungarian": self.hungarian,
            "lockedFields": self.lockedFields,
        }


@dataclass
class PrinterProfile:
    id: str = "bambu-a1-mini"
    name: str = "Bambu Lab A1 mini"
    widthMm: float = 180.0
    depthMm: float = 180.0
    marginMm: float = 0.0

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "PrinterProfile":
        data = data or {}

        def number(key: str, default: float) -> float:
            value = data.get(key)
            return default if value is None or value == "" else float(value)

        return cls(
            id=str(data.get("id") or "bambu-a1-mini"),
            name=str(data.get("name") or "Bambu Lab A1 mini"),
            widthMm=number("widthMm", 180.0),
            depthMm=number("depthMm", 180.0),
            marginMm=number("marginMm", 0.0),
        )


@dataclass
class CardDesign:
    widthMm: float = 30.0
    heightMm: float = 30.0
    thicknessMm: float = 2.0
    cornerRadiusMm: float = 3.0
    gapMm: float = 2.8
    rows: RowsColumns = "auto"
    columns: RowsColumns = "auto"
    borderWidthMm: float = 1.0
    borderHeightMm: float = 0.45
    textHeightMm: float = 0.55
    backNumberDepthMm: float = 0.4
    backNumberMode: BackNumberMode = "deboss"
    hanziGuideMode: HanziGuideMode = "tian_4"
    chineseTextScale: float = 1.0
    pinyinTextScale: float = 1.0
    englishTextScale: float = 1.0
    targetTextScale: float = 1.0
    hungarianTextScale: float = 1.0
    hanziGuideScale: float = 1.0

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "CardDesign":
        data = data or {}

        def rows_cols(value: Any) -> RowsColumns:
            if value == "auto" or value is None or value == "":
                return "auto"
            return max(1, int(value))

        def number(key: str, default: float) -> float:
            value = data.get(key)
            return default if value is None or value == "" else float(value)

        return cls(
            widthMm=number("widthMm", 30.0),
            heightMm=number("heightMm", 30.0),
            thicknessMm=number("thicknessMm", 2.0),
            cornerRadiusMm=number("cornerRadiusMm", 3.0),
            gapMm=number("gapMm", 2.8),
            rows=rows_cols(data.get("rows", "auto")),
            columns=rows_cols(data.get("columns", "auto")),
            borderWidthMm=number("borderWidthMm", 1.0),
            borderHeightMm=number("borderHeightMm", 0.45),
            textHeightMm=number("textHeightMm", 0.55),
            backNumberDepthMm=number("backNumberDepthMm", 0.4),
            backNumberMode=data.get("backNumberMode") or "deboss",
            hanziGuideMode=data.get("hanziGuideMode") or "tian_4",
            chineseTextScale=number("chineseTextScale", 1.0),
            pinyinTextScale=number("pinyinTextScale", 1.0),
            englishTextScale=number("englishTextScale", 1.0),
            targetTextScale=number("targetTextScale", 1.0),
            hungarianTextScale=number("hungarianTextScale", 1.0),
            hanziGuideScale=number("hanziGuideScale", 1.0),
        )


@dataclass
class ExportRequest:
    words: list[WordEntry]
    languages: list[Language]
    rangeStart: int
    rangeEnd: int
    printer: PrinterProfile
    design: CardDesign
    formats: list[str]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ExportRequest":
        raw_words = data.get("words") or []
        words = [WordEntry.from_dict(item, i + 1) for i, item in enumerate(raw_words)]
        return cls(
            words=words,
            languages=list(data.get("languages") or ["chinese", "pinyin", "english", "target", "hungarian"]),
            rangeStart=int(data.get("rangeStart") or 1),
            rangeEnd=int(data.get("rangeEnd") or max(1, len(words))),
            printer=PrinterProfile.from_dict(data.get("printer")),
            design=CardDesign.from_dict(data.get("design")),
            formats=list(data.get("formats") or ["stl", "3mf", "zip"]),
        )
