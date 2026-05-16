from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import random

from hsk_card_generator.models import DominoSettings, SimulatorSettings, WordEntry


LANGUAGE_LABELS = {
    "chinese": "Chinese",
    "pinyin": "Pinyin",
    "english": "English",
    "target": "Russian",
    "hungarian": "Hungarian",
}


@dataclass(frozen=True)
class TileHalf:
    wordId: int
    languageCode: str
    text: str

    def to_dict(self) -> dict[str, Any]:
        return {"wordId": self.wordId, "languageCode": self.languageCode, "text": self.text}


@dataclass(frozen=True)
class TilePlan:
    cardId: int
    tileType: str
    left: TileHalf
    right: TileHalf
    backIds: tuple[int, int]
    generationMode: str
    rulesMode: str
    branchPoint: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "cardId": self.cardId,
            "tileType": self.tileType,
            "left": self.left.to_dict(),
            "right": self.right.to_dict(),
            "backIds": list(self.backIds),
            "generationMode": self.generationMode,
            "rulesMode": self.rulesMode,
            "branchPoint": self.branchPoint,
        }


def build_domino_tiles(words: list[WordEntry], settings: DominoSettings) -> list[TilePlan]:
    languages = _valid_language_order(settings.languageOrder)
    if len(languages) < 2 or not words:
        return []
    if settings.density == "complete_cycle":
        return _complete_cycle_tiles(words, settings, languages)
    if settings.density == "target_count":
        return _target_count_tiles(words, settings, languages)
    return _compact_tiles(words, settings, languages)


def build_game_tiles(words: list[WordEntry], game_mode: str, settings: DominoSettings) -> list[TilePlan]:
    if game_mode in ("domino", "modular_expansion"):
        return build_domino_tiles(words, settings)
    languages = _valid_language_order(settings.languageOrder)
    if len(languages) < 2 or not words:
        return []
    if game_mode == "pair_cards":
        return _same_word_pair_tiles(words, settings, languages)
    if game_mode == "mixed_challenge":
        return _mixed_challenge_tiles(words, settings, languages)
    return []


def build_game_plan(words: list[WordEntry], game_mode: str, settings: DominoSettings, simulator: SimulatorSettings) -> dict[str, Any]:
    tiles = build_game_tiles(words, game_mode, settings)
    if game_mode in ("matching", "memory", "flashcards"):
        deck = [
            {
                "cardId": len(deck) + 1 if "deck" in locals() else 1,
                "wordId": word.index,
                "languageCode": language,
                "text": tile_text(word, language).strip() or "?",
            }
            for word in words
            for language in _valid_language_order(settings.languageOrder)
        ]
        for i, card in enumerate(deck, start=1):
            card["cardId"] = i
        return {
            "gameMode": game_mode,
            "cardCount": len(deck),
            "cards": deck,
            "simulator": _simulate_cards(deck, simulator) if simulator.enabled else None,
            "rulesSummary": _rules_summary(game_mode),
        }
    return {
        "gameMode": game_mode,
        "tileCount": len(tiles),
        "tiles": [tile.to_dict() for tile in tiles],
        "simulator": _simulate_tiles(tiles, simulator) if simulator.enabled else None,
        "rulesSummary": _rules_summary(game_mode),
    }


def language_label(code: str) -> str:
    return LANGUAGE_LABELS.get(code, code)


def tile_text(word: WordEntry, language: str) -> str:
    if language == "chinese":
        return word.chinese
    if language == "pinyin":
        return word.pinyin
    if language == "english":
        return word.english
    if language == "hungarian":
        return word.hungarian
    return word.target


def _valid_language_order(language_order: list[str]) -> list[str]:
    result: list[str] = []
    for language in language_order:
        if language in LANGUAGE_LABELS and language not in result:
            result.append(language)
    return result


def _compact_tiles(words: list[WordEntry], settings: DominoSettings, languages: list[str]) -> list[TilePlan]:
    tiles: list[TilePlan] = []
    double_left, double_right = languages[0], languages[1]
    bridge_left = languages[1]
    bridge_right = languages[0] if len(languages) == 2 else languages[2]
    for word in words:
        tiles.append(
            _tile(
                card_id=len(tiles) + 1,
                tile_type="double",
                left_word=word,
                left_language=double_left,
                right_word=word,
                right_language=double_right,
                settings=settings,
                branch_point=True,
            )
        )
    bridge_count = len(words) if settings.circular and len(words) > 1 else max(0, len(words) - 1)
    for i in range(bridge_count):
        left_word = words[i]
        right_word = words[(i + 1) % len(words)]
        tiles.append(
            _tile(
                card_id=len(tiles) + 1,
                tile_type="normal",
                left_word=left_word,
                left_language=bridge_left,
                right_word=right_word,
                right_language=bridge_right,
                settings=settings,
            )
        )
    return tiles


def _target_count_tiles(words: list[WordEntry], settings: DominoSettings, languages: list[str]) -> list[TilePlan]:
    compact = _compact_tiles(words, settings, languages)
    if len(compact) >= settings.targetTileCount:
        return compact[: settings.targetTileCount]
    cycle = _complete_cycle_tiles(words, settings, languages)
    seen = {(tile.left.wordId, tile.left.languageCode, tile.right.wordId, tile.right.languageCode) for tile in compact}
    result = list(compact)
    for tile in cycle:
        key = (tile.left.wordId, tile.left.languageCode, tile.right.wordId, tile.right.languageCode)
        if key in seen:
            continue
        result.append(
            TilePlan(
                cardId=len(result) + 1,
                tileType=tile.tileType,
                left=tile.left,
                right=tile.right,
                backIds=tile.backIds,
                generationMode=tile.generationMode,
                rulesMode=tile.rulesMode,
                branchPoint=tile.branchPoint,
            )
        )
        if len(result) >= settings.targetTileCount:
            break
    return result


def _complete_cycle_tiles(words: list[WordEntry], settings: DominoSettings, languages: list[str]) -> list[TilePlan]:
    tiles: list[TilePlan] = []
    edges = list(zip(languages, languages[1:] + [languages[0]]))
    for word in words:
        for left_language, right_language in edges:
            tiles.append(
                _tile(
                    card_id=len(tiles) + 1,
                    tile_type="double",
                    left_word=word,
                    left_language=left_language,
                    right_word=word,
                    right_language=right_language,
                    settings=settings,
                    branch_point=True,
                )
            )
    return tiles


def _same_word_pair_tiles(words: list[WordEntry], settings: DominoSettings, languages: list[str]) -> list[TilePlan]:
    tiles: list[TilePlan] = []
    edges = list(zip(languages, languages[1:] + [languages[0]]))
    for word in words:
        for left_language, right_language in edges[: max(1, min(len(edges), settings.targetTileCount or len(edges)))]:
            tiles.append(
                _tile(
                    card_id=len(tiles) + 1,
                    tile_type="double",
                    left_word=word,
                    left_language=left_language,
                    right_word=word,
                    right_language=right_language,
                    settings=settings,
                    branch_point=True,
                )
            )
    return tiles


def _mixed_challenge_tiles(words: list[WordEntry], settings: DominoSettings, languages: list[str]) -> list[TilePlan]:
    tiles: list[TilePlan] = []
    if len(words) < 2:
        return _same_word_pair_tiles(words, settings, languages)
    for i, word in enumerate(words):
        next_word = words[(i * 2 + 1) % len(words)]
        left_language = languages[i % len(languages)]
        right_language = languages[(i + 2) % len(languages)]
        tile_type = "challenge" if i % 5 == 4 else "normal"
        tiles.append(_tile(len(tiles) + 1, tile_type, word, left_language, next_word, right_language, settings))
    return tiles


def _tile(
    card_id: int,
    tile_type: str,
    left_word: WordEntry,
    left_language: str,
    right_word: WordEntry,
    right_language: str,
    settings: DominoSettings,
    branch_point: bool = False,
) -> TilePlan:
    return TilePlan(
        cardId=card_id,
        tileType=tile_type,
        left=TileHalf(left_word.index, left_language, tile_text(left_word, left_language).strip() or "?"),
        right=TileHalf(right_word.index, right_language, tile_text(right_word, right_language).strip() or "?"),
        backIds=(left_word.index, right_word.index),
        generationMode=settings.density,
        rulesMode=settings.rulesMode,
        branchPoint=branch_point,
    )


def _simulate_tiles(tiles: list[TilePlan], settings: SimulatorSettings) -> dict[str, Any]:
    deck = [tile.to_dict() for tile in tiles]
    rng = random.Random(settings.seed)
    rng.shuffle(deck)
    hands = _deal(deck, settings.playerCount, settings.handSize)
    draw_start = settings.playerCount * settings.handSize
    open_ends = []
    if deck:
        start_tile = deck[0]
        open_ends = [
            {"side": "left", "wordId": start_tile["left"]["wordId"], "tileId": start_tile["cardId"]},
            {"side": "right", "wordId": start_tile["right"]["wordId"], "tileId": start_tile["cardId"]},
        ]
    return {
        "seed": settings.seed,
        "playerCount": settings.playerCount,
        "handSize": settings.handSize,
        "hands": hands,
        "drawPile": deck[draw_start:] if settings.drawPile else [],
        "openEnds": open_ends,
        "legalMoves": _legal_moves(hands, open_ends),
        "scoring": [{"event": "double_branch_bonus", "points": 2}, {"event": "empty_hand", "points": 10}],
    }


def _simulate_cards(cards: list[dict[str, Any]], settings: SimulatorSettings) -> dict[str, Any]:
    deck = [dict(card) for card in cards]
    rng = random.Random(settings.seed)
    rng.shuffle(deck)
    hands = _deal(deck, settings.playerCount, settings.handSize)
    return {
        "seed": settings.seed,
        "playerCount": settings.playerCount,
        "handSize": settings.handSize,
        "hands": hands,
        "drawPile": deck[settings.playerCount * settings.handSize :] if settings.drawPile else [],
        "legalMoves": [{"rule": "match_same_word_id", "wordId": card["wordId"]} for card in deck[: min(8, len(deck))]],
        "scoring": [{"event": "matched_set", "points": 1}],
    }


def _deal(deck: list[dict[str, Any]], players: int, hand_size: int) -> list[dict[str, Any]]:
    return [
        {"player": player + 1, "cards": deck[player * hand_size : (player + 1) * hand_size]}
        for player in range(players)
    ]


def _legal_moves(hands: list[dict[str, Any]], open_ends: list[dict[str, Any]]) -> list[dict[str, Any]]:
    moves: list[dict[str, Any]] = []
    open_ids = {end["wordId"] for end in open_ends}
    for hand in hands:
        for tile in hand["cards"]:
            for side in ("left", "right"):
                half = tile.get(side, {})
                if half.get("wordId") in open_ids:
                    moves.append({"player": hand["player"], "tileId": tile["cardId"], "side": side, "matchesWordId": half["wordId"]})
    return moves


def _rules_summary(game_mode: str) -> str:
    summaries = {
        "flashcards": "Read the visible side, recall the matching representations, then verify by hidden ID.",
        "matching": "Collect all cards that share the same semantic word ID.",
        "memory": "Flip cards and keep sets that share the same semantic word ID.",
        "pair_cards": "Use two-sided language pairs as compact same-word tiles.",
        "domino": "Place tiles so touching halves share a semantic word ID; doubles create branch points.",
        "modular_expansion": "Add new language edge tiles without reprinting older packs.",
        "mixed_challenge": "Languages and word IDs are mixed; match by meaning only.",
    }
    return summaries.get(game_mode, summaries["domino"])
