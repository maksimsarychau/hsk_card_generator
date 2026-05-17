from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


Language = Literal["chinese", "pinyin", "english", "target", "hungarian"]
SUPPORTED_LANGUAGES = {"chinese", "pinyin", "english", "target", "hungarian"}
LockedField = Literal["pinyin", "english", "target", "hungarian"]
HanziGuideMode = Literal["none", "tian_4", "mi_8"]
BackNumberMode = Literal["deboss", "deboss_colored"]
TextRenderMode = Literal["raster_blocks", "raster_fine", "proxy_blocks"]
RowsColumns = int | Literal["auto"]
GameMode = Literal["flashcards", "matching", "memory", "pair_cards", "domino", "modular_expansion", "mixed_challenge"]
DominoDensity = Literal["compact", "target_count", "complete_cycle"]
DominoNormalMode = Literal["sequential"]
DominoRulesMode = Literal["training", "game", "chaos"]


@dataclass
class WordEntry:
    index: int
    chinese: str
    pinyin: str = ""
    english: str = ""
    target: str = ""
    hungarian: str = ""
    lockedFields: list[LockedField] = field(default_factory=list)
    overrides: dict[str, dict[str, Any]] = field(default_factory=dict)

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
            overrides=dict(data.get("overrides") or {}),
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
            "overrides": self.overrides,
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
    textRenderMode: TextRenderMode = "raster_blocks"
    pinyinLineChars: int = 12
    englishLineChars: int = 10
    targetLineChars: int = 10
    hungarianLineChars: int = 11

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

        def integer(key: str, default: int) -> int:
            value = data.get(key)
            return default if value is None or value == "" else max(1, int(value))

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
            textRenderMode=data.get("textRenderMode") or "raster_blocks",
            pinyinLineChars=integer("pinyinLineChars", 12),
            englishLineChars=integer("englishLineChars", 10),
            targetLineChars=integer("targetLineChars", 10),
            hungarianLineChars=integer("hungarianLineChars", 11),
        )


@dataclass
class DominoSettings:
    density: DominoDensity = "compact"
    normalMode: DominoNormalMode = "sequential"
    doublesBehavior: str = "branch"
    circular: bool = True
    targetTileCount: int = 30
    languageOrder: list[str] = field(default_factory=lambda: ["chinese", "pinyin", "english", "target", "hungarian"])
    rulesMode: DominoRulesMode = "training"
    includeRules: bool = True
    rulesLanguage: str = "ru"

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "DominoSettings":
        data = data or {}
        target = data.get("targetTileCount")
        try:
            target_count = max(1, int(target))
        except (TypeError, ValueError):
            target_count = 30
        language_order = [str(item) for item in data.get("languageOrder") or ["chinese", "pinyin", "english", "target", "hungarian"]]
        return cls(
            density=data.get("density") or "compact",
            normalMode=data.get("normalMode") or "sequential",
            doublesBehavior=data.get("doublesBehavior") or "branch",
            circular=bool(data.get("circular", True)),
            targetTileCount=target_count,
            languageOrder=language_order,
            rulesMode=data.get("rulesMode") or "training",
            includeRules=bool(data.get("includeRules", True)),
            rulesLanguage=str(data.get("rulesLanguage") or "ru"),
        )


@dataclass
class PlateLabelSettings:
    mode: Literal["none", "visible"] = "none"
    textTemplate: str = "{dataset} {range} {mode} p{page}"
    heightMm: float = 0.28

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "PlateLabelSettings":
        data = data or {}
        value = data.get("heightMm")
        try:
            height = max(0.05, float(value))
        except (TypeError, ValueError):
            height = 0.28
        return cls(
            mode="visible" if data.get("mode") == "visible" else "none",
            textTemplate=str(data.get("textTemplate") or "{dataset} {range} {mode} p{page}"),
            heightMm=height,
        )


@dataclass
class PrintProfileSettings:
    target: str = "bambu_a1_mini"
    layerHeightMm: float = 0.16
    nozzleMm: float = 0.4
    materialSaver: bool = True
    includeBambuMetadata: bool = True

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "PrintProfileSettings":
        data = data or {}

        def number(key: str, default: float) -> float:
            value = data.get(key)
            try:
                return default if value is None or value == "" else float(value)
            except (TypeError, ValueError):
                return default

        return cls(
            target=str(data.get("target") or "bambu_a1_mini"),
            layerHeightMm=number("layerHeightMm", 0.16),
            nozzleMm=number("nozzleMm", 0.4),
            materialSaver=bool(data.get("materialSaver", True)),
            includeBambuMetadata=bool(data.get("includeBambuMetadata", True)),
        )


@dataclass
class TextFitSettings:
    mode: Literal["auto_max", "manual"] = "auto_max"
    minReadableMm: float = 3.0
    maxLines: int = 3

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "TextFitSettings":
        data = data or {}
        return cls(
            mode="manual" if data.get("mode") == "manual" else "auto_max",
            minReadableMm=float(data.get("minReadableMm") or 3.0),
            maxLines=max(1, int(data.get("maxLines") or 3)),
        )


@dataclass
class SimulatorSettings:
    enabled: bool = True
    playerCount: int = 2
    handSize: int = 5
    seed: int = 1
    drawPile: bool = True

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "SimulatorSettings":
        data = data or {}
        return cls(
            enabled=bool(data.get("enabled", True)),
            playerCount=max(1, int(data.get("playerCount") or 2)),
            handSize=max(1, int(data.get("handSize") or 5)),
            seed=int(data.get("seed") or 1),
            drawPile=bool(data.get("drawPile", True)),
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
    gameMode: GameMode = "flashcards"
    domino: DominoSettings = field(default_factory=DominoSettings)
    colors: dict[str, str] = field(default_factory=dict)
    datasetId: str = "custom"
    plateLabel: PlateLabelSettings = field(default_factory=PlateLabelSettings)
    printProfile: PrintProfileSettings = field(default_factory=PrintProfileSettings)
    textFit: TextFitSettings = field(default_factory=TextFitSettings)
    simulator: SimulatorSettings = field(default_factory=SimulatorSettings)
    ui: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ExportRequest":
        raw_words = data.get("words") or []
        words = [WordEntry.from_dict(item, i + 1) for i, item in enumerate(raw_words)]
        game_mode = data.get("gameMode") or "flashcards"
        plate_label = PlateLabelSettings.from_dict(data.get("plateLabel"))
        if data.get("plateLabel") is None and game_mode != "flashcards":
            plate_label.mode = "visible"
        languages = [item for item in (data.get("languages") or ["chinese", "pinyin", "english", "target", "hungarian"]) if item in SUPPORTED_LANGUAGES]
        return cls(
            words=words,
            languages=languages or ["chinese", "pinyin", "english", "target", "hungarian"],
            rangeStart=int(data.get("rangeStart") or 1),
            rangeEnd=int(data.get("rangeEnd") or max(1, len(words))),
            printer=PrinterProfile.from_dict(data.get("printer")),
            design=CardDesign.from_dict(data.get("design")),
            formats=list(data.get("formats") or ["stl", "3mf", "zip"]),
            gameMode=game_mode,
            domino=DominoSettings.from_dict(data.get("domino")),
            colors=dict(data.get("colors") or {}),
            datasetId=str(data.get("datasetId") or "custom"),
            plateLabel=plate_label,
            printProfile=PrintProfileSettings.from_dict(data.get("printProfile")),
            textFit=TextFitSettings.from_dict(data.get("textFit")),
            simulator=SimulatorSettings.from_dict(data.get("simulator")),
            ui=dict(data.get("ui") or {}),
        )
