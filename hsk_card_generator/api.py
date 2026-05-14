from __future__ import annotations

from pathlib import Path

from hsk_card_generator.data import enrich_words, get_dataset, get_dataset_list, get_hsk1_sample
from hsk_card_generator.exporter import export_zip
from hsk_card_generator.layout import compute_layout
from hsk_card_generator.models import CardDesign, ExportRequest, PrinterProfile, WordEntry


def _words_from_payload(payload: dict) -> list[WordEntry]:
    raw_words = payload.get("words") or get_dataset(payload.get("datasetId")).get("words") or get_hsk1_sample()
    range_start = int(payload.get("rangeStart") or 1)
    range_end = int(payload.get("rangeEnd") or len(raw_words))
    words = [WordEntry.from_dict(item, i + 1) for i, item in enumerate(raw_words)]
    return [word for word in words if range_start <= word.index <= range_end]


def handle_preview(payload: dict) -> dict:
    words = _words_from_payload(payload)
    printer = PrinterProfile.from_dict(payload.get("printer"))
    design = CardDesign.from_dict(payload.get("design"))
    layout = compute_layout(words, printer, design)
    languages = payload.get("languages") or ["chinese", "pinyin", "english", "target", "hungarian"]
    layout["languages"] = languages
    layout["cards"] = [word.to_dict() for word in words]
    return {"ok": True, "layout": layout}


def handle_datasets() -> dict:
    return {"ok": True, "datasets": get_dataset_list()}


def handle_dataset(dataset_id: str) -> dict:
    return {"ok": True, "dataset": get_dataset(dataset_id)}


def handle_enrich(payload: dict) -> dict:
    raw_words = payload.get("words") or []
    return {"ok": True, "words": enrich_words(raw_words)}


def handle_export(payload: dict) -> dict:
    request = ExportRequest.from_dict(payload)
    if not request.words:
        request.words = [WordEntry.from_dict(item, i + 1) for i, item in enumerate(get_hsk1_sample())]
    return export_zip(request)


def handle_export_status(job_id: str) -> dict:
    zip_path = Path("exports") / job_id / "hsk-card-generator-export.zip"
    if zip_path.exists():
        return {"ok": True, "jobId": job_id, "status": "complete", "downloadPath": str(zip_path.resolve())}
    return {"ok": False, "jobId": job_id, "status": "missing"}
