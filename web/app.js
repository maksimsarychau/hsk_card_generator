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
let uiLanguage = localStorage.getItem("hsk-card-ui-language") || "ru";
let activeInspector = null;

const $ = (id) => document.getElementById(id);
const CORRECTIONS_KEY = "hsk-card-dataset-corrections";
const MODULE_STATE_KEY = "hsk-card-module-state";
const TRANSLATION_FIELDS = ["english", "target", "hungarian"];

const I18N = {
  en: {
    simulator: "Simulator",
    noSimulator: "Enable Simulator to preview hands, draw pile, open ends, and legal moves.",
    simulatorIntro: "Change game mode, seed, players, or hand size to rebuild this deterministic simulator.",
    hands: "Hands",
    drawPile: "Draw pile",
    openEnds: "Open ends",
    legalMoves: "Legal moves",
    rules: "Rules and mode help",
    close: "Close",
    help: "Help",
    model3d: "3D model",
    front2d: "Front preview",
    side: "Side profile",
    scale: "scale",
    project: "Project",
    gameEngine: "Game Engine",
    vocabularyTable: "Vocabulary table",
    presets: "Presets",
    printerCard: "Printer and card",
    textGeometry: "Text and geometry",
    exportPrint: "Export and print",
    tileColors: "Tile colors",
    applyRecommendations: "Apply recommendations",
    recommendationHint: "Recommended text is used for cards. Manual edits are preserved when max length changes.",
  },
  ru: {
    simulator: "Симулятор",
    noSimulator: "Включи Simulator, чтобы увидеть руки игроков, добор, открытые концы и допустимые ходы.",
    simulatorIntro: "Меняй режим, seed, игроков или размер руки: симулятор пересобирается детерминированно.",
    hands: "Руки",
    drawPile: "Добор",
    openEnds: "Открытые концы",
    legalMoves: "Допустимые ходы",
    rules: "Правила и справка по режиму",
    close: "Закрыть",
    help: "Справка",
    model3d: "3D модель",
    front2d: "Превью лицевой стороны",
    side: "Профиль сбоку",
    scale: "масштаб",
    project: "Проект",
    gameEngine: "Игровой движок",
    vocabularyTable: "Таблица слов",
    presets: "Пресеты",
    printerCard: "Принтер и карточка",
    textGeometry: "Текст и геометрия",
    exportPrint: "Экспорт и печать",
    tileColors: "Цвета костей",
    applyRecommendations: "Применить рекомендации",
    recommendationHint: "Recommended-текст используется для карточек. Ручные правки сохраняются при изменении лимита.",
  },
};

const LABEL_I18N = {
  datasetSelect: ["HSK set", "Набор HSK"],
  uiLanguage: ["UI", "Интерфейс"],
  rangeStart: ["Range start", "Начало диапазона"],
  rangeEnd: ["Range end", "Конец диапазона"],
  extraLanguagePreset: ["Extra language", "Доп. язык"],
  extraLanguageLabel: ["Label", "Название"],
  gameMode: ["Mode", "Режим"],
  rulesLanguage: ["Rules language", "Язык правил"],
  dominoDensity: ["Deck density", "Плотность колоды"],
  dominoNormalMode: ["Normal tiles", "Обычные кости"],
  targetTileCount: ["Target tiles", "Целевое число"],
  dominoCircular: ["Circular chain", "Кольцевая цепочка"],
  includeRules: ["Include game rules", "Включить правила"],
  simulatorEnabled: ["Simulator", "Симулятор"],
  playerCount: ["Players", "Игроки"],
  handSize: ["Hand size", "Размер руки"],
  simSeed: ["Seed", "Seed"],
  languageOrder: ["Language order", "Порядок языков"],
  presetSelect: ["Preset", "Пресет"],
  presetName: ["Name", "Название"],
  plateWidth: ["Plate W", "Ширина пластины"],
  plateDepth: ["Plate D", "Глубина пластины"],
  plateMargin: ["Margin", "Отступ"],
  cardWidth: ["Card W", "Ширина карточки"],
  cardHeight: ["Card H", "Высота карточки"],
  thickness: ["Thickness", "Толщина"],
  cornerRadius: ["Corner R", "Радиус углов"],
  gap: ["Gap", "Зазор"],
  rows: ["Rows", "Строки"],
  columns: ["Columns", "Колонки"],
  borderWidth: ["Border W", "Ширина ободка"],
  borderHeight: ["Border H", "Высота ободка"],
  textHeight: ["Text H", "Высота текста"],
  backDepth: ["Back depth", "Глубина номера"],
  chineseTextScale: ["Chinese scale", "Масштаб Chinese"],
  pinyinTextScale: ["Pinyin scale", "Масштаб Pinyin"],
  englishTextScale: ["English scale", "Масштаб English"],
  targetTextScale: ["Russian scale", "Масштаб Russian"],
  hungarianTextScale: ["Hungarian scale", "Масштаб Hungarian"],
  hanziGuideScale: ["Hanzi guide scale", "Масштаб сетки ханзи"],
  hanziGuide: ["Hanzi guide", "Сетка ханзи"],
  backMode: ["Back number", "Номер сзади"],
  plateLabelMode: ["Plate label", "Подпись пластины"],
  plateLabelHeight: ["Label H", "Высота подписи"],
  layerHeight: ["Layer H", "Высота слоя"],
  nozzle: ["Nozzle", "Сопло"],
  materialSaver: ["Material saver", "Экономия материала"],
  textFitMode: ["Text fit", "Подгонка текста"],
  englishMaxChars: ["English max chars", "Макс. English"],
  targetMaxChars: ["Russian max chars", "Макс. Russian"],
  hungarianMaxChars: ["Extra max chars", "Макс. доп. язык"],
  colorBase: ["Base", "Основа"],
  colorText: ["Text", "Текст"],
  colorBorder: ["Border", "Ободок"],
  colorDivider: ["Divider", "Разделитель"],
  colorDoubleMarker: ["Double", "Дубль"],
  colorHanziGuide: ["Hanzi", "Ханзи"],
};

const BUTTON_I18N = {
  loadSampleBtn: ["Reload set", "Перезагрузить набор"],
  loadOriginalBtn: ["Load original", "Чистый оригинал"],
  importJsonBtn: ["Import JSON", "Импорт JSON"],
  importCsvBtn: ["Import CSV", "Импорт CSV"],
  enrichBtn: ["Enrich", "Заполнить"],
  regenerateBtn: ["Regenerate all", "Перегенерировать все"],
  saveCorrectionsBtn: ["Save edits", "Сохранить правки"],
  exportCorrectionsBtn: ["Export edits", "Экспорт правок"],
  importCorrectionsBtn: ["Import edits", "Импорт правок"],
  clearCorrectionsBtn: ["Clear edits", "Очистить правки"],
  loadPresetBtn: ["Load", "Загрузить"],
  savePresetBtn: ["Save", "Сохранить"],
  deletePresetBtn: ["Delete", "Удалить"],
  applyRecommendationsBtn: ["Apply recommendations", "Применить рекомендации"],
  exportBtn: ["Export ZIP", "Экспорт ZIP"],
  closeInspectorBtn: ["Close", "Закрыть"],
  closeHelpBtn: ["Close", "Закрыть"],
};

const FIELD_HELP = {
  gameMode: {
    en: "Choose what to generate: classic flashcards or one of the printable learning games. Domino modes use semantic word IDs for legal matching.",
    ru: "Выбирает, что генерировать: обычные карточки или печатную игру. В домино совпадение идет по смысловому word ID, а не по одинаковому тексту.",
  },
  dominoDensity: {
    en: "Compact prints fewer tiles: roughly one double per word plus bridge tiles. Complete cycle is richer but prints more.",
    ru: "Compact печатает меньше костей: примерно один дубль на слово плюс мосты. Complete cycle богаче, но требует больше печати.",
  },
  languageOrder: {
    en: "Language cycle for tiles, for example chinese,pinyin,english,target,hungarian. Expansion packs can add new edges without reprinting old ones.",
    ru: "Цикл языков для костей, например chinese,pinyin,english,target,hungarian. Так можно добавлять языки новыми связями без перепечати старых.",
  },
  simulatorEnabled: {
    en: "Builds a deterministic digital test game from the generated deck: shuffled hands, draw pile, open ends, and legal moves.",
    ru: "Создает цифровую тестовую партию из текущей колоды: руки, добор, открытые концы и допустимые ходы.",
  },
  thickness: {
    en: "Base plastic thickness in millimeters. Total model height is thickness plus raised text/border.",
    ru: "Толщина пластиковой основы в миллиметрах. Полная высота модели равна толщине плюс поднятый текст/ободок.",
  },
  textHeight: {
    en: "Raised feature height for front text. Bigger is easier to see but increases total height and filament use.",
    ru: "Высота поднятого текста. Больше читаемость, но выше модель и расход материала.",
  },
  backDepth: {
    en: "How deep the underside validation numbers are debossed into the base.",
    ru: "Насколько глубоко номера снизу вдавлены в основу.",
  },
  textFitMode: {
    en: "Auto max uses the largest readable text that fits each card/half. Manual keeps your scale sliders as the main control.",
    ru: "Auto max подбирает максимально крупный текст в карточке/половине. Manual сильнее опирается на слайдеры масштаба.",
  },
  plateLabelMode: {
    en: "Visible adds a small physical label to exported plates when there is space.",
    ru: "Visible добавляет физическую подпись на пластину, если есть место.",
  },
  englishMaxChars: {
    en: "Maximum recommended English length for a card. Auto recommendations update only fields you have not edited manually.",
    ru: "Максимальная длина рекомендованного английского текста. Авто-рекомендации меняют только поля без ручной правки.",
  },
  targetMaxChars: {
    en: "Maximum recommended Russian length for a card. Manual recommended values are kept as-is.",
    ru: "Максимальная длина рекомендованного русского текста. Ручные recommended-значения не перезаписываются.",
  },
  hungarianMaxChars: {
    en: "Maximum recommended extra-language length for a card.",
    ru: "Максимальная длина рекомендованного текста для дополнительного языка.",
  },
  cornerRadius: {
    en: "Rounded corner radius for preview and exported geometry.",
    ru: "Радиус скругления углов в превью и экспортируемой геометрии.",
  },
};

const MODE_HELP = {
  flashcards: {
    en: "Flashcards: four language plates share the same positions. Use front side for learning and underside IDs for checking or sorting.",
    ru: "Карточки: все языковые пластины имеют одинаковые позиции. Лицевая сторона для обучения, номера снизу для проверки и сортировки.",
  },
  domino: {
    en: "Domino: tiles connect when exposed halves have the same semantic word ID. Doubles are same-word pairs and act as branch points.",
    ru: "Домино: кости соединяются, если открытые половины имеют один смысловой word ID. Дубли это пары одного слова, они работают как точки ветвления.",
  },
  matching: {
    en: "Matching: print paired representations and ask players to find semantic matches.",
    ru: "Matching: печатает пары представлений, игроки ищут смысловые совпадения.",
  },
  memory: {
    en: "Memory: shuffled paired tiles for face-down memory play.",
    ru: "Memory: перемешанные парные карточки для игры в мемори лицом вниз.",
  },
  pair_cards: {
    en: "Pair cards: compact direct pairs for drills, sorting, and small games.",
    ru: "Pair cards: компактные прямые пары для тренировки, сортировки и мини-игр.",
  },
  modular_expansion: {
    en: "Modular expansion: generates only language edges needed to add a new language layer without reprinting the old pack.",
    ru: "Modular expansion: генерирует только новые языковые связи, чтобы добавить язык без перепечати старого набора.",
  },
  mixed_challenge: {
    en: "Mixed challenge: mixed learning tiles for a harder classroom-style game.",
    ru: "Mixed challenge: смешанные учебные кости для более сложной игры.",
  },
};

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
    applyRecommendationsToUnlocked();
    renderTable();
    renderCorrectionsStatus();
    await updatePreview();
  } else {
    await loadSample();
  }
}

function bindEvents() {
  setupModules();
  if ($("uiLanguage")) {
    $("uiLanguage").value = uiLanguage;
    $("uiLanguage").addEventListener("change", () => {
      uiLanguage = $("uiLanguage").value;
      localStorage.setItem("hsk-card-ui-language", uiLanguage);
      applyI18n();
      renderSimulator();
      rerenderActiveInspector();
    });
  }
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
  $("applyRecommendationsBtn").addEventListener("click", () => {
    applyRecommendationsToUnlocked();
    renderTable();
    schedulePreview();
    saveLocal();
  });
  $("exportBtn").addEventListener("click", exportZip);
  $("gameMode").addEventListener("change", () => {
    if ($("gameMode").value !== "flashcards" && $("plateLabelMode").value === "none") $("plateLabelMode").value = "visible";
    schedulePreview();
    saveLocal();
  });
  $("closeInspectorBtn").addEventListener("click", closeInspector);
  $("cardInspector").addEventListener("click", (event) => {
    if (event.target.id === "cardInspector") closeInspector();
  });
  $("rulesHelpBtn").addEventListener("click", () => openRulesHelp($("gameMode").value));
  $("closeHelpBtn").addEventListener("click", closeHelp);
  $("helpModal").addEventListener("click", (event) => {
    if (event.target.id === "helpModal") closeHelp();
  });
  $("plates").addEventListener("click", handlePlateClick);
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
  ["englishMaxChars", "targetMaxChars", "hungarianMaxChars"].forEach((id) => {
    $(id)?.addEventListener("input", () => {
      applyRecommendationsToUnlocked();
      renderTable();
      schedulePreview();
      saveLocal();
    });
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
  installHelpButtons();
  applyI18n();
}

function setupModules() {
  const state = loadModuleState();
  document.querySelectorAll("details.module[data-module-id]").forEach((module) => {
    const id = module.dataset.moduleId;
    if (Object.prototype.hasOwnProperty.call(state, id)) {
      module.open = Boolean(state[id]);
    }
    module.addEventListener("toggle", () => {
      const next = loadModuleState();
      next[id] = module.open;
      localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(next));
    });
  });
}

function loadModuleState() {
  try {
    const raw = localStorage.getItem(MODULE_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function currentModuleState() {
  const state = {};
  document.querySelectorAll("details.module[data-module-id]").forEach((module) => {
    state[module.dataset.moduleId] = module.open;
  });
  return state;
}

function applyModuleState(state) {
  if (!state || typeof state !== "object") return;
  document.querySelectorAll("details.module[data-module-id]").forEach((module) => {
    const id = module.dataset.moduleId;
    if (Object.prototype.hasOwnProperty.call(state, id)) module.open = Boolean(state[id]);
  });
  localStorage.setItem(MODULE_STATE_KEY, JSON.stringify(currentModuleState()));
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
  applyRecommendationsToUnlocked();
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
  applyRecommendationsToUnlocked();
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
  const isRu = uiLanguage === "ru";
  const orig = isRu ? "ориг." : "orig";
  const rec = isRu ? "recommended" : "recommended";
  const russian = isRu ? "Russian" : "Russian";
  const headRow = $("wordTable").querySelector("thead tr");
  headRow.innerHTML = `
    <th>#</th>
    <th>汉字</th>
    <th>Pinyin</th>
    <th>English (${orig})</th>
    <th>English (${rec})</th>
    <th>${russian} (${orig})</th>
    <th>${russian} (${rec})</th>
    <th>${escapeHtml(extraLanguageLabel())} (${orig})</th>
    <th>${escapeHtml(extraLanguageLabel())} (${rec})</th>
  `;
  const tbody = $("wordTable").querySelector("tbody");
  tbody.innerHTML = "";
  words.forEach((word, rowIndex) => {
    const tr = document.createElement("tr");
    const status = (field) => (word.lockedFields || []).includes(field) ? "manual" : "auto";
    const statusLabel = (field) => {
      const value = status(field);
      if (uiLanguage !== "ru") return value;
      return value === "manual" ? "ручн." : "авто";
    };
    tr.innerHTML = `
      <td>${word.index}</td>
      ${["chinese", "pinyin"].map((field) => `<td><input value="${escapeAttr(word[field] || "")}" data-row="${rowIndex}" data-field="${field}" /></td>`).join("")}
      ${TRANSLATION_FIELDS.map((field) => `
        <td><input class="orig-value" value="${escapeAttr(originalText(word, field))}" readonly tabindex="-1" /></td>
        <td>
          <input value="${escapeAttr(word[field] || "")}" data-row="${rowIndex}" data-field="${field}" />
          <span class="cell-status ${status(field)}">${statusLabel(field)}</span>
        </td>
      `).join("")}
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      const row = Number(input.dataset.row);
      const field = input.dataset.field;
      words[row][field] = input.value;
      if (["pinyin", ...TRANSLATION_FIELDS].includes(field)) {
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
    applyRecommendationsToUnlocked();
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
  renderSimulator();
  rerenderActiveInspector();
  applyI18n();
}

function buildRequest(overrides = {}) {
  return {
    words: exportWords(),
    datasetId: activeDatasetId,
    gameMode: $("gameMode").value,
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
    domino: {
      density: $("dominoDensity").value,
      normalMode: $("dominoNormalMode").value,
      doublesBehavior: "branch",
      circular: $("dominoCircular").checked,
      targetTileCount: numberValue("targetTileCount", 30),
      languageOrder: parseLanguageOrder(),
      rulesMode: "training",
      includeRules: $("includeRules").checked,
      rulesLanguage: $("rulesLanguage").value,
    },
    plateLabel: {
      mode: $("plateLabelMode").value,
      textTemplate: "{dataset} {range} {mode} p{page}",
      heightMm: numberValue("plateLabelHeight", 0.28),
    },
    printProfile: {
      target: "bambu_a1_mini",
      layerHeightMm: numberValue("layerHeight", 0.16),
      nozzleMm: numberValue("nozzle", 0.4),
      materialSaver: $("materialSaver").checked,
      includeBambuMetadata: true,
    },
    textFit: {
      mode: $("textFitMode").value,
      minReadableMm: 3,
      maxLines: 3,
    },
    simulator: {
      enabled: $("simulatorEnabled").checked,
      playerCount: numberValue("playerCount", 2),
      handSize: numberValue("handSize", 5),
      seed: numberValue("simSeed", 1),
      drawPile: true,
    },
    colors: {
      roles: roleColors(),
    },
    formats: ["stl", "3mf", "zip"],
    ui: {
      extraLanguagePreset: $("extraLanguagePreset").value,
      extraLanguageLabel: extraLanguageLabel(),
      maxChars: maxCharSettings(),
      modules: currentModuleState(),
    },
    ...overrides,
  };
}

function captureSettingsPreset() {
  const request = buildRequest();
  return {
    datasetId: request.datasetId,
    gameMode: request.gameMode,
    rangeStart: request.rangeStart,
    rangeEnd: request.rangeEnd,
    languages: request.languages,
    formats: request.formats,
    printer: request.printer,
    design: request.design,
    domino: request.domino,
    plateLabel: request.plateLabel,
    printProfile: request.printProfile,
    textFit: request.textFit,
    simulator: request.simulator,
    colors: request.colors,
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
    domino: preset.domino ?? current.domino,
    plateLabel: preset.plateLabel ?? current.plateLabel,
    printProfile: preset.printProfile ?? current.printProfile,
    textFit: preset.textFit ?? current.textFit,
    simulator: preset.simulator ?? current.simulator,
    colors: preset.colors ?? current.colors,
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
  const count = latestLayout.tileCount ? `, ${latestLayout.tileCount} tile(s)` : "";
  const dims = latestLayout.dimensions ? `, base ${latestLayout.dimensions.baseThicknessMm} mm, total ${latestLayout.dimensions.totalModelHeightMm} mm` : "";
  $("layoutSummary").textContent = `${latestLayout.columns} x ${latestLayout.rows}, ${latestLayout.capacity} cards/page, ${latestLayout.pageCount} page(s)${count}, used ${latestLayout.usedWidthMm} x ${latestLayout.usedDepthMm} mm${dims}`;
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

function renderSimulator() {
  const view = $("simulatorView");
  if (!view) return;
  const gamePlan = latestLayout?.gamePlan;
  const simulator = gamePlan?.simulator;
  if (!latestLayout || !gamePlan || !simulator) {
    view.innerHTML = `<p>${escapeHtml(t("noSimulator"))}</p>`;
    return;
  }
  const hands = simulator.hands || [];
  const drawPile = simulator.drawPile || [];
  const openEnds = simulator.openEnds || [];
  const legalMoves = simulator.legalMoves || [];
  const summary = gamePlan.rulesSummary || MODE_HELP[$("gameMode").value]?.en || "";
  view.innerHTML = `
    <p>${escapeHtml(t("simulatorIntro"))}</p>
    <div class="sim-row">
      <span class="sim-pill">mode: ${escapeHtml(gamePlan.gameMode || $("gameMode").value)}</span>
      <span class="sim-pill">seed: ${escapeHtml(String(simulator.seed ?? ""))}</span>
      <span class="sim-pill">${escapeHtml(t("drawPile"))}: ${drawPile.length}</span>
      <span class="sim-pill">${escapeHtml(t("legalMoves"))}: ${legalMoves.length}</span>
    </div>
    <p>${escapeHtml(summary)}</p>
    <h3>${escapeHtml(t("hands"))}</h3>
    <div class="sim-hands">
      ${hands.map((hand) => simulatorHandHtml(hand)).join("")}
    </div>
    <h3>${escapeHtml(t("openEnds"))}</h3>
    <div class="sim-row">${openEnds.length ? openEnds.map((end) => `<span class="sim-pill">tile ${end.tileId} ${end.side}: ID ${end.wordId}</span>`).join("") : "<span class=\"sim-pill\">none</span>"}</div>
    <h3>${escapeHtml(t("legalMoves"))}</h3>
    <div class="sim-row">${legalMoves.length ? legalMoves.slice(0, 16).map((move) => legalMoveHtml(move)).join("") : "<span class=\"sim-pill\">none</span>"}</div>
  `;
}

function simulatorHandHtml(hand) {
  const cards = hand.cards || [];
  return `<div class="sim-hand"><strong>P${hand.player}</strong>${cards.map((card) => `<span class="sim-pill">${escapeHtml(simCardLabel(card))}</span>`).join("")}</div>`;
}

function legalMoveHtml(move) {
  if (move.tileId) {
    return `<span class="sim-pill">P${move.player}: tile ${move.tileId} ${move.side} -> ID ${move.matchesWordId}</span>`;
  }
  return `<span class="sim-pill">${escapeHtml(move.rule || "match")} ID ${escapeHtml(String(move.wordId ?? ""))}</span>`;
}

function simCardLabel(card) {
  if (card.left && card.right) {
    return `${card.cardId}: ${card.left.text} | ${card.right.text}`;
  }
  return `${card.cardId}: ${card.text || "?"} (${languageShort(card.languageCode)})`;
}

function renderPlates() {
  const container = $("plates");
  container.innerHTML = "";
  if (!latestLayout) return;
  if (isGameCardLayout()) {
    const block = document.createElement("section");
    block.className = "language-block";
    block.innerHTML = `<div class="language-title"><h2>${escapeHtml(latestLayout.gameMode.replace(/_/g, " "))} deck</h2><p>${latestLayout.pageCount} page(s)</p></div><div class="page-grid"></div>`;
    const grid = block.querySelector(".page-grid");
    for (let page = 0; page < latestLayout.pageCount; page += 1) {
      const card = document.createElement("article");
      card.className = "plate-card";
      card.innerHTML = `<h3>Page ${page + 1}</h3>${gameCardPlateSvg(page)}`;
      grid.appendChild(card);
    }
    container.appendChild(block);
    return;
  }
  if (isTileLayout()) {
    const block = document.createElement("section");
    block.className = "language-block";
    block.innerHTML = `<div class="language-title"><h2>${escapeHtml(latestLayout.gameMode.replace(/_/g, " "))} tiles</h2><p>${latestLayout.pageCount} page(s)</p></div><div class="page-grid"></div>`;
    const grid = block.querySelector(".page-grid");
    for (let page = 0; page < latestLayout.pageCount; page += 1) {
      const card = document.createElement("article");
      card.className = "plate-card";
      card.innerHTML = `<h3>Page ${page + 1}</h3>${dominoPlateSvg(page)}`;
      grid.appendChild(card);
    }
    container.appendChild(block);
    return;
  }
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

function installHelpButtons() {
  document.querySelectorAll("label").forEach((label) => {
    const control = label.querySelector("input[id], select[id]");
    if (!control || label.querySelector(".help-btn") || label.classList.contains("checkbox-row")) return;
    const labelText = Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(" ");
    Array.from(label.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
    });
    const line = document.createElement("span");
    line.className = "label-line";
    const textSpan = document.createElement("span");
    textSpan.className = "label-text";
    textSpan.textContent = labelText || control.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "help-btn";
    button.textContent = "?";
    button.setAttribute("aria-label", `Help for ${control.id}`);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFieldHelp(control.id);
    });
    line.appendChild(textSpan);
    line.appendChild(button);
    label.insertBefore(line, control);
  });
}

function applyI18n() {
  document.documentElement.lang = uiLanguage === "ru" ? "ru" : "en";
  const title = document.querySelector(".panel-header h1");
  if (title) title.textContent = uiLanguage === "ru" ? "HSK генератор карточек" : "HSK Card Generator";
  const subtitle = document.querySelector(".panel-header p");
  if (subtitle) subtitle.textContent = uiLanguage === "ru" ? "Планировщик пластин A1 mini и экспорт 3MF/STL" : "A1 mini plate planner and 3MF/STL export";
  setHeading(".settings-panel > h2", uiLanguage === "ru" ? "Настройки" : "Settings");
  setModuleTitle("project", t("project"));
  setModuleTitle("game-engine", t("gameEngine"));
  setModuleTitle("word-table", t("vocabularyTable"));
  setModuleTitle("presets", t("presets"));
  setModuleTitle("printer-card", t("printerCard"));
  setModuleTitle("geometry-text", t("textGeometry"));
  setModuleTitle("export-print", t("exportPrint"));
  setModuleTitle("colors", t("tileColors"));
  setHeading(".preview-header h2", uiLanguage === "ru" ? "Заполнение пластины" : "Live plate fill");
  $("simulatorTitle").textContent = t("simulator");
  $("helpTitle").textContent = t("help");
  const recommendationHint = $("recommendationHint");
  if (recommendationHint) recommendationHint.textContent = t("recommendationHint");
  Object.entries(LABEL_I18N).forEach(([id, pair]) => setControlLabel(id, pair[uiLanguage === "ru" ? 1 : 0]));
  Object.entries(BUTTON_I18N).forEach(([id, pair]) => {
    const button = $(id);
    if (button) button.textContent = pair[uiLanguage === "ru" ? 1 : 0];
  });
  setSelectLabels("gameMode", {
    flashcards: ["Flashcards", "Карточки"],
    domino: ["Domino playable core", "Домино"],
    matching: ["Matching", "Поиск совпадений"],
    memory: ["Memory", "Мемори"],
    pair_cards: ["Pair cards", "Парные карточки"],
    modular_expansion: ["Modular expansion", "Модульное расширение"],
    mixed_challenge: ["Mixed challenge", "Смешанный челлендж"],
  });
  setSelectLabels("dominoDensity", {
    compact: ["Compact deck", "Компактная колода"],
    target_count: ["Target count", "Целевое число"],
    complete_cycle: ["Complete cycle", "Полный цикл"],
  });
  setSelectLabels("dominoNormalMode", { sequential: ["Sequential bridges", "Последовательные мосты"] });
  setSelectLabels("textFitMode", { auto_max: ["Auto max", "Авто максимум"], manual: ["Manual", "Вручную"] });
  setSelectLabels("plateLabelMode", { none: ["None", "Нет"], visible: ["Visible", "Видимая"] });
  setSelectLabels("hanziGuide", { none: ["None", "Нет"], tian_4: ["4-part", "4 части"], mi_8: ["8-part", "8 частей"] });
  setSelectLabels("backMode", { deboss: ["Deboss", "Вдавленный"], deboss_colored: ["Deboss + color", "Вдавленный + цвет"] });
  document.querySelectorAll(".segmented button").forEach((button) => {
    if (button.dataset.mode === "front") button.textContent = uiLanguage === "ru" ? "Лицевая" : "Front";
    if (button.dataset.mode === "back") button.textContent = uiLanguage === "ru" ? "После переворота" : "Back physical";
    if (button.dataset.mode === "raw") button.textContent = uiLanguage === "ru" ? "Низ модели" : "Underside debug";
  });
  const hint = document.querySelector(".game-engine .hint");
  if (hint) {
    hint.textContent = uiLanguage === "ru"
      ? "Домино: дубли вроде [你 | nǐ] создают ветвление, обычные мосты продолжают цепочку."
      : "Domino example: doubles like [你 | nǐ] branch, normal bridges continue the chain.";
  }
  renderTable();
}

function setSelectLabels(id, labels) {
  const select = $(id);
  if (!select) return;
  Array.from(select.options).forEach((option) => {
    const pair = labels[option.value];
    if (pair) option.textContent = pair[uiLanguage === "ru" ? 1 : 0];
  });
}

function setHeading(selector, text) {
  const node = document.querySelector(selector);
  if (node) node.textContent = text;
}

function setModuleTitle(id, text) {
  const node = document.querySelector(`details.module[data-module-id="${id}"] > summary span`);
  if (node) node.textContent = text;
}

function setControlLabel(id, text) {
  const control = $(id);
  const label = control?.closest("label");
  if (!label) return;
  const labelText = label.querySelector(".label-text");
  if (labelText) {
    labelText.textContent = text;
    return;
  }
  const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = ` ${text} `;
}

function t(key) {
  return I18N[uiLanguage]?.[key] || I18N.en[key] || key;
}

function openFieldHelp(id) {
  const label = LABEL_I18N[id]?.[uiLanguage === "ru" ? 1 : 0] || id;
  const body = FIELD_HELP[id]?.[uiLanguage] || FIELD_HELP[id]?.en || genericHelp(id);
  openHelp(label, `<p>${escapeHtml(body)}</p>`);
}

function openRulesHelp(mode) {
  const selectedMode = mode || $("gameMode").value;
  const title = `${t("rules")}: ${selectedMode.replace(/_/g, " ")}`;
  const main = MODE_HELP[selectedMode]?.[uiLanguage] || MODE_HELP.domino[uiLanguage];
  const extra = uiLanguage === "ru"
    ? "Печатные правила для выбранного режима попадают в ZIP, если включена опция Include game rules. Симулятор использует тот же deck plan и показывает тестовую партию с текущим seed."
    : "Printable rules for the selected mode are included in the ZIP when Include game rules is enabled. The simulator uses the same deck plan and shows a test game with the current seed.";
  openHelp(title, `<p>${escapeHtml(main)}</p><p>${escapeHtml(extra)}</p>`);
}

function openHelp(title, bodyHtml) {
  $("helpTitle").textContent = title;
  $("helpBody").innerHTML = bodyHtml;
  $("helpModal").hidden = false;
}

function closeHelp() {
  $("helpModal").hidden = true;
}

function genericHelp(id) {
  const ru = `Параметр ${id} сохраняется в пресетах и сразу влияет на превью или экспорт, если применим.`;
  const en = `${id} is saved in presets and affects preview or export immediately when applicable.`;
  return uiLanguage === "ru" ? ru : en;
}

function isTileLayout() {
  return Boolean(latestLayout?.cards?.[0]?.left && latestLayout?.cards?.[0]?.right);
}

function isGameCardLayout() {
  return Boolean(latestLayout?.gameCards && latestLayout?.cards?.[0]?.languageCode);
}

function gameCardPlateSvg(page) {
  const printerW = numberValue("plateWidth", 180);
  const printerD = numberValue("plateDepth", 180);
  const positions = latestLayout.positions.filter((pos) => pos.page === page);
  const cardsById = new Map((latestLayout.cards || []).map((card) => [card.cardId, card]));
  const cards = positions.map((pos) => {
    const card = cardsById.get(pos.index);
    if (!card) return "";
    const front = previewMode === "front";
    return `
      <g class="preview-card" data-kind="game-card" data-card-id="${card.cardId}" data-page="${page}">
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${roleColors().base}" stroke="${roleColors().border}" stroke-width="1.3" />
        ${card.languageCode === "chinese" && front ? guideSvg({ ...pos, index: card.wordId }) : ""}
        ${front ? cardTextSvg(pos, card.languageCode, card.text || "?") : backNumberSvg(pos, String(card.wordId).padStart(2, "0"))}
        ${front ? `<text x="${pos.x + pos.width / 2}" y="${pos.y + pos.height + 4.5}" text-anchor="middle" font-size="3.2" fill="#111">${languageShort(card.languageCode)} ${String(card.wordId).padStart(2, "0")}</text>` : ""}
      </g>
    `;
  });
  return `<svg class="plate-svg" viewBox="0 0 ${printerW} ${printerD}" aria-label="${latestLayout.gameMode} page ${page + 1}">${cards.join("")}</svg>`;
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
        <g class="preview-card" data-kind="flashcard" data-language="${language}" data-index="${pos.index}" data-page="${page}">
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${roleColors().base}" stroke="${roleColors().border}" stroke-width="1.3" />
        ${language === "chinese" && previewMode === "front" ? guideSvg(pos) : ""}
        ${label}
        ${externalNumber}
        ${previewMode !== "front" ? backNumberSvg(pos, number) : ""}
        </g>
      </g>
    `;
  });
  return `<svg class="plate-svg" viewBox="0 0 ${printerW} ${printerD}" aria-label="${language} page ${page + 1}">${cards.join("")}</svg>`;
}

function dominoPlateSvg(page) {
  const printerW = numberValue("plateWidth", 180);
  const printerD = numberValue("plateDepth", 180);
  const positions = latestLayout.positions.filter((pos) => pos.page === page);
  const tilesById = new Map((latestLayout.cards || []).map((tile) => [tile.cardId, tile]));
  const colors = roleColors();
  const cards = positions.map((pos) => {
    const tile = tilesById.get(pos.index);
    if (!tile) return "";
    const number = String(tile.cardId).padStart(3, "0");
    const leftBack = String(tile.backIds?.[0] || 0).padStart(2, "0");
    const rightBack = String(tile.backIds?.[1] || 0).padStart(2, "0");
    const left = tile.left || {};
    const right = tile.right || {};
    const leftBox = { x: pos.x + pos.width * 0.045, y: pos.y + pos.height * 0.13, width: pos.width * 0.415, height: pos.height * 0.74 };
    const rightBox = { x: pos.x + pos.width * 0.54, y: pos.y + pos.height * 0.13, width: pos.width * 0.415, height: pos.height * 0.74 };
    const front = previewMode === "front";
    return `
      <g>
        <g class="preview-card" data-kind="domino" data-tile-id="${tile.cardId}" data-page="${page}">
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${colors.base}" stroke="${tile.tileType === "double" ? colors.doubleMarker : colors.border}" stroke-width="${tile.tileType === "double" ? 1.8 : 1.3}" />
        <line x1="${pos.x + pos.width / 2}" y1="${pos.y + 2}" x2="${pos.x + pos.width / 2}" y2="${pos.y + pos.height - 2}" stroke="${colors.divider}" stroke-width="${tile.tileType === "double" ? 1.1 : 0.7}" />
        ${tile.tileType === "double" && front ? `<circle cx="${pos.x + pos.width / 2}" cy="${pos.y + pos.height / 2}" r="${Math.min(pos.width, pos.height) * 0.055}" fill="${colors.doubleMarker}" opacity="0.9" />` : ""}
        ${front ? dominoHalfTextSvg(leftBox, left.languageCode, left.text) + dominoHalfTextSvg(rightBox, right.languageCode, right.text) : ""}
        ${front ? `<text x="${pos.x + pos.width / 2}" y="${pos.y + pos.height + 4.5}" text-anchor="middle" font-size="3.2" fill="#111">${number}</text>` : ""}
        ${front ? `<text x="${leftBox.x + 1}" y="${pos.y + 4}" font-size="2.5" fill="#5b6575">${languageShort(left.languageCode)}</text><text x="${rightBox.x + 1}" y="${pos.y + 4}" font-size="2.5" fill="#5b6575">${languageShort(right.languageCode)}</text>` : ""}
        ${!front ? dominoBackNumberSvg(pos, leftBack, rightBack) : ""}
        </g>
      </g>
    `;
  });
  return `<svg class="plate-svg" viewBox="0 0 ${printerW} ${printerD}" aria-label="domino page ${page + 1}">${cards.join("")}</svg>`;
}

function dominoHalfTextSvg(box, language, text) {
  const layout = fitTextLines(language, text || "?", box.width, box.height, box.width, box.height);
  const x = box.x + box.width / 2;
  const lineHeight = layout.fontSize * 1.15;
  const totalHeight = lineHeight * layout.lines.length;
  const firstY = box.y + box.height / 2 - totalHeight / 2 + layout.fontSize * 0.82;
  const tspans = layout.lines.map((line, index) => `<tspan x="${x}" y="${firstY + index * lineHeight}">${escapeHtml(line)}</tspan>`).join("");
  return `<text text-anchor="middle" font-size="${layout.fontSize}" font-weight="700" fill="${roleColors().frontText}">${tspans}</text>`;
}

function dominoBackNumberSvg(pos, leftNumber, rightNumber) {
  const mirrorAxisY = pos.y + pos.height / 2;
  const transform = previewMode === "raw" ? ` transform="translate(0 ${mirrorAxisY}) scale(1 -1) translate(0 ${-mirrorAxisY})"` : "";
  const y = previewMode === "raw" ? pos.y + pos.height * 0.78 : pos.y + pos.height - 4;
  return `
    <text x="${pos.x + pos.width * 0.25}" y="${y}" text-anchor="middle" font-size="6.2" font-weight="700" fill="#777"${transform}>${leftNumber}</text>
    <text x="${pos.x + pos.width * 0.75}" y="${y}" text-anchor="middle" font-size="6.2" font-weight="700" fill="#777"${transform}>${rightNumber}</text>
  `;
}

function languageShort(language) {
  return { chinese: "ZH", pinyin: "PY", english: "EN", target: "RU", hungarian: "HU" }[language] || String(language || "").slice(0, 2).toUpperCase();
}

function handlePlateClick(event) {
  const node = event.target.closest?.(".preview-card");
  if (!node) return;
  if (node.dataset.kind === "domino") {
    activeInspector = { kind: "domino", tileId: Number(node.dataset.tileId) };
    openDominoInspector(Number(node.dataset.tileId));
  } else if (node.dataset.kind === "game-card") {
    activeInspector = { kind: "game-card", cardId: Number(node.dataset.cardId) };
    openGameCardInspector(Number(node.dataset.cardId));
  } else {
    activeInspector = { kind: "flashcard", index: Number(node.dataset.index), language: node.dataset.language };
    openFlashcardInspector(Number(node.dataset.index), node.dataset.language);
  }
}

function openDominoInspector(tileId) {
  const tile = (latestLayout.cards || []).find((item) => item.cardId === tileId);
  const pos = latestLayout.positions.find((item) => item.index === tileId);
  if (!tile || !pos) return;
  const leftFit = inspectFit(tile.left.languageCode, tile.left.text, pos.width * 0.39, pos.height * 0.64, pos.width, pos.height);
  const rightFit = inspectFit(tile.right.languageCode, tile.right.text, pos.width * 0.39, pos.height * 0.64, pos.width, pos.height);
  $("inspectorTitle").textContent = `Domino ${String(tile.cardId).padStart(3, "0")} - ${tile.tileType}`;
  $("inspectorBody").innerHTML = `
    <div class="inspector-grid">
      <div class="inspector-preview"><h3>${escapeHtml(t("model3d"))}</h3>${dominoModel3d(tile)}</div>
      <div class="inspector-preview"><h3>${escapeHtml(t("front2d"))}</h3>${singleDominoSvg(tile, pos)}</div>
      <div class="inspector-preview"><h3>${escapeHtml(t("side"))}</h3>${sideProfileSvg()}</div>
    </div>
    ${dimensionTable([
      ["Card", `${fmt(pos.width)} x ${fmt(pos.height)} mm`],
      ["Base thickness", `${fmt(numberValue("thickness", 2))} mm`],
      ["Total height", `${fmt(totalModelHeight())} mm`],
      ["Text height", `${fmt(numberValue("textHeight", 0.55))} mm`],
      ["Border", `${fmt(numberValue("borderWidth", 1))} x ${fmt(numberValue("borderHeight", 0.45))} mm`],
      ["Back deboss", `${fmt(numberValue("backDepth", 0.4))} mm`],
      ["Left", `${tile.left.text} (${languageShort(tile.left.languageCode)}), ${fmt(leftFit.fontSize)} mm font, ID ${tile.backIds[0]}`],
      ["Right", `${tile.right.text} (${languageShort(tile.right.languageCode)}), ${fmt(rightFit.fontSize)} mm font, ID ${tile.backIds[1]}`],
    ])}
    ${inspectorScaleControls(tile.left.languageCode, tile.right.languageCode)}
  `;
  $("cardInspector").hidden = false;
}

function openFlashcardInspector(index, language) {
  const word = words.find((item) => item.index === index);
  const pos = latestLayout.positions.find((item) => item.index === index);
  if (!word || !pos) return;
  const text = language === "chinese" ? word.chinese : language === "pinyin" ? word.pinyin : language === "english" ? word.english : language === "hungarian" ? word.hungarian : word.target;
  const fit = inspectFit(language, text, pos.width - scaledInset(pos) * 2.4, pos.height - scaledInset(pos) * 3.2, pos.width, pos.height);
  $("inspectorTitle").textContent = `${languageShort(language)} card ${String(index).padStart(3, "0")}`;
  $("inspectorBody").innerHTML = `
    <div class="inspector-grid">
      <div class="inspector-preview"><h3>${escapeHtml(t("model3d"))}</h3>${flashcardModel3d(language, text)}</div>
      <div class="inspector-preview"><h3>${escapeHtml(t("front2d"))}</h3>${singleFlashcardSvg(pos, language, text)}</div>
      <div class="inspector-preview"><h3>${escapeHtml(t("side"))}</h3>${sideProfileSvg()}</div>
    </div>
    ${dimensionTable([
      ["Card", `${fmt(pos.width)} x ${fmt(pos.height)} mm`],
      ["Base thickness", `${fmt(numberValue("thickness", 2))} mm`],
      ["Total height", `${fmt(totalModelHeight())} mm`],
      ["Fitted font", `${fmt(fit.fontSize)} mm`],
      ["Lines", `${fit.lines.length}`],
      ["Text height", `${fmt(numberValue("textHeight", 0.55))} mm`],
      ["Border", `${fmt(numberValue("borderWidth", 1))} x ${fmt(numberValue("borderHeight", 0.45))} mm`],
      ["Back deboss", `${fmt(numberValue("backDepth", 0.4))} mm`],
    ])}
    ${inspectorScaleControls(language)}
  `;
  $("cardInspector").hidden = false;
}

function closeInspector() {
  $("cardInspector").hidden = true;
  activeInspector = null;
}

function rerenderActiveInspector() {
  if (!activeInspector || $("cardInspector").hidden || !latestLayout) return;
  if (activeInspector.kind === "domino") {
    openDominoInspector(activeInspector.tileId);
  } else if (activeInspector.kind === "game-card") {
    openGameCardInspector(activeInspector.cardId);
  } else {
    openFlashcardInspector(activeInspector.index, activeInspector.language);
  }
}

function openGameCardInspector(cardId) {
  const card = (latestLayout.cards || []).find((item) => item.cardId === cardId);
  const pos = latestLayout.positions.find((item) => item.index === cardId);
  if (!card || !pos) return;
  const fit = inspectFit(card.languageCode, card.text, pos.width - scaledInset(pos) * 2.4, pos.height - scaledInset(pos) * 3.2, pos.width, pos.height);
  $("inspectorTitle").textContent = `${latestLayout.gameMode} card ${String(cardId).padStart(3, "0")}`;
  $("inspectorBody").innerHTML = `
    <div class="inspector-grid">
      <div class="inspector-preview"><h3>${escapeHtml(t("model3d"))}</h3>${flashcardModel3d(card.languageCode, card.text)}</div>
      <div class="inspector-preview"><h3>${escapeHtml(t("front2d"))}</h3>${singleFlashcardSvg(pos, card.languageCode, card.text)}</div>
      <div class="inspector-preview"><h3>${escapeHtml(t("side"))}</h3>${sideProfileSvg()}</div>
    </div>
    ${dimensionTable([
      ["Card", `${fmt(pos.width)} x ${fmt(pos.height)} mm`],
      ["Base thickness", `${fmt(numberValue("thickness", 2))} mm`],
      ["Total height", `${fmt(totalModelHeight())} mm`],
      ["Fitted font", `${fmt(fit.fontSize)} mm`],
      ["Semantic ID", String(card.wordId).padStart(3, "0")],
      ["Language", languageShort(card.languageCode)],
    ])}
    ${inspectorScaleControls(card.languageCode)}
  `;
  $("cardInspector").hidden = false;
}

function inspectFit(language, text, maxWidth, maxHeight, cardWidth, cardHeight) {
  return fitTextLines(language, text, maxWidth, maxHeight, cardWidth, cardHeight);
}

function dimensionTable(rows) {
  return `<table class="dimension-table"><tbody>${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
}

function inspectorScaleControls(...languages) {
  const unique = Array.from(new Set(languages.filter(Boolean)));
  return `<div class="inspector-controls">${unique
    .map((language) => {
      const id = scaleInputId(language);
      return id ? `<label>${languageShort(language)} ${escapeHtml(t("scale"))} <input type="range" min="0.5" max="1.8" step="0.05" value="${$(id).value}" oninput="inspectorScaleChanged('${id}', this.value)" /></label>` : "";
    })
    .join("")}</div>`;
}

function inspectorScaleChanged(id, value) {
  if (!$(id)) return;
  $(id).value = value;
  saveLocal();
  renderPlates();
  rerenderActiveInspector();
  schedulePreview();
}

function scaleInputId(language) {
  return { chinese: "chineseTextScale", pinyin: "pinyinTextScale", english: "englishTextScale", target: "targetTextScale", hungarian: "hungarianTextScale" }[language];
}

function dominoModel3d(tile) {
  const colors = roleColors();
  const left = escapeHtml(tile.left?.text || "?");
  const right = escapeHtml(tile.right?.text || "?");
  const doubleClass = tile.tileType === "double" ? " is-double" : "";
  return `
    <div class="model3d-wrap">
      <div class="model3d${doubleClass}" style="${model3dStyle()}">
        <div class="model3d-bottom">${String(tile.backIds?.[0] || 0).padStart(2, "0")} | ${String(tile.backIds?.[1] || 0).padStart(2, "0")}</div>
        <div class="model3d-side"></div>
        <div class="model3d-top" style="background:${escapeAttr(colors.base)}; border-color:${escapeAttr(colors.border)}">
          <span class="model3d-text left">${left}</span>
          <span class="model3d-divider" style="background:${escapeAttr(colors.divider)}"></span>
          <span class="model3d-text right">${right}</span>
        </div>
      </div>
      <div class="model3d-label">${fmt(numberValue("cardWidth", 60))} x ${fmt(numberValue("cardHeight", 30))} x ${fmt(numberValue("thickness", 2.2))} mm base</div>
    </div>
  `;
}

function flashcardModel3d(language, text) {
  const colors = roleColors();
  const lines = fitTextLines(language, text || "?", numberValue("cardWidth", 30) * 0.72, numberValue("cardHeight", 30) * 0.68, numberValue("cardWidth", 30), numberValue("cardHeight", 30)).lines;
  return `
    <div class="model3d-wrap">
      <div class="model3d" style="${model3dStyle()}">
        <div class="model3d-bottom">${uiLanguage === "ru" ? "номер снизу" : "underside ID"}</div>
        <div class="model3d-side"></div>
        <div class="model3d-top" style="background:${escapeAttr(colors.base)}; border-color:${escapeAttr(colors.border)}">
          <span class="model3d-text single">${lines.map(escapeHtml).join("<br />")}</span>
        </div>
      </div>
      <div class="model3d-label">${fmt(numberValue("cardWidth", 30))} x ${fmt(numberValue("cardHeight", 30))} x ${fmt(numberValue("thickness", 2))} mm base</div>
    </div>
  `;
}

function model3dStyle() {
  const width = Math.min(340, Math.max(180, numberValue("cardWidth", 30) * 5));
  const height = Math.min(220, Math.max(110, numberValue("cardHeight", 30) * 4));
  const thick = Math.max(10, numberValue("thickness", 2) * 7);
  const raised = Math.max(3, Math.max(numberValue("textHeight", 0.55), numberValue("borderHeight", 0.45)) * 10);
  return `--model-w:${width}px;--model-h:${height}px;--model-thick:${thick}px;--model-raised:${raised}px;`;
}

function singleDominoSvg(tile, pos) {
  const oldLayout = latestLayout;
  const mockLayout = { ...latestLayout, positions: [{ ...pos, x: 4, y: 4 }], cards: [tile] };
  latestLayout = mockLayout;
  const svg = dominoPlateSvg(0).replace("plate-svg", "inspector-svg").replace(`viewBox="0 0 ${numberValue("plateWidth", 180)} ${numberValue("plateDepth", 180)}"`, `viewBox="0 0 ${pos.width + 8} ${pos.height + 12}"`);
  latestLayout = oldLayout;
  return svg;
}

function singleFlashcardSvg(pos, language, text) {
  const local = { ...pos, x: 4, y: 4 };
  return `<svg class="inspector-svg" viewBox="0 0 ${pos.width + 8} ${pos.height + 12}"><rect x="4" y="4" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${roleColors().base}" stroke="${roleColors().border}" stroke-width="1.3" />${language === "chinese" ? guideSvg(local) : ""}${cardTextSvg(local, language, text)}</svg>`;
}

function sideProfileSvg() {
  const width = numberValue("cardWidth", 30);
  const base = numberValue("thickness", 2);
  const total = totalModelHeight();
  const scale = 5;
  return `<svg class="inspector-svg side-profile" viewBox="0 0 ${width + 12} ${total * scale + 12}">
    <rect x="6" y="${6 + (total - base) * scale}" width="${width}" height="${base * scale}" fill="#fff" stroke="#777" />
    <rect x="${6 + width * 0.2}" y="6" width="${width * 0.6}" height="${Math.max(1, (total - base) * scale)}" fill="${roleColors().frontText}" opacity="0.85" />
    <text x="6" y="${total * scale + 10}" font-size="2.5">${fmt(base)} mm base / ${fmt(total)} mm total</text>
  </svg>`;
}

function totalModelHeight() {
  return numberValue("thickness", 2) + Math.max(numberValue("textHeight", 0.55), numberValue("borderHeight", 0.45));
}

function fmt(value) {
  return Number(value || 0).toFixed(2);
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
  const startSize = (language === "pinyin" ? 8.2 : 6.8) * scale * cardScale;
  const minSize = (language === "pinyin" ? 4.4 : 3.2) * Math.min(1, cardScale);
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
    ui: { extraLanguagePreset: "hungarian", extraLanguageLabel: "Hungarian", maxChars: { english: 18, target: 18, hungarian: 18 }, modules: {} },
    plateLabel: defaultPlateLabel(),
    printProfile: defaultPrintProfile(),
    simulator: defaultSimulator(),
    textFit: { mode: "auto_max", minReadableMm: 3, maxLines: 3 },
    colors: defaultColors(),
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
    {
      id: "builtin-domino-compact",
      name: "Domino compact 60x30",
      builtin: true,
      ...base,
      gameMode: "domino",
      domino: defaultDomino(),
      plateLabel: defaultPlateLabel({ mode: "visible" }),
      design: defaultDesign({ widthMm: 60, heightMm: 30, thicknessMm: 2.2, cornerRadiusMm: 3, gapMm: 1, rows: "auto", columns: "auto", hanziGuideMode: "none", pinyinTextScale: 1.2, englishTextScale: 1.15, targetTextScale: 1.15, hungarianTextScale: 1.15 }),
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

function defaultDomino(overrides = {}) {
  return {
    density: "compact",
    normalMode: "sequential",
    doublesBehavior: "branch",
    circular: true,
    targetTileCount: 30,
    languageOrder: ["chinese", "pinyin", "english", "target", "hungarian"],
    rulesMode: "training",
    includeRules: true,
    rulesLanguage: "ru",
    ...overrides,
  };
}

function defaultPlateLabel(overrides = {}) {
  return { mode: "none", textTemplate: "{dataset} {range} {mode} p{page}", heightMm: 0.28, ...overrides };
}

function defaultPrintProfile(overrides = {}) {
  return { target: "bambu_a1_mini", layerHeightMm: 0.16, nozzleMm: 0.4, materialSaver: true, includeBambuMetadata: true, ...overrides };
}

function defaultSimulator(overrides = {}) {
  return { enabled: true, playerCount: 2, handSize: 5, seed: 1, drawPile: true, ...overrides };
}

function defaultColors() {
  return {
    roles: {
      base: "#ffffff",
      frontText: "#111111",
      border: "#f2b600",
      divider: "#f2b600",
      doubleMarker: "#d9a000",
      hanziGuide: "#dd3b2a",
    },
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
  const domino = request.domino || {};
  const plateLabel = request.plateLabel || {};
  const printProfile = request.printProfile || {};
  const textFit = request.textFit || {};
  const simulator = request.simulator || {};
  const colors = request.colors?.roles || request.colors || {};
  activeDatasetId = request.datasetId || "hsk1_old";
  $("gameMode").value = request.gameMode || "flashcards";
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
  $("dominoDensity").value = domino.density ?? "compact";
  $("dominoNormalMode").value = domino.normalMode ?? "sequential";
  $("targetTileCount").value = domino.targetTileCount ?? 30;
  $("dominoCircular").checked = domino.circular ?? true;
  $("includeRules").checked = domino.includeRules ?? true;
  $("rulesLanguage").value = domino.rulesLanguage ?? "ru";
  $("languageOrder").value = (domino.languageOrder || ["chinese", "pinyin", "english", "target", "hungarian"]).join(",");
  $("plateLabelMode").value = plateLabel.mode ?? (request.gameMode === "domino" ? "visible" : "none");
  $("plateLabelHeight").value = plateLabel.heightMm ?? 0.28;
  $("layerHeight").value = printProfile.layerHeightMm ?? 0.16;
  $("nozzle").value = printProfile.nozzleMm ?? 0.4;
  $("materialSaver").checked = printProfile.materialSaver ?? true;
  $("textFitMode").value = textFit.mode ?? "auto_max";
  $("simulatorEnabled").checked = simulator.enabled ?? true;
  $("playerCount").value = simulator.playerCount ?? 2;
  $("handSize").value = simulator.handSize ?? 5;
  $("simSeed").value = simulator.seed ?? 1;
  $("colorBase").value = colors.base ?? "#ffffff";
  $("colorText").value = colors.frontText ?? "#111111";
  $("colorBorder").value = colors.border ?? "#f2b600";
  $("colorDivider").value = colors.divider ?? "#f2b600";
  $("colorDoubleMarker").value = colors.doubleMarker ?? "#d9a000";
  $("colorHanziGuide").value = colors.hanziGuide ?? "#dd3b2a";
  $("extraLanguagePreset").value = ui.extraLanguagePreset ?? "hungarian";
  $("extraLanguageLabel").value = ui.extraLanguageLabel || presetLanguageLabel($("extraLanguagePreset").value);
  $("englishMaxChars").value = ui.maxChars?.english ?? 18;
  $("targetMaxChars").value = ui.maxChars?.target ?? 18;
  $("hungarianMaxChars").value = ui.maxChars?.hungarian ?? 18;
  applyModuleState(ui.modules);
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

function parseLanguageOrder() {
  const allowed = new Set(activeLanguages().map(([id]) => id));
  const result = $("languageOrder")
    .value.split(/[,\s>]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => allowed.has(item) && all.indexOf(item) === index);
  return result.length >= 2 ? result : ["chinese", "pinyin"];
}

function roleColors() {
  return {
    base: $("colorBase")?.value || "#ffffff",
    frontText: $("colorText")?.value || "#111111",
    border: $("colorBorder")?.value || "#f2b600",
    divider: $("colorDivider")?.value || "#f2b600",
    doubleMarker: $("colorDoubleMarker")?.value || "#d9a000",
    hanziGuide: $("colorHanziGuide")?.value || "#dd3b2a",
  };
}

function normalizeWords(rawWords) {
  return (rawWords || []).map((word, index) => {
    const original = {
      english: word.original?.english ?? word.englishOriginal ?? word.englishOrig ?? word.english ?? "",
      target: word.original?.target ?? word.targetOriginal ?? word.targetOrig ?? word.russianOriginal ?? word.target ?? word.russian ?? word.ru ?? "",
      hungarian: word.original?.hungarian ?? word.hungarianOriginal ?? word.hungarianOrig ?? word.huOriginal ?? word.hungarian ?? word.hu ?? word.extra ?? "",
    };
    return {
      index: Number(word.index || index + 1),
      chinese: word.chinese || "",
      pinyin: word.pinyin || "",
      english: word.english ?? original.english,
      target: word.target ?? word.russian ?? word.ru ?? original.target,
      hungarian: word.hungarian ?? word.hu ?? word.extra ?? original.hungarian,
      original,
      lockedFields: word.lockedFields || [],
    };
  });
}

function exportWords() {
  return words.map((word) => ({
    index: word.index,
    chinese: word.chinese || "",
    pinyin: word.pinyin || "",
    english: word.english || "",
    target: word.target || "",
    hungarian: word.hungarian || "",
    lockedFields: word.lockedFields || [],
    original: word.original || {},
  }));
}

function originalText(word, field) {
  return word.original?.[field] ?? word[field] ?? "";
}

function maxCharSettings() {
  return {
    english: numberValue("englishMaxChars", 18),
    target: numberValue("targetMaxChars", 18),
    hungarian: numberValue("hungarianMaxChars", 18),
  };
}

function applyRecommendationsToUnlocked(options = {}) {
  const limits = maxCharSettings();
  words = words.map((word) => {
    const next = { ...word, original: { ...(word.original || {}) }, lockedFields: [...(word.lockedFields || [])] };
    for (const field of TRANSLATION_FIELDS) {
      const isManual = next.lockedFields.includes(field);
      if (isManual && !options.force) continue;
      const source = originalText(next, field);
      next[field] = recommendTranslation(source, limits[field], field);
      if (options.force) {
        next.lockedFields = next.lockedFields.filter((item) => item !== field);
      }
    }
    return next;
  });
}

function recommendTranslation(text, maxChars, field) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const limit = Math.max(4, Number(maxChars) || 18);
  if (source.length <= limit) return source;
  const withoutNotes = source
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\b(to be|to|a|an|the)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutNotes && withoutNotes.length <= limit) return withoutNotes;
  const separators = field === "target" || field === "hungarian" ? /[;,|/]+/ : /[;,|/]+|\bor\b/gi;
  const parts = withoutNotes.split(separators).map((item) => item.trim()).filter(Boolean).sort((a, b) => a.length - b.length);
  const fitting = parts.find((item) => item.length <= limit);
  if (fitting) return fitting;
  const wordsOnly = (parts[0] || withoutNotes || source).split(/\s+/).filter(Boolean);
  let result = "";
  for (const token of wordsOnly) {
    const next = result ? `${result} ${token}` : token;
    if (next.length > limit) break;
    result = next;
  }
  if (result) return result;
  return Array.from(source).slice(0, limit).join("");
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
    applyRecommendationsToUnlocked();
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
  applyRecommendationsToUnlocked();
  renderTable();
  renderPlates();
  saveLocal();
}

init();
