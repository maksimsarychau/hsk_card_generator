const BASE_LANGUAGES = [
  ["chinese", "Chinese"],
  ["pinyin", "Pinyin"],
  ["english", "English"],
  ["target", "Russian"],
  ["hungarian", "Hungarian"],
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
let modelRotation = { x: 58, z: -28 };
let inspectorRerenderTimer = null;
const HISTORY_LIMIT = 5;
let undoStack = [];
let redoStack = [];
let historySuspended = false;

const $ = (id) => document.getElementById(id);
const CORRECTIONS_KEY = "hsk-card-dataset-corrections";
const MODULE_STATE_KEY = "hsk-card-module-state";
const TRANSLATION_FIELDS = ["english", "target", "hungarian"];
const OVERRIDE_LANGUAGES = ["chinese", "pinyin", "english", "target", "hungarian"];
const WRAPPABLE_LANGUAGES = ["pinyin", "english", "target", "hungarian"];
let correctionsSaveTimer = null;

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
    openTableEditor: "Open table editor",
    vocabularyEditor: "Vocabulary editor",
    recommendationHint: "Recommended text is used for cards. Manual edits are preserved when max length changes.",
    visibleLanguages: "Visible languages",
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
    openTableEditor: "Открыть редактор",
    vocabularyEditor: "Редактор слов",
    recommendationHint: "Recommended-текст используется для карточек. Ручные правки сохраняются при изменении лимита.",
    visibleLanguages: "Видимые языки",
  },
};

const LABEL_I18N = {
  datasetSelect: ["Word set", "Набор слов"],
  uiLanguage: ["UI", "Интерфейс"],
  rangeStart: ["Range start", "Начало диапазона"],
  rangeEnd: ["Range end", "Конец диапазона"],
  extraLanguagePreset: ["Optional extra language", "Опциональный доп. язык"],
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
  hungarianMaxChars: ["Hungarian max chars", "Макс. Hungarian"],
  pinyinLineChars: ["Pinyin line chars", "Строка Pinyin"],
  englishLineChars: ["English line chars", "Строка English"],
  targetLineChars: ["Russian line chars", "Строка Russian"],
  hungarianLineChars: ["Hungarian line chars", "Строка Hungarian"],
  englishMaxWordChars: ["English word break", "Перенос English"],
  targetMaxWordChars: ["Russian word break", "Перенос Russian"],
  hungarianMaxWordChars: ["Hungarian word break", "Перенос Hungarian"],
  textRenderMode: ["Text geometry", "Геометрия текста"],
  showChinese: ["Chinese", "Китайский"],
  showPinyin: ["Pinyin", "Пиньинь"],
  showEnglish: ["English", "Английский"],
  showTarget: ["Russian", "Русский"],
  showHungarian: ["Hungarian", "Венгерский"],
  showExtra: ["Extra language", "Доп. язык"],
  colorBase: ["Base", "Основа"],
  colorText: ["Text", "Текст"],
  colorBorder: ["Border", "Ободок"],
  colorDivider: ["Divider", "Разделитель"],
  colorDoubleMarker: ["Double", "Дубль"],
  colorHanziGuide: ["Hanzi", "Ханзи"],
  colorChinesePlate: ["Chinese plate", "Пластина Chinese"],
  colorPinyinPlate: ["Pinyin plate", "Пластина Pinyin"],
  colorEnglishPlate: ["English plate", "Пластина English"],
  colorTargetPlate: ["Russian plate", "Пластина Russian"],
  colorHungarianPlate: ["Hungarian plate", "Пластина Hungarian"],
};

const BUTTON_I18N = {
  loadSampleBtn: ["Reload set", "Перезагрузить набор"],
  loadOriginalBtn: ["Load original", "Чистый оригинал"],
  undoBtn: ["Undo", "Назад"],
  redoBtn: ["Redo", "Вперёд"],
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
  openTableEditorBtn: ["Open table editor", "Открыть редактор"],
  exportBtn: ["Export ZIP", "Экспорт ZIP"],
  closeInspectorBtn: ["Close", "Закрыть"],
  closeHelpBtn: ["Close", "Закрыть"],
  closeTableEditorBtn: ["Close", "Закрыть"],
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
    en: "Maximum recommended Hungarian length for a card.",
    ru: "Максимальная длина рекомендованного венгерского текста.",
  },
  pinyinLineChars: {
    en: "Maximum visible characters per pinyin line. Longer tokens are split, including inside words.",
    ru: "Максимум символов в одной строке пиньиня. Длинные слова режутся внутри слова.",
  },
  englishLineChars: {
    en: "Maximum visible characters per English line. This controls preview and exported text wrapping.",
    ru: "Максимум символов в одной английской строке. Управляет переносом в preview и экспорте.",
  },
  targetLineChars: {
    en: "Maximum visible characters per Russian line. This can split long words if needed.",
    ru: "Максимум символов в одной русской строке. При необходимости режет длинные слова.",
  },
  hungarianLineChars: {
    en: "Maximum visible characters per Hungarian line. This helps long Hungarian words stay readable.",
    ru: "Максимум символов в одной венгерской строке. Помогает длинным словам оставаться читаемыми.",
  },
  englishMaxWordChars: {
    en: "Maximum letters before a long English token is split onto another line.",
    ru: "Максимум букв до автоматического переноса длинной части английского слова.",
  },
  targetMaxWordChars: {
    en: "Maximum letters before a long Russian token is split onto another line.",
    ru: "Максимум букв до автоматического переноса длинной части русского слова.",
  },
  hungarianMaxWordChars: {
    en: "Maximum letters before a long Hungarian token is split onto another line.",
    ru: "Максимум букв до автоматического переноса длинной части венгерского слова.",
  },
  textRenderMode: {
    en: "Export geometry variant for slicer tests: current raster blocks, finer raster blocks, or simple proxy blocks.",
    ru: "Вариант геометрии текста для проверки в слайсере: текущий raster, более fine raster или простые proxy-блоки.",
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
  $("loadOriginalBtn").addEventListener("click", loadOriginalDataset);
  $("datasetSelect").addEventListener("change", () => loadDataset($("datasetSelect").value));
  $("undoBtn").addEventListener("click", undoProjectEdit);
  $("redoBtn").addEventListener("click", redoProjectEdit);
  document.addEventListener("focusin", maybeRememberBeforeEdit);
  document.addEventListener("keydown", handleHistoryKeys);
  $("importJsonBtn").addEventListener("click", () => openImport("json"));
  $("importCsvBtn").addEventListener("click", () => openImport("csv"));
  $("importCorrectionsBtn").addEventListener("click", () => openImport("corrections"));
  $("fileInput").addEventListener("change", handleFile);
  $("enrichBtn").addEventListener("click", enrich);
  $("regenerateBtn").addEventListener("click", regenerateAll);
  $("saveCorrectionsBtn").addEventListener("click", saveDatasetCorrections);
  $("exportCorrectionsBtn").addEventListener("click", exportDatasetCorrections);
  $("clearCorrectionsBtn").addEventListener("click", clearDatasetCorrections);
  $("openTableEditorBtn").addEventListener("click", openTableEditor);
  $("closeTableEditorBtn").addEventListener("click", closeTableEditor);
  $("tableEditorModal").addEventListener("click", (event) => {
    if (event.target.id === "tableEditorModal") closeTableEditor();
  });
  $("applyRecommendationsBtn").addEventListener("click", () => {
    pushUndoSnapshot("apply-recommendations");
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
  [
    "englishMaxChars",
    "targetMaxChars",
    "hungarianMaxChars",
    "pinyinLineChars",
    "englishLineChars",
    "targetLineChars",
    "hungarianLineChars",
    "englishMaxWordChars",
    "targetMaxWordChars",
    "hungarianMaxWordChars",
  ].forEach((id) => {
    $(id)?.addEventListener("input", () => {
      applyRecommendationsToUnlocked();
      renderTable();
      autoSaveDatasetCorrections();
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
    syncLanguageOrderToVisible();
    saveLocal();
  });
  ["showChinese", "showPinyin", "showEnglish", "showTarget", "showHungarian", "showExtra"].forEach((id) => {
    $(id)?.addEventListener("change", () => {
      syncLanguageOrderToVisible();
      schedulePreview();
      saveLocal();
    });
  });
  renderPresetSelect();
  updateHistoryButtons();
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

function currentHistorySnapshot() {
  return {
    words: exportWords(),
    request: buildRequest(),
    activeDatasetId,
    previewMode,
  };
}

function pushUndoSnapshot(reason = "edit") {
  if (historySuspended) return;
  const snapshot = currentHistorySnapshot();
  const serialized = JSON.stringify(snapshot);
  const last = undoStack[undoStack.length - 1];
  if (last?.serialized === serialized) return;
  undoStack.push({ snapshot, serialized, reason });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function maybeRememberBeforeEdit(event) {
  const target = event.target;
  if (!target || target.id === "fileInput") return;
  if (!target.matches?.("input, textarea, select")) return;
  if (target.dataset.historyStarted === "1") return;
  target.dataset.historyStarted = "1";
  pushUndoSnapshot("field-edit");
  const clear = () => {
    delete target.dataset.historyStarted;
    target.removeEventListener("blur", clear);
    target.removeEventListener("change", clear);
  };
  target.addEventListener("blur", clear);
  target.addEventListener("change", clear);
}

async function undoProjectEdit() {
  if (!undoStack.length) return;
  const current = currentHistorySnapshot();
  const previous = undoStack.pop().snapshot;
  redoStack.push({ snapshot: current, serialized: JSON.stringify(current), reason: "redo" });
  if (redoStack.length > HISTORY_LIMIT) redoStack.shift();
  await restoreHistorySnapshot(previous);
}

async function redoProjectEdit() {
  if (!redoStack.length) return;
  const current = currentHistorySnapshot();
  const next = redoStack.pop().snapshot;
  undoStack.push({ snapshot: current, serialized: JSON.stringify(current), reason: "undo" });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  await restoreHistorySnapshot(next);
}

async function restoreHistorySnapshot(snapshot) {
  historySuspended = true;
  try {
    activeDatasetId = snapshot.activeDatasetId || snapshot.request?.datasetId || activeDatasetId;
    if (snapshot.request) applySavedRequest(snapshot.request);
    words = normalizeWords(snapshot.words || []);
    previewMode = snapshot.previewMode || previewMode;
    document.querySelectorAll(".segmented button").forEach((button) => button.classList.toggle("active", button.dataset.mode === previewMode));
    renderTable();
    renderCorrectionsStatus();
    saveLocal();
    autoSaveDatasetCorrections();
    await updatePreview();
  } finally {
    historySuspended = false;
    updateHistoryButtons();
  }
}

function handleHistoryKeys(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "z" && !event.shiftKey) {
    event.preventDefault();
    undoProjectEdit();
  } else if (key === "y" || (key === "z" && event.shiftKey)) {
    event.preventDefault();
    redoProjectEdit();
  }
}

function updateHistoryButtons() {
  if ($("undoBtn")) $("undoBtn").disabled = !undoStack.length;
  if ($("redoBtn")) $("redoBtn").disabled = !redoStack.length;
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
  if (words.length) pushUndoSnapshot("reload-set");
  await loadDataset(activeDatasetId);
}

async function loadDatasets() {
  const response = await fetch(`/api/datasets?ts=${Date.now()}`);
  const data = await response.json();
  datasets = data.ok ? data.datasets : [];
  const select = $("datasetSelect");
  select.innerHTML = datasetOptionsHtml(datasets);
  if (datasets.some((dataset) => dataset.id === activeDatasetId)) {
    select.value = activeDatasetId;
  }
}

function datasetOptionsHtml(items) {
  const groups = [];
  for (const dataset of items) {
    const group = dataset.group || "Other";
    let bucket = groups.find((item) => item.group === group);
    if (!bucket) {
      bucket = { group, datasets: [] };
      groups.push(bucket);
    }
    bucket.datasets.push(dataset);
  }
  return groups.map((bucket) => {
    const options = bucket.datasets.map((dataset) => `<option value="${escapeAttr(dataset.id)}">${escapeHtml(dataset.label)} (${dataset.count})</option>`).join("");
    return `<optgroup label="${escapeAttr(bucket.group)}">${options}</optgroup>`;
  }).join("");
}

async function loadDataset(datasetId, options = {}) {
  activeDatasetId = datasetId || activeDatasetId;
  $("datasetSelect").value = activeDatasetId;
  const response = await fetch(`/api/dataset/${encodeURIComponent(activeDatasetId)}?ts=${Date.now()}`);
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

async function loadOriginalDataset() {
  if (!confirmDanger(uiLanguage === "ru"
    ? "Загрузить чистый оригинал? Все сохранённые правки для текущего набора будут удалены."
    : "Load the clean original? All saved edits for the current set will be deleted.")) {
    return;
  }
  if (activeDatasetId !== "custom") {
    pushUndoSnapshot("load-original");
    const all = loadAllCorrections();
    delete all[activeDatasetId];
    persistAllCorrections(all);
  }
  await loadDataset(activeDatasetId, { ignoreCorrections: true });
}

function confirmDanger(message) {
  return window.confirm(message);
}

function openImport(mode) {
  if (mode === "corrections" && !confirmDanger(uiLanguage === "ru"
    ? "Импортировать правки? Текущие сохранённые правки для набора могут быть заменены."
    : "Import edits? Current saved edits for the set may be replaced.")) {
    return;
  }
  if (mode !== "corrections" && !confirmDanger(uiLanguage === "ru"
    ? "Импортировать новый словарь? Текущий проект будет заменён импортированными словами."
    : "Import a new vocabulary file? The current project words will be replaced.")) {
    return;
  }
  pendingImportMode = mode;
  $("fileInput").value = "";
  $("fileInput").click();
}

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  pushUndoSnapshot("import-file");
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
  renderTableElement($("wordTable"));
  if (!$("tableEditorModal")?.hidden) renderTableElement($("modalWordTable"));
}

function renderTableElement(table) {
  if (!table) return;
  const isEditor = table.id === "modalWordTable";
  const isRu = uiLanguage === "ru";
  const orig = isRu ? "ориг." : "orig";
  const rec = isRu ? "recommended" : "recommended";
  const russian = isRu ? "Russian" : "Russian";
  const hungarian = "Hungarian";
  const headRow = table.querySelector("thead tr");
  headRow.innerHTML = `
    <th>#</th>
    <th>汉字</th>
    <th>Pinyin</th>
    <th>English (${orig})</th>
    <th>English (${rec})</th>
    <th>${russian} (${orig})</th>
    <th>${russian} (${rec})</th>
    <th>${hungarian} (${orig})</th>
    <th>${hungarian} (${rec})</th>
  `;
  const tbody = table.querySelector("tbody");
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
      ${textTableCell(word, rowIndex, "chinese", isEditor)}
      ${textTableCell(word, rowIndex, "pinyin", isEditor)}
      ${TRANSLATION_FIELDS.map((field) => `
        <td>${originalTableCell(word, field)}</td>
        ${textTableCell(word, rowIndex, field, isEditor, status(field), statusLabel(field))}
      `).join("")}
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("input[data-field], textarea[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const row = Number(input.dataset.row);
      const field = input.dataset.field;
      words[row][field] = input.value;
      if (["pinyin", ...TRANSLATION_FIELDS].includes(field)) {
          words[row].lockedFields = Array.from(new Set([...(words[row].lockedFields || []), field]));
      }
      applyTextToLatestLayout(words[row].index, field);
      refreshWordMiniPreview(table, row, field);
      autoSaveDatasetCorrections();
      renderPlates();
      scheduleInspectorRerender(140);
      schedulePreview();
      saveLocal();
      syncTwinTable(table.id);
    });
  });
  tbody.querySelectorAll("input[data-override], select[data-override]").forEach((input) => {
    input.addEventListener("input", () => {
      const row = Number(input.dataset.row);
      const language = input.dataset.language;
      const key = input.dataset.override;
      setWordOverride(row, language, key, input.value);
      applyOverrideToLatestLayout(words[row].index, language);
      refreshWordMiniPreview(table, row, language);
      autoSaveDatasetCorrections();
      renderPlates();
      scheduleInspectorRerender(140);
      schedulePreview();
      saveLocal();
      syncTwinTable(table.id);
    });
  });
  installColumnResizers(table);
}

function originalTableCell(word, field) {
  const text = originalText(word, field);
  const rows = Math.min(6, Math.max(2, String(text || "").split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / 18)), 0)));
  return `<textarea class="orig-value" readonly tabindex="-1" rows="${rows}">${escapeHtml(text)}</textarea>`;
}

function textTableCell(word, rowIndex, field, isEditor, status = "", statusLabel = "") {
  const tag = field === "chinese" && !isEditor ? "input" : "textarea";
  const editor = tag === "input"
    ? `<input value="${escapeAttr(word[field] || "")}" data-row="${rowIndex}" data-field="${field}" />`
    : `<textarea data-row="${rowIndex}" data-field="${field}">${escapeHtml(word[field] || "")}</textarea>`;
  const statusHtml = status ? `<span class="cell-status ${status}">${statusLabel}</span>` : "";
  const tools = isEditor ? wordOverrideTools(word, rowIndex, field) : "";
  const preview = isEditor ? wordMiniPreview(word, field) : "";
  return `<td class="${isEditor ? "editor-word-cell" : ""}">${editor}${statusHtml}${tools}${preview}</td>`;
}

function wordOverrideTools(word, rowIndex, language) {
  const override = wordOverride(word, language);
  const scale = override.scale ?? 1;
  const lineChars = override.lineChars ?? (lineCharSettings()[language] || "");
  const maxLines = override.maxLines ?? defaultMaxLines(language);
  const wrapControls = WRAPPABLE_LANGUAGES.includes(language)
    ? `
      <label>${uiLanguage === "ru" ? "симв./стр." : "chars/line"} <input data-row="${rowIndex}" data-language="${language}" data-override="lineChars" type="number" min="2" step="1" value="${escapeAttr(lineChars)}" /></label>
      <label>${uiLanguage === "ru" ? "строк" : "lines"} <input data-row="${rowIndex}" data-language="${language}" data-override="maxLines" type="number" min="1" max="8" step="1" value="${escapeAttr(maxLines)}" /></label>
    `
    : "";
  return `
    <div class="word-override-tools">
      <label>${uiLanguage === "ru" ? "масштаб" : "scale"} <input data-row="${rowIndex}" data-language="${language}" data-override="scale" type="range" min="0.45" max="1.8" step="0.05" value="${escapeAttr(scale)}" /></label>
      ${wrapControls}
    </div>
  `;
}

function wordMiniPreview(word, language) {
  const pos = { index: word.index, x: 1, y: 1, width: numberValue("cardWidth", 30), height: numberValue("cardHeight", 30) };
  const text = wordText(word, language) || "?";
  return `<div class="word-mini-preview" data-preview-row="${word.index}" data-preview-language="${escapeAttr(language)}">${singleFlashcardSvg(pos, language, text, word).replace("inspector-svg", "mini-card-svg")}</div>`;
}

function refreshWordMiniPreview(table, rowIndex, language) {
  if (!table || rowIndex < 0 || !words[rowIndex]) return;
  const preview = Array.from(table.querySelectorAll(`.word-mini-preview[data-preview-row="${words[rowIndex].index}"]`))
    .find((node) => node.dataset.previewLanguage === language);
  if (preview) preview.outerHTML = wordMiniPreview(words[rowIndex], language);
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

function openTableEditor() {
  $("tableEditorTitle").textContent = t("vocabularyEditor");
  $("tableEditorModal").hidden = false;
  renderTableElement($("modalWordTable"));
}

function closeTableEditor() {
  $("tableEditorModal").hidden = true;
}

function syncTwinTable(sourceTableId) {
  const twin = sourceTableId === "wordTable" ? $("modalWordTable") : $("wordTable");
  if (twin && (sourceTableId === "modalWordTable" || !$("tableEditorModal")?.hidden)) {
    renderTableElement(twin);
  }
}

function installColumnResizers(table) {
  const key = `hsk-card-column-widths-${table.id}`;
  const widths = loadColumnWidths(key);
  table.querySelectorAll("th").forEach((th, index) => {
    if (widths[index]) th.style.width = `${widths[index]}px`;
    if (th.querySelector(".col-resizer")) return;
    const grip = document.createElement("span");
    grip.className = "col-resizer";
    grip.addEventListener("pointerdown", (event) => startColumnResize(event, table, th, index, key));
    th.appendChild(grip);
  });
}

function loadColumnWidths(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function startColumnResize(event, table, th, index, key) {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = th.offsetWidth;
  const onMove = (moveEvent) => {
    const width = Math.max(54, startWidth + moveEvent.clientX - startX);
    th.style.width = `${width}px`;
  };
  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    const widths = loadColumnWidths(key);
    widths[index] = Math.round(th.offsetWidth);
    localStorage.setItem(key, JSON.stringify(widths));
    const twin = table.id === "wordTable" ? $("modalWordTable") : $("wordTable");
    if (twin) renderTableElement(twin);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
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
  pushUndoSnapshot("enrich");
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
      textRenderMode: $("textRenderMode").value,
      pinyinLineChars: numberValue("pinyinLineChars", 12),
      englishLineChars: numberValue("englishLineChars", 10),
      targetLineChars: numberValue("targetLineChars", 10),
      hungarianLineChars: numberValue("hungarianLineChars", 11),
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
      languages: languageColors(),
    },
    formats: ["stl", "3mf", "zip"],
    ui: {
      extraLanguagePreset: $("extraLanguagePreset").value,
      extraLanguageLabel: extraLanguageLabel(),
      maxChars: maxCharSettings(),
      lineChars: lineCharSettings(),
      maxWordChars: maxWordCharSettings(),
      selectedLanguages: selectedLanguageIds(),
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
  if (!confirmDanger(uiLanguage === "ru" ? `Загрузить пресет "${preset.name}"? Текущие настройки будут заменены.` : `Load preset "${preset.name}"? Current settings will be replaced.`)) return;
  pushUndoSnapshot("load-preset");
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
  const tableEditorTitle = $("tableEditorTitle");
  if (tableEditorTitle) tableEditorTitle.textContent = t("vocabularyEditor");
  const languageLegend = document.querySelector(".language-picker legend");
  if (languageLegend) languageLegend.textContent = t("visibleLanguages");
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
  setSelectLabels("textRenderMode", {
    raster_blocks: ["Raster blocks", "Raster-блоки"],
    raster_fine: ["Raster fine", "Точный raster"],
    proxy_blocks: ["Proxy blocks", "Proxy-блоки"],
  });
  document.querySelectorAll(".segmented button").forEach((button) => {
    if (button.dataset.mode === "front") button.textContent = uiLanguage === "ru" ? "Лицевая" : "Front";
    if (button.dataset.mode === "back") button.textContent = uiLanguage === "ru" ? "После переворота" : "Back physical";
    if (button.dataset.mode === "raw") button.textContent = uiLanguage === "ru" ? "Низ модели" : "Underside debug";
  });
  const hint = document.querySelector(".game-engine .hint");
  if (hint) {
    hint.textContent = uiLanguage === "ru"
      ? `Порядок языков: ${parseLanguageOrder().join(", ")}. Дубли вроде [你 | nǐ] создают ветвление.`
      : `Language order: ${parseLanguageOrder().join(", ")}. Doubles like [你 | nǐ] branch.`;
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
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${plateBaseColor(card.languageCode)}" stroke="${roleColors().border}" stroke-width="1.3" />
        ${card.languageCode === "chinese" && front ? guideSvg({ ...pos, index: card.wordId }) : ""}
        ${front ? cardTextSvg(pos, card.languageCode, card.text || "?", card.overrides) : backNumberSvg(pos, String(card.wordId).padStart(2, "0"))}
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
    const label = previewMode === "front" ? cardTextSvg(pos, language, displayText, wordOverride(word, language)) : "";
    const externalNumber = previewMode === "front" ? `<text x="${pos.x + pos.width / 2}" y="${pos.y + pos.height + 4.5}" text-anchor="middle" font-size="3.2" fill="#111">${number}</text>` : "";
    return `
      <g>
        <g class="preview-card" data-kind="flashcard" data-language="${language}" data-index="${pos.index}" data-page="${page}">
        <rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${plateBaseColor(language)}" stroke="${roleColors().border}" stroke-width="1.3" />
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
        ${front ? dominoHalfTextSvg(leftBox, left.languageCode, left.text, left.overrides) + dominoHalfTextSvg(rightBox, right.languageCode, right.text, right.overrides) : ""}
        ${front ? `<text x="${pos.x + pos.width / 2}" y="${pos.y + pos.height + 4.5}" text-anchor="middle" font-size="3.2" fill="#111">${number}</text>` : ""}
        ${front ? `<text x="${leftBox.x + 1}" y="${pos.y + 4}" font-size="2.5" fill="#5b6575">${languageShort(left.languageCode)}</text><text x="${rightBox.x + 1}" y="${pos.y + 4}" font-size="2.5" fill="#5b6575">${languageShort(right.languageCode)}</text>` : ""}
        ${!front ? dominoBackNumberSvg(pos, leftBack, rightBack) : ""}
        </g>
      </g>
    `;
  });
  return `<svg class="plate-svg" viewBox="0 0 ${printerW} ${printerD}" aria-label="domino page ${page + 1}">${cards.join("")}</svg>`;
}

function dominoHalfTextSvg(box, language, text, overrides = null) {
  const layout = fitTextLines(language, text || "?", box.width, box.height, box.width, box.height, overrides);
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
  const leftFit = inspectFit(tile.left.languageCode, tile.left.text, pos.width * 0.39, pos.height * 0.64, pos.width, pos.height, tile.left.overrides);
  const rightFit = inspectFit(tile.right.languageCode, tile.right.text, pos.width * 0.39, pos.height * 0.64, pos.width, pos.height, tile.right.overrides);
  $("inspectorTitle").textContent = `Domino ${String(tile.cardId).padStart(3, "0")} - ${tile.tileType}`;
  $("inspectorBody").innerHTML = `
    <div class="inspector-layout">
      <div class="inspector-left">
        <div class="inspector-grid">
          <div class="inspector-preview inspector-main-preview"><h3>${escapeHtml(t("model3d"))}</h3>${dominoModel3d(tile, pos)}</div>
          <div class="inspector-preview"><h3>${escapeHtml(t("front2d"))}</h3>${singleDominoSvg(tile, pos)}</div>
          <div class="inspector-preview"><h3>${escapeHtml(t("side"))}</h3>${sideProfileSvg(pos.width)}</div>
        </div>
      </div>
      <div class="inspector-right">
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
        ${inspectorEditorControls([
          { wordId: tile.left.wordId, language: tile.left.languageCode, label: `Left ${tile.left.text}` },
          { wordId: tile.right.wordId, language: tile.right.languageCode, label: `Right ${tile.right.text}` },
        ])}
      </div>
    </div>
  `;
  $("cardInspector").hidden = false;
  bindInspectorModelDrag();
}

function openFlashcardInspector(index, language) {
  const word = words.find((item) => item.index === index);
  const pos = latestLayout.positions.find((item) => item.index === index);
  if (!word || !pos) return;
  const text = language === "chinese" ? word.chinese : language === "pinyin" ? word.pinyin : language === "english" ? word.english : language === "hungarian" ? word.hungarian : word.target;
  const fit = inspectFit(language, text, pos.width - scaledInset(pos) * 2.4, pos.height - scaledInset(pos) * 3.2, pos.width, pos.height, wordOverride(word, language));
  $("inspectorTitle").textContent = `${languageShort(language)} card ${String(index).padStart(3, "0")}`;
  $("inspectorBody").innerHTML = `
    <div class="inspector-layout">
      <div class="inspector-left">
        <div class="inspector-grid">
          <div class="inspector-preview inspector-main-preview"><h3>${escapeHtml(t("model3d"))}</h3>${flashcardModel3d(language, text, pos, word)}</div>
          <div class="inspector-preview"><h3>${escapeHtml(t("front2d"))}</h3>${singleFlashcardSvg(pos, language, text, word)}</div>
          <div class="inspector-preview"><h3>${escapeHtml(t("side"))}</h3>${sideProfileSvg(pos.width)}</div>
        </div>
      </div>
      <div class="inspector-right">
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
        ${inspectorEditorControls([{ wordId: index, language, label: text }])}
      </div>
    </div>
  `;
  $("cardInspector").hidden = false;
  bindInspectorModelDrag();
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
  const fit = inspectFit(card.languageCode, card.text, pos.width - scaledInset(pos) * 2.4, pos.height - scaledInset(pos) * 3.2, pos.width, pos.height, card.overrides);
  $("inspectorTitle").textContent = `${latestLayout.gameMode} card ${String(cardId).padStart(3, "0")}`;
  $("inspectorBody").innerHTML = `
    <div class="inspector-layout">
      <div class="inspector-left">
        <div class="inspector-grid">
          <div class="inspector-preview inspector-main-preview"><h3>${escapeHtml(t("model3d"))}</h3>${flashcardModel3d(card.languageCode, card.text, pos, { overrides: { [card.languageCode]: card.overrides || {} } })}</div>
          <div class="inspector-preview"><h3>${escapeHtml(t("front2d"))}</h3>${singleFlashcardSvg(pos, card.languageCode, card.text, { overrides: { [card.languageCode]: card.overrides || {} } })}</div>
          <div class="inspector-preview"><h3>${escapeHtml(t("side"))}</h3>${sideProfileSvg(pos.width)}</div>
        </div>
      </div>
      <div class="inspector-right">
        ${dimensionTable([
          ["Card", `${fmt(pos.width)} x ${fmt(pos.height)} mm`],
          ["Base thickness", `${fmt(numberValue("thickness", 2))} mm`],
          ["Total height", `${fmt(totalModelHeight())} mm`],
          ["Fitted font", `${fmt(fit.fontSize)} mm`],
          ["Semantic ID", String(card.wordId).padStart(3, "0")],
          ["Language", languageShort(card.languageCode)],
        ])}
        ${inspectorEditorControls([{ wordId: card.wordId, language: card.languageCode, label: card.text }])}
      </div>
    </div>
  `;
  $("cardInspector").hidden = false;
  bindInspectorModelDrag();
}

function inspectFit(language, text, maxWidth, maxHeight, cardWidth, cardHeight, overrides = null) {
  return fitTextLines(language, text, maxWidth, maxHeight, cardWidth, cardHeight, overrides);
}

function dimensionTable(rows) {
  return `<table class="dimension-table"><tbody>${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
}

function inspectorEditorControls(refs) {
  const unique = [];
  const seen = new Set();
  for (const ref of refs.filter((item) => item?.wordId && item?.language)) {
    const key = `${ref.wordId}:${ref.language}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ref);
  }
  return `<div class="inspector-controls inspector-edit-controls">${unique
    .map((ref) => {
      const word = words.find((item) => item.index === Number(ref.wordId));
      if (!word) return "";
      const override = wordOverride(word, ref.language);
      const scale = override.scale ?? 1;
      const lineChars = override.lineChars ?? (lineCharSettings()[ref.language] || "");
      const maxLines = override.maxLines ?? defaultMaxLines(ref.language);
      const text = wordText(word, ref.language);
      const title = `${languageShort(ref.language)} ${String(ref.wordId).padStart(3, "0")}`;
      const wrapControls = WRAPPABLE_LANGUAGES.includes(ref.language)
        ? `
          <label>${uiLanguage === "ru" ? "симв./стр." : "chars/line"} <input type="number" min="2" step="1" value="${escapeAttr(lineChars)}" oninput="inspectorOverrideChanged(${Number(ref.wordId)}, '${escapeAttr(ref.language)}', 'lineChars', this.value)" /></label>
          <label>${uiLanguage === "ru" ? "строк" : "lines"} <input type="number" min="1" max="8" step="1" value="${escapeAttr(maxLines)}" oninput="inspectorOverrideChanged(${Number(ref.wordId)}, '${escapeAttr(ref.language)}', 'maxLines', this.value)" /></label>
        `
        : "";
      return `
        <section class="inspector-edit-card">
          <div class="inspector-edit-title">${escapeHtml(title)}<span>${escapeHtml(ref.label || "")}</span></div>
          <label>${uiLanguage === "ru" ? "текст" : "text"} <textarea oninput="inspectorTextChanged(${Number(ref.wordId)}, '${escapeAttr(ref.language)}', this.value)">${escapeHtml(text)}</textarea></label>
          <label>${escapeHtml(t("scale"))} <input type="range" min="0.45" max="1.8" step="0.05" value="${escapeAttr(scale)}" oninput="inspectorOverrideChanged(${Number(ref.wordId)}, '${escapeAttr(ref.language)}', 'scale', this.value)" /></label>
          ${wrapControls}
          <div class="inspector-edit-actions">
            <button type="button" onclick="inspectorUseOriginal(${Number(ref.wordId)}, '${escapeAttr(ref.language)}')">${uiLanguage === "ru" ? "Оригинал" : "Original"}</button>
            <button type="button" onclick="inspectorUseRecommended(${Number(ref.wordId)}, '${escapeAttr(ref.language)}')">${uiLanguage === "ru" ? "Рекоменд." : "Recommended"}</button>
            <button type="button" onclick="inspectorResetOverrides(${Number(ref.wordId)}, '${escapeAttr(ref.language)}')">${uiLanguage === "ru" ? "Сброс настроек" : "Reset settings"}</button>
          </div>
        </section>
      `;
    })
    .join("")}</div>`;
}

function inspectorTextChanged(wordId, language, value) {
  const row = words.findIndex((item) => item.index === Number(wordId));
  if (row < 0) return;
  if (language === "chinese" && !words[row]._confirmedChineseInspectorEdit && value !== wordText(words[row], language)) {
    if (!confirmDanger(uiLanguage === "ru" ? "Изменить китайский текст в словаре? Это повлияет на preview и экспорт." : "Change Chinese dictionary text? This affects preview and export.")) {
      rerenderActiveInspector();
      return;
    }
    words[row]._confirmedChineseInspectorEdit = true;
  }
  setWordText(row, language, value, true);
  applyTextToLatestLayout(Number(wordId), language);
  afterInspectorEdit({ rerender: true });
}

function inspectorOverrideChanged(wordId, language, key, value) {
  const row = words.findIndex((item) => item.index === Number(wordId));
  if (row < 0) return;
  setWordOverride(row, language, key, value);
  applyOverrideToLatestLayout(Number(wordId), language);
  afterInspectorEdit({ rerender: true });
}

function inspectorUseOriginal(wordId, language) {
  const row = words.findIndex((item) => item.index === Number(wordId));
  if (row < 0) return;
  pushUndoSnapshot("use-original");
  setWordText(row, language, originalWordText(Number(wordId), language), true);
  applyTextToLatestLayout(Number(wordId), language);
  afterInspectorEdit({ rerender: true, immediate: true });
}

function inspectorUseRecommended(wordId, language) {
  const row = words.findIndex((item) => item.index === Number(wordId));
  if (row < 0) return;
  pushUndoSnapshot("use-recommended");
  setWordText(row, language, recommendedWordText(words[row], language), true);
  applyTextToLatestLayout(Number(wordId), language);
  afterInspectorEdit({ rerender: true, immediate: true });
}

function inspectorResetOverrides(wordId, language) {
  const row = words.findIndex((item) => item.index === Number(wordId));
  if (row < 0) return;
  pushUndoSnapshot("reset-overrides");
  const overrides = normalizeWordOverrides(words[row].overrides);
  delete overrides[language];
  words[row].overrides = overrides;
  autoSaveDatasetCorrections();
  applyOverrideToLatestLayout(Number(wordId), language);
  afterInspectorEdit({ rerender: true, immediate: true });
}

function afterInspectorEdit({ rerender = false, immediate = false } = {}) {
  autoSaveDatasetCorrections();
  saveLocal();
  renderPlates();
  renderTable();
  if (rerender) scheduleInspectorRerender(immediate ? 0 : 140);
  schedulePreview();
}

function scheduleInspectorRerender(delay = 350) {
  clearTimeout(inspectorRerenderTimer);
  inspectorRerenderTimer = setTimeout(rerenderActiveInspector, delay);
}

function applyOverrideToLatestLayout(wordId, language) {
  if (!latestLayout?.cards) return;
  const word = words.find((item) => item.index === Number(wordId));
  const override = wordOverride(word, language);
  latestLayout.cards.forEach((card) => {
    if (card.wordId === wordId && card.languageCode === language) card.overrides = override;
    if (card.left?.wordId === wordId && card.left?.languageCode === language) card.left.overrides = override;
    if (card.right?.wordId === wordId && card.right?.languageCode === language) card.right.overrides = override;
  });
}

function applyTextToLatestLayout(wordId, language) {
  if (!latestLayout?.cards) return;
  const word = words.find((item) => item.index === Number(wordId));
  if (!word) return;
  const text = wordText(word, language) || "?";
  latestLayout.cards.forEach((card) => {
    if (card.wordId === wordId && card.languageCode === language) card.text = text;
    if (card.left?.wordId === wordId && card.left?.languageCode === language) card.left.text = text;
    if (card.right?.wordId === wordId && card.right?.languageCode === language) card.right.text = text;
  });
}

function bindInspectorModelDrag() {
  const model = $("inspectorBody")?.querySelector(".model3d");
  if (!model) return;
  setModelRotation(model);
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startRotation = { ...modelRotation };
  model.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startRotation = { ...modelRotation };
    model.classList.add("dragging");
    model.setPointerCapture(event.pointerId);
  });
  model.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    modelRotation = {
      x: Math.max(-82, Math.min(82, startRotation.x - (event.clientY - startY) * 0.35)),
      z: startRotation.z + (event.clientX - startX) * 0.35,
    };
    setModelRotation(model);
  });
  const stop = (event) => {
    if (!dragging) return;
    dragging = false;
    model.classList.remove("dragging");
    try {
      model.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released by the browser.
    }
  };
  model.addEventListener("pointerup", stop);
  model.addEventListener("pointercancel", stop);
  model.addEventListener("dblclick", () => {
    modelRotation = { x: 58, z: -28 };
    setModelRotation(model);
  });
}

function setModelRotation(model) {
  model.style.setProperty("--model-rx", `${modelRotation.x}deg`);
  model.style.setProperty("--model-rz", `${modelRotation.z}deg`);
}

function dominoModel3d(tile, pos) {
  const colors = roleColors();
  const leftFit = fitTextLines(tile.left?.languageCode, tile.left?.text || "?", pos.width * 0.39, pos.height * 0.64, pos.width, pos.height, tile.left?.overrides);
  const rightFit = fitTextLines(tile.right?.languageCode, tile.right?.text || "?", pos.width * 0.39, pos.height * 0.64, pos.width, pos.height, tile.right?.overrides);
  const cssScale = modelCssScale(pos.width, pos.height);
  const left = model3dTextHtml(leftFit.lines);
  const right = model3dTextHtml(rightFit.lines);
  const doubleClass = tile.tileType === "double" ? " is-double" : "";
  return `
    <div class="model3d-wrap">
      <div class="model3d-hint">${uiLanguage === "ru" ? "тащите мышью, двойной клик - сброс" : "drag to rotate, double-click to reset"}</div>
      <div class="model3d${doubleClass}" style="${model3dStyle(pos.width, pos.height)}">
        <div class="model3d-face model3d-bottom">${String(tile.backIds?.[0] || 0).padStart(2, "0")} | ${String(tile.backIds?.[1] || 0).padStart(2, "0")}</div>
        ${model3dSides()}
        <div class="model3d-face model3d-top" style="background:${escapeAttr(colors.base)}">
          <span class="model3d-border-rail" style="border-color:${escapeAttr(colors.border)}"></span>
          <span class="model3d-text model3d-raised left" style="font-size:${Math.max(12, leftFit.fontSize * cssScale)}px">${left}</span>
          <span class="model3d-divider" style="background:${escapeAttr(colors.divider)}"></span>
          <span class="model3d-text model3d-raised right" style="font-size:${Math.max(12, rightFit.fontSize * cssScale)}px">${right}</span>
        </div>
      </div>
      <div class="model3d-label">${fmt(pos.width)} x ${fmt(pos.height)} x ${fmt(numberValue("thickness", 2.2))} mm base</div>
    </div>
  `;
}

function flashcardModel3d(language, text, pos, word = null) {
  const colors = roleColors();
  const fit = fitTextLines(language, text || "?", pos.width * 0.72, pos.height * 0.68, pos.width, pos.height, word ? wordOverride(word, language) : null);
  const cssScale = modelCssScale(pos.width, pos.height);
  return `
    <div class="model3d-wrap">
      <div class="model3d-hint">${uiLanguage === "ru" ? "тащите мышью, двойной клик - сброс" : "drag to rotate, double-click to reset"}</div>
      <div class="model3d" style="${model3dStyle(pos.width, pos.height)}">
        <div class="model3d-face model3d-bottom">${uiLanguage === "ru" ? "номер снизу" : "underside ID"}</div>
        ${model3dSides()}
        <div class="model3d-face model3d-top" style="background:${escapeAttr(plateBaseColor(language))}">
          <span class="model3d-border-rail" style="border-color:${escapeAttr(colors.border)}"></span>
          ${model3dHanziGuide(language, text)}
          <span class="model3d-text model3d-raised single" style="font-size:${Math.max(14, fit.fontSize * cssScale)}px">${model3dTextHtml(fit.lines)}</span>
        </div>
      </div>
      <div class="model3d-label">${fmt(pos.width)} x ${fmt(pos.height)} x ${fmt(numberValue("thickness", 2))} mm base</div>
    </div>
  `;
}

function model3dStyle(widthMm, heightMm) {
  const { width, height } = modelCssSize(widthMm, heightMm);
  const thick = Math.max(10, numberValue("thickness", 2) * 7);
  const raised = Math.max(3, Math.max(numberValue("textHeight", 0.55), numberValue("borderHeight", 0.45)) * 10);
  const borderPx = Math.max(3, numberValue("borderWidth", 1) * modelCssScale(widthMm, heightMm));
  return `--model-w:${width}px;--model-h:${height}px;--model-thick:${thick}px;--model-raised:${raised}px;--model-border:${borderPx}px;--model-rx:${modelRotation.x}deg;--model-rz:${modelRotation.z}deg;`;
}

function modelCssSize(widthMm, heightMm) {
  const maxW = 360;
  const maxH = 230;
  const minW = 150;
  const minH = 95;
  const scale = Math.min(maxW / Math.max(1, widthMm), maxH / Math.max(1, heightMm));
  return {
    width: Math.max(minW, widthMm * scale),
    height: Math.max(minH, heightMm * scale),
  };
}

function modelCssScale(widthMm, heightMm) {
  return modelCssSize(widthMm, heightMm).width / Math.max(1, widthMm);
}

function model3dSides() {
  return `
    <div class="model3d-face model3d-side model3d-side-front"></div>
    <div class="model3d-face model3d-side model3d-side-back"></div>
    <div class="model3d-face model3d-side model3d-side-left"></div>
    <div class="model3d-face model3d-side model3d-side-right"></div>
  `;
}

function model3dTextHtml(lines) {
  return (lines || ["?"]).map(escapeHtml).join("<br />");
}

function model3dHanziGuide(language, text) {
  if (language !== "chinese" || $("hanziGuide").value === "none") return "";
  const chars = cjkChars(text);
  const count = chars.length || 1;
  if (count > 3) return "";
  const inset = 12;
  const usable = 100 - inset * 2;
  const cellWidth = usable / count;
  const mode = $("hanziGuide").value;
  const cells = Array.from({ length: count }, (_, index) => {
    const left = inset + index * cellWidth;
    return `
      <span class="model3d-hanzi-cell" style="left:${left}%;top:${inset}%;width:${cellWidth}%;height:${usable}%">
        <span class="model3d-hanzi-line vertical"></span>
        <span class="model3d-hanzi-line horizontal"></span>
        ${mode === "mi_8" ? `<span class="model3d-hanzi-line diag-a"></span><span class="model3d-hanzi-line diag-b"></span>` : ""}
      </span>
    `;
  }).join("");
  return `<span class="model3d-hanzi-guide">${cells}</span>`;
}

function singleDominoSvg(tile, pos) {
  const oldLayout = latestLayout;
  const mockLayout = { ...latestLayout, positions: [{ ...pos, x: 4, y: 4 }], cards: [tile] };
  latestLayout = mockLayout;
  const svg = dominoPlateSvg(0).replace("plate-svg", "inspector-svg").replace(`viewBox="0 0 ${numberValue("plateWidth", 180)} ${numberValue("plateDepth", 180)}"`, `viewBox="0 0 ${pos.width + 8} ${pos.height + 12}"`);
  latestLayout = oldLayout;
  return svg;
}

function singleFlashcardSvg(pos, language, text, word = null) {
  const local = { ...pos, x: 4, y: 4 };
  return `<svg class="inspector-svg" viewBox="0 0 ${pos.width + 8} ${pos.height + 12}"><rect x="4" y="4" width="${pos.width}" height="${pos.height}" rx="${previewCornerRadius(pos)}" fill="${plateBaseColor(language)}" stroke="${roleColors().border}" stroke-width="1.3" />${language === "chinese" ? guideSvg(local) : ""}${cardTextSvg(local, language, text, word ? wordOverride(word, language) : null)}</svg>`;
}

function sideProfileSvg(width = numberValue("cardWidth", 30)) {
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

function cardTextSvg(pos, language, text, overrides = null) {
  const layout = fitTextLines(language, text, pos.width - scaledInset(pos) * 2.4, pos.height - scaledInset(pos) * 3.2, pos.width, pos.height, overrides);
  const x = pos.x + pos.width / 2;
  if (language === "chinese") {
    const chars = cjkChars(text);
    if (chars.length > 1 && chars.length <= 3) {
      const cells = hanziCellBoxes(pos, chars.length);
      return chars
        .map((char, index) => {
          const cell = cells[index];
          const cellLayout = fitTextLines(language, char, cell.width * 0.86, cell.height * 0.82, pos.width, pos.height, overrides);
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

function fitTextLines(language, rawText, maxWidth, maxHeight, cardWidth = 30, cardHeight = 30, overrides = null) {
  const text = wrapByLanguageLineLimit(language, String(rawText || "?").trim(), overrides);
  const globalScale = previewTextScale(language);
  const localScale = overrideNumber(overrides, "scale", 1);
  const scale = globalScale * localScale;
  const cardScale = Math.max(0.35, Math.min(cardWidth, cardHeight) / 30);
  if (language === "chinese") {
    const preferred = (text.length > 2 ? 8.8 : text.length > 1 ? 10.8 : 15) * globalScale * cardScale;
    const maxInkWidth = maxWidth / Math.max(1, text.length * 0.92);
    const maxFit = Math.min(maxInkWidth, maxHeight * 0.82);
    let size = Math.min(preferred, maxFit * 0.88) * localScale;
    size = Math.min(size, maxFit * 1.08);
    size = Math.max(2, size);
    return { lines: [text], fontSize: Number(size.toFixed(2)) };
  }

  const explicitLines = Math.max(1, text.split("\n").length);
  const maxLines = Math.max(explicitLines, overrideInt(overrides, "maxLines", language === "pinyin" ? 2 : 3));
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

function wrapByLanguageLineLimit(language, text, overrides = null) {
  const limit = overrideInt(overrides, "lineChars", lineCharSettings()[language]);
  if (!limit || language === "chinese") return text;
  return wrapHardLines(text, Math.max(2, Number(limit) || 0));
}

function defaultMaxLines(language) {
  return language === "pinyin" ? 2 : 3;
}

function overrideNumber(overrides, key, fallback) {
  if (!overrides || overrides[key] === undefined || overrides[key] === "") return fallback;
  return Number(overrides[key]) || fallback;
}

function overrideInt(overrides, key, fallback) {
  if (!overrides || overrides[key] === undefined || overrides[key] === "") return fallback;
  return Math.max(1, Number(overrides[key]) || fallback);
}

function wrapHardLines(text, maxChars) {
  const limit = Math.max(2, Number(maxChars) || 0);
  if (!limit) return String(text || "");
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => wrapHardLine(line, limit))
    .join("\n");
}

function wrapHardLine(line, limit) {
  const normalized = String(line || "").replace(/\s*\/\s*/g, " / ").trim();
  if (!normalized) return "";
  const tokens = normalized.split(/[ \t]+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const token of tokens) {
    const chunks = splitTokenByChars(token, limit);
    for (const chunk of chunks) {
      const next = current ? `${current} ${chunk}` : chunk;
      if (Array.from(next).length <= limit || !current) {
        current = next;
      } else {
        lines.push(current);
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function splitTokenByChars(token, limit) {
  const chars = Array.from(String(token || ""));
  if (chars.length <= limit) return [token];
  const chunks = [];
  for (let i = 0; i < chars.length; i += limit) {
    chunks.push(chars.slice(i, i + limit).join(""));
  }
  return chunks;
}

function wrapText(text, maxWidth, fontSize, maxLines) {
  const tokens = tokenizeText(text);
  const lines = [];
  let current = "";
  for (const token of tokens) {
    if (token === "\n") {
      if (current) {
        lines.push(current);
        current = "";
      } else if (lines.length) {
        lines.push("");
      }
      continue;
    }
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
  const tokens = [];
  String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .forEach((line, index) => {
      if (index) tokens.push("\n");
      tokens.push(...line.replace(/\s*\/\s*/g, " / ").trim().split(/[ \t]+/).filter(Boolean));
    });
  return tokens;
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
      overrides: normalizeWordOverrides(patch.overrides ?? word.overrides),
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
    const overrides = normalizeWordOverrides(word.overrides);
    if (Object.keys(overrides).length) {
      patch.overrides = overrides;
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

function autoSaveDatasetCorrections() {
  clearTimeout(correctionsSaveTimer);
  correctionsSaveTimer = setTimeout(() => {
    if (activeDatasetId === "custom") {
      saveLocal();
      return;
    }
    saveDatasetCorrections();
  }, 350);
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
  if (!confirmDanger(uiLanguage === "ru"
    ? "Очистить сохранённые правки и загрузить оригинал текущего набора?"
    : "Clear saved edits and load the original version of this set?")) {
    return;
  }
  pushUndoSnapshot("clear-corrections");
  const all = loadAllCorrections();
  delete all[activeDatasetId];
  persistAllCorrections(all);
  loadDataset(activeDatasetId, { ignoreCorrections: true });
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

function migrateLegacyUiSettings() {
  if ($("extraLanguagePreset")?.value === "hungarian") {
    $("extraLanguagePreset").value = "custom";
    $("extraLanguageLabel").value = "";
  }
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
  const preset = presets.find((item) => item.id === id);
  if (!preset) return;
  if (!confirmDanger(uiLanguage === "ru" ? `Удалить пресет "${preset.name}"?` : `Delete preset "${preset.name}"?`)) return;
  presets = presets.filter((item) => item.id !== id || item.builtin);
  persistPresets();
  renderPresetSelect();
}

function defaultPresets() {
  const base = {
    printer: { id: "bambu-a1-mini", name: "Bambu Lab A1 mini", widthMm: 180, depthMm: 180, marginMm: 0 },
    ui: {
      extraLanguagePreset: "custom",
      extraLanguageLabel: "",
      maxChars: { english: 18, target: 18, hungarian: 18 },
      lineChars: { pinyin: 12, english: 10, target: 10, hungarian: 11 },
      maxWordChars: { english: 10, target: 10, hungarian: 10 },
      selectedLanguages: ["chinese", "pinyin", "english", "target", "hungarian"],
      modules: {},
    },
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
    textRenderMode: "raster_blocks",
    pinyinLineChars: 12,
    englishLineChars: 10,
    targetLineChars: 10,
    hungarianLineChars: 11,
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
    languages: {
      chinese: "#ffffff",
      pinyin: "#eef6ff",
      english: "#eefbea",
      target: "#fff1f1",
      hungarian: "#fff6e8",
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
  $("textRenderMode").value = design.textRenderMode ?? "raster_blocks";
  $("pinyinLineChars").value = design.pinyinLineChars ?? ui.lineChars?.pinyin ?? 12;
  $("englishLineChars").value = design.englishLineChars ?? ui.lineChars?.english ?? 10;
  $("targetLineChars").value = design.targetLineChars ?? ui.lineChars?.target ?? 10;
  $("hungarianLineChars").value = design.hungarianLineChars ?? ui.lineChars?.hungarian ?? 11;
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
  const languageColorsSaved = request.colors?.languages || {};
  $("colorChinesePlate").value = languageColorsSaved.chinese ?? "#ffffff";
  $("colorPinyinPlate").value = languageColorsSaved.pinyin ?? "#eef6ff";
  $("colorEnglishPlate").value = languageColorsSaved.english ?? "#eefbea";
  $("colorTargetPlate").value = languageColorsSaved.target ?? "#fff1f1";
  $("colorHungarianPlate").value = languageColorsSaved.hungarian ?? "#fff6e8";
  $("extraLanguagePreset").value = ui.extraLanguagePreset ?? "custom";
  $("extraLanguageLabel").value = ui.extraLanguageLabel ?? "";
  migrateLegacyUiSettings();
  $("englishMaxChars").value = ui.maxChars?.english ?? 18;
  $("targetMaxChars").value = ui.maxChars?.target ?? 18;
  $("hungarianMaxChars").value = ui.maxChars?.hungarian ?? 18;
  $("pinyinLineChars").value = design.pinyinLineChars ?? ui.lineChars?.pinyin ?? $("pinyinLineChars").value;
  $("englishLineChars").value = design.englishLineChars ?? ui.lineChars?.english ?? $("englishLineChars").value;
  $("targetLineChars").value = design.targetLineChars ?? ui.lineChars?.target ?? $("targetLineChars").value;
  $("hungarianLineChars").value = design.hungarianLineChars ?? ui.lineChars?.hungarian ?? $("hungarianLineChars").value;
  $("englishMaxWordChars").value = ui.maxWordChars?.english ?? 10;
  $("targetMaxWordChars").value = ui.maxWordChars?.target ?? 10;
  $("hungarianMaxWordChars").value = ui.maxWordChars?.hungarian ?? 10;
  setSelectedLanguages(ui.selectedLanguages || ["chinese", "pinyin", "english", "target", "hungarian"]);
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
  const aliases = { russian: "target", ru: "target", hu: "hungarian", magyar: "hungarian", english: "english", chinese: "chinese", hanzi: "chinese", pinyin: "pinyin" };
  const result = $("languageOrder")
    .value.split(/[,\s>]+/)
    .map((item) => item.trim())
    .map((item) => aliases[item.toLowerCase()] || item)
    .filter(Boolean)
    .filter((item, index, all) => allowed.has(item) && all.indexOf(item) === index);
  const fallback = selectedLanguageIds();
  const normalized = result.length >= 2 ? result : fallback.slice(0, Math.max(2, fallback.length));
  $("languageOrder").value = normalized.join(",");
  return normalized;
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

function languageColors() {
  return {
    chinese: $("colorChinesePlate")?.value || "#ffffff",
    pinyin: $("colorPinyinPlate")?.value || "#eef6ff",
    english: $("colorEnglishPlate")?.value || "#eefbea",
    target: $("colorTargetPlate")?.value || "#fff1f1",
    hungarian: $("colorHungarianPlate")?.value || "#fff6e8",
  };
}

function plateBaseColor(language) {
  return languageColors()[language] || roleColors().base;
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
      overrides: normalizeWordOverrides(word.overrides),
      lockedFields: word.lockedFields || [],
    };
  });
}

function normalizeWordOverrides(overrides) {
  const normalized = {};
  if (!overrides || typeof overrides !== "object") return normalized;
  for (const language of OVERRIDE_LANGUAGES) {
    const raw = overrides[language];
    if (!raw || typeof raw !== "object") continue;
    const next = {};
    if (raw.scale !== undefined && raw.scale !== "") next.scale = clamp(Number(raw.scale) || 1, 0.2, 3);
    if (raw.lineChars !== undefined && raw.lineChars !== "") next.lineChars = Math.max(2, Number(raw.lineChars) || 2);
    if (raw.maxLines !== undefined && raw.maxLines !== "") next.maxLines = Math.max(1, Number(raw.maxLines) || 1);
    if (Object.keys(next).length) normalized[language] = next;
  }
  return normalized;
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
    overrides: normalizeWordOverrides(word.overrides),
  }));
}

function wordText(word, language) {
  if (language === "chinese") return word.chinese || "";
  if (language === "pinyin") return word.pinyin || "";
  if (language === "english") return word.english || "";
  if (language === "hungarian") return word.hungarian || "";
  return word.target || "";
}

function languageField(language) {
  return {
    chinese: "chinese",
    pinyin: "pinyin",
    english: "english",
    target: "target",
    hungarian: "hungarian",
  }[language] || "target";
}

function setWordText(rowIndex, language, value, markManual = true) {
  const word = words[rowIndex];
  const field = languageField(language);
  if (!word || !field) return;
  word[field] = value;
  if (markManual && ["pinyin", ...TRANSLATION_FIELDS].includes(field)) {
    word.lockedFields = Array.from(new Set([...(word.lockedFields || []), field]));
  }
}

function originalWordText(wordId, language) {
  const base = datasetBaseWords.find((item) => item.index === Number(wordId));
  const word = base || words.find((item) => item.index === Number(wordId));
  if (!word) return "";
  const field = languageField(language);
  if (TRANSLATION_FIELDS.includes(field)) return originalText(word, field);
  return wordText(word, language);
}

function recommendedWordText(word, language) {
  if (!word) return "";
  const field = languageField(language);
  if (!TRANSLATION_FIELDS.includes(field)) return originalWordText(word.index, language);
  const limits = maxCharSettings();
  const lineLimits = lineCharSettings();
  const wordLimits = maxWordCharSettings();
  return recommendTranslation(
    originalText(word, field),
    limits[field],
    Math.min(wordLimits[field], lineLimits[field] || wordLimits[field]),
    field
  );
}

function wordOverride(word, language) {
  return normalizeWordOverrides(word?.overrides)[language] || {};
}

function setWordOverride(rowIndex, language, key, rawValue) {
  const word = words[rowIndex];
  if (!word) return;
  const overrides = normalizeWordOverrides(word.overrides);
  const next = { ...(overrides[language] || {}) };
  if (rawValue === "" || rawValue === undefined || rawValue === null) {
    delete next[key];
  } else if (key === "scale") {
    next[key] = clamp(Number(rawValue) || 1, 0.2, 3);
  } else {
    next[key] = Math.max(1, Number(rawValue) || 1);
  }
  if (Object.keys(next).length) overrides[language] = next;
  else delete overrides[language];
  word.overrides = overrides;
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

function lineCharSettings() {
  return {
    pinyin: numberValue("pinyinLineChars", 12),
    english: numberValue("englishLineChars", 10),
    target: numberValue("targetLineChars", 10),
    hungarian: numberValue("hungarianLineChars", 11),
  };
}

function maxWordCharSettings() {
  return {
    english: numberValue("englishMaxWordChars", 10),
    target: numberValue("targetMaxWordChars", 10),
    hungarian: numberValue("hungarianMaxWordChars", 10),
  };
}

function applyRecommendationsToUnlocked(options = {}) {
  const limits = maxCharSettings();
  const lineLimits = lineCharSettings();
  const wordLimits = maxWordCharSettings();
  words = words.map((word) => {
    const next = { ...word, original: { ...(word.original || {}) }, lockedFields: [...(word.lockedFields || [])] };
    for (const field of TRANSLATION_FIELDS) {
      const isManual = next.lockedFields.includes(field);
      if (isManual && !options.force) continue;
      const source = originalText(next, field);
      next[field] = recommendTranslation(source, limits[field], Math.min(wordLimits[field], lineLimits[field] || wordLimits[field]), field);
      if (options.force) {
        next.lockedFields = next.lockedFields.filter((item) => item !== field);
      }
    }
    return next;
  });
}

function recommendTranslation(text, maxChars, maxWordChars, field) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const limit = Math.max(4, Number(maxChars) || 18);
  if (source.length <= limit) return breakLongWords(source, maxWordChars);
  const withoutNotes = source
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\b(to be|to|a|an|the)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutNotes && withoutNotes.length <= limit) return breakLongWords(withoutNotes, maxWordChars);
  const separators = field === "target" || field === "hungarian" ? /[;,|/]+/ : /[;,|/]+|\bor\b/gi;
  const parts = withoutNotes.split(separators).map((item) => item.trim()).filter(Boolean).sort((a, b) => a.length - b.length);
  const fitting = parts.find((item) => item.length <= limit);
  if (fitting) return breakLongWords(fitting, maxWordChars);
  const wordsOnly = (parts[0] || withoutNotes || source).split(/\s+/).filter(Boolean);
  let result = "";
  for (const token of wordsOnly) {
    const next = result ? `${result} ${token}` : token;
    if (next.length > limit) break;
    result = next;
  }
  if (result) return breakLongWords(result, maxWordChars);
  return breakLongWords(Array.from(source).slice(0, limit).join(""), maxWordChars);
}

function breakLongWords(text, maxWordChars) {
  const limit = Math.max(4, Number(maxWordChars) || 10);
  return String(text || "")
    .split(/(\s+|\/)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === "/" || Array.from(part).length <= limit) return part;
      const chars = Array.from(part);
      const chunks = [];
      for (let i = 0; i < chars.length; i += limit) {
        chunks.push(chars.slice(i, i + limit).join(""));
      }
      return chunks.join("\n");
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
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
  const labels = new Map(BASE_LANGUAGES);
  if ($("showExtra")?.checked && extraLanguageLabel()) labels.set("extra", extraLanguageLabel());
  const selected = selectedLanguageIds();
  return selected.filter((id) => id !== "extra" || labels.has("extra")).map((id) => [id, labels.get(id) || id]);
}

function selectedLanguageIds() {
  const ids = [
    ["chinese", "showChinese"],
    ["pinyin", "showPinyin"],
    ["english", "showEnglish"],
    ["target", "showTarget"],
    ["hungarian", "showHungarian"],
    ["extra", "showExtra"],
  ].filter(([, checkboxId]) => $(checkboxId)?.checked).map(([id]) => id).filter((id) => id !== "extra" || Boolean(extraLanguageLabel()));
  return ids.length ? ids : ["english", "target"];
}

function setSelectedLanguages(ids) {
  const selected = new Set(ids || []);
  const fallback = selected.size ? selected : new Set(["chinese", "pinyin", "english", "target", "hungarian"]);
  [
    ["chinese", "showChinese"],
    ["pinyin", "showPinyin"],
    ["english", "showEnglish"],
    ["target", "showTarget"],
    ["hungarian", "showHungarian"],
    ["extra", "showExtra"],
  ].forEach(([id, checkboxId]) => {
    if ($(checkboxId)) $(checkboxId).checked = fallback.has(id);
  });
}

function syncLanguageOrderToVisible() {
  const selected = selectedLanguageIds();
  const current = parseLanguageOrder().filter((id) => selected.includes(id));
  const merged = [...current, ...selected.filter((id) => !current.includes(id))];
  $("languageOrder").value = merged.join(",");
}

function extraLanguageLabel() {
  return $("extraLanguageLabel")?.value.trim() || "";
}

function presetLanguageLabel(value) {
  const labels = {
    german: "German",
    spanish: "Spanish",
    french: "French",
    custom: "",
  };
  return labels[value] || "";
}

function handleExtraLanguagePreset() {
  const preset = $("extraLanguagePreset").value;
  if (preset !== "custom") {
    $("extraLanguageLabel").value = presetLanguageLabel(preset);
  }
  applyRecommendationsToUnlocked();
  renderTable();
  renderPlates();
  syncLanguageOrderToVisible();
  saveLocal();
}

init();
