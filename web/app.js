const BASE_LANGUAGES = [
  ["chinese", "Chinese"],
  ["pinyin", "Pinyin"],
  ["english", "English"],
  ["target", "Russian"],
];

let previewMode = "front";
let words = [];
let latestLayout = null;
let pendingImportMode = "json";
let datasets = [];
let activeDatasetId = "hsk1_old";
let presets = [];
let datasetBaseWords = [];

const $ = (id) => document.getElementById(id);
const CORRECTIONS_KEY = "hsk-card-dataset-corrections";

async function init() {
  loadPresets();
  bindEvents();
  await loadDatasets();
  const saved = loadLocal();
  if (saved?.request?.datasetId) {
    applySavedRequest(saved.request);
    words = normalizeWords(saved.words);
    if (!words.length) {
      await loadDataset(activeDatasetId, { keepRange: true });
      return;
    }
    updateRangeBounds(words.length, false);
    await fillKnownTranslations();
    renderTable();
    renderCorrectionsStatus();
    await updatePreview();
  } else {
    await loadSample();
  }
}

function bindEvents() {
  $("loadSampleBtn").addEventListener("click", loadSample);
  $("loadOriginalBtn").addEventListener("click", () => loadDataset(activeDatasetId, { ignoreCorrections: true }));
  $("datasetSelect").addEventListener("change", () => loadDataset($("datasetSelect").value));
  $("importJsonBtn").addEventListener("click", () => openImport("json"));
  $("importCsvBtn").addEventListener("click", () => openImport("csv"));
  $("importCorrectionsBtn").addEventListener("click", () => openImport("corrections"));
  $("fileInput").addEventListener("change", handleFile);
  $("enrichBtn").addEventListener("click", enrich);
  $("regenerateBtn").addEventListener("click", regenerateAll);
  $("saveCorrectionsBtn").addEventListener("click", saveDatasetCorrections);
  $("exportCorrectionsBtn").addEventListener("click", exportDatasetCorrections);
  $("clearCorrectionsBtn").addEventListener("click", clearDatasetCorrections);
  $("exportBtn").addEventListener("click", exportZip);
  $("loadPresetBtn").addEventListener("click", loadSelectedPreset);
  $("savePresetBtn").addEventListener("click", saveCurrentPreset);
  $("deletePresetBtn").addEventListener("click", deleteSelectedPreset);
  $("presetSelect").addEventListener("change", () => {
    const preset = presets.find((item) => item.id === $("presetSelect").value);
    if (preset) $("presetName").value = preset.name;
  });
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      previewMode = button.dataset.mode;
      document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderPlates();
    });
  });
  document.querySelectorAll("input, select").forEach((input) => {
    if (!["fileInput", "datasetSelect"].includes(input.id)) input.addEventListener("input", schedulePreview);
  });
  bindRangePair("rangeStart", "rangeStartNumber");
  bindRangePair("rangeEnd", "rangeEndNumber");
  $("extraLanguagePreset").addEventListener("change", handleExtraLanguagePreset);
  $("extraLanguageLabel").addEventListener("input", () => {
    renderTable();
    renderPlates();
    saveLocal();
  });
  renderPresetSelect();
}

async function loadSample() {
  await loadDataset(activeDatasetId);
}

async function loadDatasets() {
  const response = await fetch("/api/datasets");
  const data = await response.json();
  datasets = data.ok ? data.datasets : [];
  const select = $("datasetSelect");
  select.innerHTML = datasets.map((dataset) => `<option value="${escapeAttr(dataset.id)}">${escapeHtml(dataset.label)} (${dataset.count})</option>`).join("");
  if (datasets.some((dataset) => dataset.id === activeDatasetId)) {
    select.value = activeDatasetId;
  }
}

async function loadDataset(datasetId, options = {}) {
  activeDatasetId = datasetId || activeDatasetId;
  $("datasetSelect").value = activeDatasetId;
  const response = await fetch(`/api/dataset/${encodeURIComponent(activeDatasetId)}`);
  const data = await response.json();
  if (!data.ok) return;
  words = normalizeWords(data.dataset.words);
  datasetBaseWords = normalizeWords(data.dataset.words);
  if (!options.ignoreCorrections) {
    words = applyDatasetCorrections(words, activeDatasetId);
  }
  updateRangeBounds(words.length, options.keepRange === true);
  renderTable();
  renderCorrectionsStatus();
  await updatePreview();
}

function openImport(mode) {
  pendingImportMode = mode;
  $("fileInput").value = "";
  $("fileInput").click();
}

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  if (pendingImportMode === "corrections") {
    importDatasetCorrections(JSON.parse(text));
    return;
  }
  words = pendingImportMode === "csv" ? parseCsv(text) : JSON.parse(text);
  words = normalizeWords(words);
  datasetBaseWords = [];
  activeDatasetId = "custom";
  updateRangeBounds(words.length, false);
  await fillKnownTranslations();
  renderTable();
  renderCorrectionsStatus();
  await updatePreview();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map((item) => item.trim().toLowerCase());
  return lines.map((line, index) => {
    const cells = line.split(",").map((item) => item.trim());
    const row = {};
    header.forEach((key, i) => (row[key] = cells[i] || ""));
    return {
      index: Number(row.index || index + 1),
      chinese: row.chinese || row.hanzi || row["汉字"] || "",
      pinyin: row.pinyin || "",
      english: row.english || "",
      target: row.target || row.russian || row.ru || "",
      hungarian: row.hungarian || row.hu || "",
      lockedFields: [],
    };
  });
}

function renderTable() {
  const headRow = $("wordTable").querySelector("thead tr");
  headRow.innerHTML = `
    <th>#</th>
    <th>汉字</th>
    <th>Pinyin</th>
    <th>English</th>
    <th>Russian</th>
    <th>${escapeHtml(extraLanguageLabel())}</th>
  `;
  const tbody = $("wordTable").querySelector("tbody");
  tbody.innerHTML = "";
  words.forEach((word, rowIndex) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${word.index}</td>
      ${["chinese", "pinyin", "english", "target", "hungarian"].map((field) => `<td><input value="${escapeAttr(word[field] || "")}" data-row="${rowIndex}" data-field="${field}" /></td>`).join("")}
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      const row = Number(input.dataset.row);
      const field = input.dataset.field;
      words[row][field] = input.value;
      if (["pinyin", "english", "target", "hungarian"].includes(field)) {
        words[row].lockedFields = Array.from(new Set([...(words[row].lockedFields || []), field]));
      }
      schedulePreview();
      saveLocal();
    });
  });
}

function bindRangePair(rangeId, numberId) {
  const range = $(rangeId);
  const number = $(numberId);
  range.addEventListener("input", () => {
    number.value = range.value;
    normalizeRangeOrder();
  });
  number.addEventListener("input", () => {
    range.value = number.value;
    normalizeRangeOrder();
  });
}

function normalizeRangeOrder() {
  const max = Math.max(1, words.length || 1);
  let start = clamp(Number($("rangeStartNumber").value) || 1, 1, max);
  let end = clamp(Number($("rangeEndNumber").value) || max, 1, max);
  if (start > end) {
    if (document.activeElement?.id === "rangeStart" || document.activeElement?.id === "rangeStartNumber") {
      end = start;
    } else {
      start = end;
    }
  }
  setRangeValues(start, end, max);
}

function updateRangeBounds(max, keepRange) {
  max = Math.max(1, max || 1);
  const start = keepRange ? clamp(Number($("rangeStartNumber").value) || 1, 1, max) : 1;
  const end = keepRange ? clamp(Number($("rangeEndNumber").value) || max, 1, max) : max;
  setRangeValues(Math.min(start, end), Math.max(start, end), max);
}

function setRangeValues(start, end, max) {
  for (const id of ["rangeStart", "rangeStartNumber", "rangeEnd", "rangeEndNumber"]) {
    $(id).min = 1;
    $(id).max = max;
  }
  $("rangeStart").value = start;
  $("rangeStartNumber").value = start;
  $("rangeEnd").value = end;
  $("rangeEndNumber").value = end;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function enrich() {
  const response = await fetch("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words }),
  });
  const data = await response.json();
  if (data.ok) {
    words = normalizeWords(data.words);
    renderTable();
    renderCorrectionsStatus();
    await updatePreview();
  }
}

async function regenerateAll() {
  clearTimeout(previewTimer);
  saveLocal();
  setCorrectionsStatus("Regenerating all plates from the current table...");
  await updatePreview();
  renderCorrectionsStatus();
}

let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 120);
}

async function updatePreview() {
  saveLocal();
  const response = await fetch("/api/layout/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRequest()),
  });
  const data = await response.json();
  latestLayout = data.layout;
  renderSummary();
  renderWarnings();
  renderPlates();
}

function buildRequest(overrides = {}) {
  return {
    words,
    datasetId: activeDatasetId,
    languages: activeLanguages().map(([id]) => id),
    rangeStart: numberValue("rangeStartNumber", 1),
    rangeEnd: numberValue("rangeEndNumber", words.length || 50),
    printer: {
      id: "bambu-a1-mini",
      name: "Bambu Lab A1 mini",
      widthMm: numberValue("plateWidth", 180),
      depthMm: numberValue("plateDepth", 180),
      marginMm: numberValue("plateMargin", 0),
    },
    design: {
      widthMm: numberValue("cardWidth", 30),
      heightMm: numberValue("cardHeight", 30),
      thicknessMm: numberValue("thickness", 2),
      cornerRadiusMm: numberValue("cornerRadius", 3),
      gapMm: numberValue("gap", 2.8),
      rows: autoOrNumber("rows"),
      columns: autoOrNumber("columns"),
      borderWidthMm: numberValue("borderWidth", 1),
      borderHeightMm: numberValue("borderHeight", 0.45),
      textHeightMm: numberValue("textHeight", 0.55),
      backNumberDepthMm: numberValue("backDepth", 0.4),
      backNumberMode: $("backMode").value,
      hanziGuideMode: $("hanziGuide").value,
      chineseTextScale: numberValue("chineseTextScale", 1),
      pinyinTextScale: numberValue("pinyinTextScale", 1),
      englishTextScale: numberValue("englishTextScale", 1),
      targetTextScale: numberValue("targetTextScale", 1),
      hungarianTextScale: numberValue("hungarianTextScale", 1),
      hanziGuideScale: numberValue("hanziGuideScale", 1),
    },
    formats: ["stl", "3mf", "zip"],
    ui: {
      extraLanguagePreset: $("extraLanguagePreset").value,
      extraLanguageLabel: extraLanguageLabel(),
    },
    ...overrides,
  };
}

function captureSettingsPreset() {
  const request = buildRequest();
  return {
    datasetId: request.datasetId,
    rangeStart: request.rangeStart,
    rangeEnd: request.rangeEnd,
    languages: request.languages,
    formats: request.formats,
    printer: request.printer,
    design: request.design,
    ui: request.ui,
  };
}

async function applySettingsPreset(preset) {
  if (!preset) return;
  const current = buildRequest();
  const shouldLoadDataset = preset.datasetId && preset.datasetId !== activeDatasetId && datasets.some((dataset) => dataset.id === preset.datasetId);
  applySavedRequest({
    ...current,
    ...preset,
    words: current.words,
    printer: preset.printer ?? current.printer,
    design: preset.design ?? current.design,
    ui: preset.ui ?? current.ui,
  });
  if (shouldLoadDataset) {
    await loadDataset(preset.datasetId, { keepRange: true });
    return;
  }
  renderTable();
  schedulePreview();
  saveLocal();
}

function numberValue(id, fallback) {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : fallback;
}

function autoOrNumber(id) {
  const value = $(id).value.trim().toLowerCase();
  if (!value || value === "auto") return "auto";
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : "auto";
}

function renderSummary() {
  if (!latestLayout) return;
  $("layoutSummary").textContent = `${latestLayout.columns} x ${latestLayout.rows}, ${latestLayout.capacity} cards/page, ${latestLayout.pageCount} page(s), used ${latestLayout.usedWidthMm} x ${latestLayout.usedDepthMm} mm`;
}

function renderWarnings() {
  const wrap = $("warnings");
  wrap.innerHTML = "";
  const warnings = latestLayout?.warnings || [];
  warnings.forEach((warning) => {
    const item = document.createElement("div");
    item.className = `warning ${warning.severity}`;
    item.textContent = warning.message;
    wrap.appendChild(item);
  });
}

function renderPlates() {
  const container = $("plates");
  container.innerHTML = "";
  if (!latestLayout) return;
  activeLanguages().forEach(([language, label]) => {
    const block = document.createElement("section");
    block.className = "language-block";
    block.innerHTML = `<div class="language-title"><h2>${label}</h2><p>${latestLayout.pageCount} page(s)</p></div><div class="page-grid"></div>`;
    const grid = block.querySelector(".page-grid");
    for (let page = 0; page < latestLayout.pageCount; page += 1) {
      const card = document.createElement("article");
      card.className = "plate-card";
      card.innerHTML = `<h3>Page ${page + 1}</h3>${plateSvg(language, page)}`;
      grid.appendChild(card);
    }
    container.appendChild(block);
  });
}

function plateSvg(language, page) {
  const printerW = numberValue("plateWidth", 180);
  const printerD = numberValue("plateDepth", 180);
  const positions = latestLayout.positions.filter((pos) => pos.page === page);
  const cards = positions.map((pos) => {
    const word = words.find((item) => item.index === pos.index) || {};
    const text = language === "chinese" ? word.chinese : language === "pinyin" ? word.pinyin : language === "english" ? word.english : language === "hungarian" ? word.hungarian : word.target;
    const displayText = text || "?";
    const number = String(pos.index).padStart(2, "0");
    const label = previewMode === "front" ? cardTextSvg(pos, language, displayText) : "";
    const externalNumber = previewMode === "front" ? `<text x="${pos.x + pos.width / 2}" y="${pos.y + pos.height + 4.5}" text-anchor="middle" font-size="3.2" fill="#111">${number}</text>` : "";
    return `
      <g>
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="#fff" stroke="#e3ad00" stroke-width="1.3" />
        ${language === "chinese" && previewMode === "front" ? guideSvg(pos) : ""}
        ${label}
        ${externalNumber}
        ${previewMode !== "front" ? backNumberSvg(pos, number) : ""}
      </g>
    `;
  });
  return `<svg class="plate-svg" viewBox="0 0 ${printerW} ${printerD}" aria-label="${language} page ${page + 1}">${cards.join("")}</svg>`;
}

function previewCornerRadius(pos) {
  return Math.min(Math.max(0, numberValue("cornerRadius", 3)), pos.width / 2, pos.height / 2);
}

function backNumberSvg(pos, number) {
  const x = pos.x + pos.width / 2;
  const y = pos.y + pos.height - 4;
  const rawY = pos.y + pos.height * 0.78;
  const mirrorAxisY = pos.y + pos.height / 2;
  const rawTransform = ` transform="translate(0 ${mirrorAxisY}) scale(1 -1) translate(0 ${-mirrorAxisY})"`;
  if (previewMode === "raw") {
    return `<text x="${x}" y="${rawY}" text-anchor="middle" font-size="7" font-weight="700" fill="#777"${rawTransform}>${number}</text>`;
  }
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="7" font-weight="700" fill="#777">${number}</text>`;
}

function cardTextSvg(pos, language, text) {
  const layout = fitTextLines(language, text, pos.width - scaledInset(pos) * 2.4, pos.height - scaledInset(pos) * 3.2, pos.width, pos.height);
  const x = pos.x + pos.width / 2;
  if (language === "chinese") {
    const chars = cjkChars(text);
    if (chars.length > 1 && chars.length <= 3) {
      const cells = hanziCellBoxes(pos, chars.length);
      return chars
        .map((char, index) => {
          const cell = cells[index];
          const cellLayout = fitTextLines(language, char, cell.width * 0.86, cell.height * 0.82, pos.width, pos.height);
          return `<text x="${cell.x + cell.width / 2}" y="${cell.y + cell.height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${cellLayout.fontSize}" font-weight="700" fill="#111">${escapeHtml(char)}</text>`;
        })
        .join("");
    }
    return `<text x="${x}" y="${pos.y + pos.height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${layout.fontSize}" font-weight="700" fill="#111">${escapeHtml(layout.lines[0])}</text>`;
  }
  const lineHeight = layout.fontSize * 1.15;
  const totalHeight = lineHeight * layout.lines.length;
  const firstY = pos.y + pos.height / 2 - totalHeight / 2 + layout.fontSize * 0.82;
  const tspans = layout.lines
    .map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeHtml(line)}</tspan>`)
    .join("");
  return `<text text-anchor="middle" font-size="${layout.fontSize}" font-weight="700" fill="#111">${tspans}</text>`;
}

function fitTextLines(language, rawText, maxWidth, maxHeight, cardWidth = 30, cardHeight = 30) {
  const text = String(rawText || "?").trim();
  const scale = previewTextScale(language);
  const cardScale = Math.max(0.35, Math.min(cardWidth, cardHeight) / 30);
  if (language === "chinese") {
    let size = (text.length > 2 ? 8.8 : text.length > 1 ? 10.8 : 15) * scale * cardScale;
    const maxInkWidth = maxWidth / Math.max(1, text.length * 0.92);
    size = Math.min(size, maxInkWidth, maxHeight * 0.82);
    return { lines: [text], fontSize: Number(size.toFixed(2)) };
  }

  const maxLines = language === "pinyin" ? 2 : 3;
  const startSize = (language === "pinyin" ? 6.4 : 5.2) * scale * cardScale;
  const minSize = (language === "pinyin" ? 3.8 : 2.7) * Math.min(1, cardScale);
  for (let size = startSize; size >= minSize; size -= 0.2) {
    const lines = wrapText(text, maxWidth, size, maxLines);
    const tallest = lines.length * size * 1.15;
    const widest = Math.max(...lines.map((line) => estimatedTextWidth(line, size)));
    if (lines.length <= maxLines && widest <= maxWidth && tallest <= maxHeight) {
      return { lines, fontSize: Number(size.toFixed(2)) };
    }
  }
  return { lines: wrapText(text, maxWidth, minSize, maxLines), fontSize: minSize };
}

function wrapText(text, maxWidth, fontSize, maxLines) {
  const tokens = tokenizeText(text);
  const lines = [];
  let current = "";
  for (const token of tokens) {
    const next = current ? `${current} ${token}` : token;
    if (estimatedTextWidth(next, fontSize) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = token;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const overflow = lines.slice(maxLines - 1).join(" ");
  kept[maxLines - 1] = ellipsizeToWidth(overflow, maxWidth, fontSize);
  return kept;
}

function tokenizeText(text) {
  return String(text || "")
    .replace(/\s*\/\s*/g, " / ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function estimatedTextWidth(text, fontSize) {
  let units = 0;
  for (const char of String(text || "")) {
    if (char === " ") units += 0.28;
    else if (char === "/") units += 0.35;
    else if (/[ilI.,]/.test(char)) units += 0.28;
    else if (/[mwшщюжфы]/i.test(char)) units += 0.78;
    else units += 0.58;
  }
  return units * fontSize;
}

function ellipsizeToWidth(text, maxWidth, fontSize) {
  let value = text;
  while (value.length > 1 && estimatedTextWidth(`${value}...`, fontSize) > maxWidth) {
    value = value.slice(0, -1).trimEnd();
  }
  return `${value}...`;
}

function guideSvg(pos) {
  const mode = $("hanziGuide").value;
  if (mode === "none") return "";
  const word = words.find((item) => item.index === pos.index) || {};
  const count = cjkChars(word.chinese || "").length;
  if (count > 3) return "";
  const cardScale = Math.max(0.35, Math.min(pos.width, pos.height) / 30);
  const cells = Math.max(1, count);
  const boxes = hanziCellBoxes(pos, cells);
  const guideScale = numberValue("hanziGuideScale", 1);
  const strokeMain = 0.35 * guideScale * cardScale;
  const strokeDiag = 0.3 * guideScale * cardScale;
  let svg = "";
  for (const cell of boxes) {
    svg += `
      <line x1="${cell.x + cell.width / 2}" y1="${cell.y}" x2="${cell.x + cell.width / 2}" y2="${cell.y + cell.height}" stroke="#d43f32" stroke-width="${strokeMain}" />
      <line x1="${cell.x}" y1="${cell.y + cell.height / 2}" x2="${cell.x + cell.width}" y2="${cell.y + cell.height / 2}" stroke="#d43f32" stroke-width="${strokeMain}" />
    `;
    if (mode === "mi_8") {
      svg += `
        <line x1="${cell.x}" y1="${cell.y}" x2="${cell.x + cell.width}" y2="${cell.y + cell.height}" stroke="#d43f32" stroke-width="${strokeDiag}" />
        <line x1="${cell.x + cell.width}" y1="${cell.y}" x2="${cell.x}" y2="${cell.y + cell.height}" stroke="#d43f32" stroke-width="${strokeDiag}" />
      `;
    }
  }
  return svg;
}

function hanziCellBoxes(pos, cells) {
  const cardScale = Math.max(0.35, Math.min(pos.width, pos.height) / 30);
  const guideScale = numberValue("hanziGuideScale", 1);
  const inset = Math.max(scaledInset(pos), numberValue("borderWidth", 1) + 0.3 * cardScale);
  const x = pos.x + inset;
  const y = pos.y + inset;
  const width = pos.width - inset * 2;
  const height = pos.height - inset * 2;
  const gap = cells > 1 ? 0.8 * guideScale * cardScale : 0;
  const cellWidth = (width - gap * (cells - 1)) / cells;
  return Array.from({ length: cells }, (_, index) => ({
    x: x + index * (cellWidth + gap),
    y,
    width: cellWidth,
    height,
  }));
}

function scaledInset(pos) {
  return Math.max(1.2, Math.min(pos.width, pos.height) * 0.073);
}

async function exportZip() {
  $("exportResult").textContent = "Exporting...";
  const response = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRequest()),
  });
  const data = await response.json();
  $("exportResult").innerHTML = data.ok
    ? `ZIP created:\n${escapeHtml(data.downloadPath)}\n\n<a href="/api/export/${data.jobId}/download">Download ZIP</a>`
    : `Export failed:\n${escapeHtml(data.error)}`;
}

function saveLocal() {
  localStorage.setItem("hsk-card-project", JSON.stringify({ words, request: buildRequest() }));
}

function loadAllCorrections() {
  try {
    const raw = localStorage.getItem(CORRECTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistAllCorrections(corrections) {
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
}

function activeCorrectionSet() {
  return loadAllCorrections()[activeDatasetId] || null;
}

function applyDatasetCorrections(sourceWords, datasetId) {
  const correctionSet = loadAllCorrections()[datasetId];
  if (!correctionSet?.entries) return sourceWords;
  return sourceWords.map((word) => {
    const patch = correctionSet.entries[String(word.index)];
    if (!patch) return word;
    return {
      ...word,
      ...Object.fromEntries(["chinese", "pinyin", "english", "target", "hungarian"].filter((field) => patch[field] !== undefined).map((field) => [field, patch[field]])),
      lockedFields: Array.from(new Set([...(word.lockedFields || []), ...(patch.lockedFields || [])])),
    };
  });
}

function buildDatasetCorrectionSet() {
  if (activeDatasetId === "custom") return null;
  const baseByIndex = new Map(datasetBaseWords.map((word) => [word.index, word]));
  const entries = {};
  for (const word of words) {
    const base = baseByIndex.get(word.index) || {};
    const patch = { chinese: word.chinese || base.chinese || "" };
    let changed = false;
    for (const field of ["chinese", "pinyin", "english", "target", "hungarian"]) {
      const currentValue = word[field] || "";
      const baseValue = base[field] || "";
      if (currentValue !== baseValue) {
        patch[field] = currentValue;
        changed = true;
      }
    }
    const lockedFields = (word.lockedFields || []).filter((field) => ["pinyin", "english", "target", "hungarian"].includes(field));
    if (lockedFields.length) {
      patch.lockedFields = lockedFields;
      changed = true;
    }
    if (changed) entries[String(word.index)] = patch;
  }
  return {
    version: 1,
    datasetId: activeDatasetId,
    updatedAt: new Date().toISOString(),
    entries,
  };
}

function saveDatasetCorrections() {
  if (activeDatasetId === "custom") {
    setCorrectionsStatus("Custom imports are saved as the current project, not as HSK set edits.");
    return;
  }
  const correctionSet = buildDatasetCorrectionSet();
  const all = loadAllCorrections();
  if (Object.keys(correctionSet.entries).length) all[activeDatasetId] = correctionSet;
  else delete all[activeDatasetId];
  persistAllCorrections(all);
  renderCorrectionsStatus();
}

function exportDatasetCorrections() {
  const correctionSet = activeCorrectionSet() || buildDatasetCorrectionSet();
  if (!correctionSet || activeDatasetId === "custom") {
    setCorrectionsStatus("No HSK set edits to export.");
    return;
  }
  const payload = {
    type: "hsk-card-generator-dataset-corrections",
    exportedAt: new Date().toISOString(),
    corrections: correctionSet,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${activeDatasetId}-edits.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setCorrectionsStatus(`Exported ${Object.keys(correctionSet.entries || {}).length} saved edit(s).`);
}

function importDatasetCorrections(payload) {
  const correctionSet = payload.corrections || payload;
  const datasetId = correctionSet.datasetId || activeDatasetId;
  if (!datasetId || !correctionSet.entries) {
    setCorrectionsStatus("Import failed: edits JSON has no datasetId or entries.");
    return;
  }
  const all = loadAllCorrections();
  all[datasetId] = {
    version: 1,
    ...correctionSet,
    datasetId,
    importedAt: new Date().toISOString(),
  };
  persistAllCorrections(all);
  if (datasetId === activeDatasetId && datasetBaseWords.length) {
    words = applyDatasetCorrections(datasetBaseWords.map((word) => ({ ...word })), activeDatasetId);
    renderTable();
    schedulePreview();
    saveLocal();
  }
  renderCorrectionsStatus();
}

function clearDatasetCorrections() {
  const all = loadAllCorrections();
  delete all[activeDatasetId];
  persistAllCorrections(all);
  renderCorrectionsStatus();
}

function renderCorrectionsStatus() {
  const set = activeCorrectionSet();
  const count = set?.entries ? Object.keys(set.entries).length : 0;
  setCorrectionsStatus(activeDatasetId === "custom" ? "Custom import: edits are stored in the current project." : `${count} saved HSK edit(s) for ${activeDatasetId}.`);
}

function setCorrectionsStatus(message) {
  const node = $("correctionsStatus");
  if (node) node.textContent = message || "";
}

function loadPresets() {
  try {
    const raw = localStorage.getItem("hsk-card-presets");
    presets = raw ? JSON.parse(raw) : defaultPresets();
    if (!Array.isArray(presets) || !presets.length) presets = defaultPresets();
  } catch {
    presets = defaultPresets();
  }
}

function persistPresets() {
  localStorage.setItem("hsk-card-presets", JSON.stringify(presets));
}

function renderPresetSelect() {
  const select = $("presetSelect");
  if (!select) return;
  select.innerHTML = presets.map((preset) => `<option value="${escapeAttr(preset.id)}">${escapeHtml(preset.name)}</option>`).join("");
  if (presets[0]) {
    select.value = presets[0].id;
    $("presetName").value = presets[0].name;
  }
}

function saveCurrentPreset() {
  const name = $("presetName").value.trim() || "My preset";
  const id = `user-${name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "") || Date.now()}`;
  const existingIndex = presets.findIndex((preset) => preset.name === name);
  const preset = { id: existingIndex >= 0 ? presets[existingIndex].id : id, name, ...captureSettingsPreset() };
  if (existingIndex >= 0) presets[existingIndex] = preset;
  else presets.unshift(preset);
  persistPresets();
  renderPresetSelect();
  $("presetSelect").value = preset.id;
}

async function loadSelectedPreset() {
  const preset = presets.find((item) => item.id === $("presetSelect").value);
  await applySettingsPreset(preset);
}

function deleteSelectedPreset() {
  const id = $("presetSelect").value;
  presets = presets.filter((item) => item.id !== id || item.builtin);
  persistPresets();
  renderPresetSelect();
}

function defaultPresets() {
  const base = {
    printer: { id: "bambu-a1-mini", name: "Bambu Lab A1 mini", widthMm: 180, depthMm: 180, marginMm: 0 },
    ui: { extraLanguagePreset: "hungarian", extraLanguageLabel: "Hungarian" },
  };
  return [
    {
      id: "builtin-a1-30",
      name: "A1 mini 30mm",
      builtin: true,
      ...base,
      design: defaultDesign({ widthMm: 30, heightMm: 30, gapMm: 2.8, rows: "auto", columns: "auto" }),
    },
    {
      id: "builtin-a1-25",
      name: "A1 mini compact 25mm",
      builtin: true,
      ...base,
      design: defaultDesign({ widthMm: 25, heightMm: 25, gapMm: 2.2, rows: "auto", columns: "auto", chineseTextScale: 0.95 }),
    },
    {
      id: "builtin-a1-wide",
      name: "Wide translation cards",
      builtin: true,
      ...base,
      design: defaultDesign({ widthMm: 35, heightMm: 24, gapMm: 2, rows: "auto", columns: "auto", englishTextScale: 0.95, targetTextScale: 0.9, hungarianTextScale: 0.9 }),
    },
  ];
}

function defaultDesign(overrides = {}) {
  return {
    widthMm: 30,
    heightMm: 30,
    thicknessMm: 2,
    cornerRadiusMm: 3,
    gapMm: 2.8,
    rows: "auto",
    columns: "auto",
    borderWidthMm: 1,
    borderHeightMm: 0.45,
    textHeightMm: 0.55,
    backNumberDepthMm: 0.4,
    backNumberMode: "deboss",
    hanziGuideMode: "tian_4",
    chineseTextScale: 1,
    pinyinTextScale: 1,
    englishTextScale: 1,
    targetTextScale: 1,
    hungarianTextScale: 1,
    hanziGuideScale: 1,
    ...overrides,
  };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("hsk-card-project");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applySavedRequest(request) {
  if (!request) return;
  const printer = request.printer || {};
  const design = request.design || {};
  const ui = request.ui || {};
  activeDatasetId = request.datasetId || "hsk1_old";
  if (datasets.some((dataset) => dataset.id === activeDatasetId)) {
    $("datasetSelect").value = activeDatasetId;
  }
  $("rangeStart").value = request.rangeStart ?? 1;
  $("rangeStartNumber").value = request.rangeStart ?? 1;
  $("rangeEnd").value = request.rangeEnd ?? 50;
  $("rangeEndNumber").value = request.rangeEnd ?? 50;
  $("plateWidth").value = printer.widthMm ?? 180;
  $("plateDepth").value = printer.depthMm ?? 180;
  $("plateMargin").value = printer.marginMm ?? 0;
  $("cardWidth").value = design.widthMm ?? 30;
  $("cardHeight").value = design.heightMm ?? 30;
  $("thickness").value = design.thicknessMm ?? 2;
  $("cornerRadius").value = design.cornerRadiusMm ?? 3;
  $("gap").value = design.gapMm ?? 2.8;
  $("rows").value = design.rows ?? "auto";
  $("columns").value = design.columns ?? "auto";
  $("borderWidth").value = design.borderWidthMm ?? 1;
  $("borderHeight").value = design.borderHeightMm ?? 0.45;
  $("textHeight").value = design.textHeightMm ?? 0.55;
  $("backDepth").value = design.backNumberDepthMm ?? 0.4;
  $("chineseTextScale").value = design.chineseTextScale ?? 1;
  $("pinyinTextScale").value = design.pinyinTextScale ?? 1;
  $("englishTextScale").value = design.englishTextScale ?? 1;
  $("targetTextScale").value = design.targetTextScale ?? 1;
  $("hungarianTextScale").value = design.hungarianTextScale ?? 1;
  $("hanziGuideScale").value = design.hanziGuideScale ?? 1;
  $("hanziGuide").value = design.hanziGuideMode ?? "tian_4";
  $("backMode").value = design.backNumberMode ?? "deboss";
  $("extraLanguagePreset").value = ui.extraLanguagePreset ?? "hungarian";
  $("extraLanguageLabel").value = ui.extraLanguageLabel || presetLanguageLabel($("extraLanguagePreset").value);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function cjkChars(text) {
  return Array.from(String(text || "")).filter((char) => char >= "\u3400" && char <= "\u9fff");
}

function previewTextScale(language) {
  if (language === "chinese") return numberValue("chineseTextScale", 1);
  if (language === "pinyin") return numberValue("pinyinTextScale", 1);
  if (language === "english") return numberValue("englishTextScale", 1);
  if (language === "hungarian") return numberValue("hungarianTextScale", 1);
  return numberValue("targetTextScale", 1);
}

function normalizeWords(rawWords) {
  return (rawWords || []).map((word, index) => ({
    index: Number(word.index || index + 1),
    chinese: word.chinese || "",
    pinyin: word.pinyin || "",
    english: word.english || "",
    target: word.target || word.russian || word.ru || "",
    hungarian: word.hungarian || word.hu || word.extra || "",
    lockedFields: word.lockedFields || [],
  }));
}

async function fillKnownTranslations() {
  if (!words.some((word) => !word.pinyin || !word.english || !word.target || !word.hungarian)) return;
  const response = await fetch("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words }),
  });
  const data = await response.json();
  if (data.ok) {
    words = normalizeWords(data.words);
  }
}

function activeLanguages() {
  return [...BASE_LANGUAGES, ["hungarian", extraLanguageLabel()]];
}

function extraLanguageLabel() {
  return $("extraLanguageLabel")?.value.trim() || presetLanguageLabel($("extraLanguagePreset")?.value || "hungarian");
}

function presetLanguageLabel(value) {
  const labels = {
    hungarian: "Hungarian",
    german: "German",
    spanish: "Spanish",
    french: "French",
    custom: "Custom",
  };
  return labels[value] || "Hungarian";
}

function handleExtraLanguagePreset() {
  const preset = $("extraLanguagePreset").value;
  if (preset !== "custom") {
    $("extraLanguageLabel").value = presetLanguageLabel(preset);
  }
  renderTable();
  renderPlates();
  saveLocal();
}

init();
