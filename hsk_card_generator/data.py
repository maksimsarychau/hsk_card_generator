from __future__ import annotations

import csv
import json
import re
from functools import lru_cache
from html import unescape
from pathlib import Path

from hsk_card_generator.models import WordEntry


ROOT = Path(__file__).resolve().parent.parent


HSK1_SAMPLE: list[WordEntry] = [
    WordEntry(1, "你", "nǐ", "you", "ты / вы"),
    WordEntry(2, "好", "hǎo", "hello", "привет"),
    WordEntry(3, "他", "tā", "he", "он"),
    WordEntry(4, "她", "tā", "she", "она"),
    WordEntry(5, "我", "wǒ", "I", "я"),
    WordEntry(6, "是", "shì", "am / is / are", "быть"),
    WordEntry(7, "吗", "ma", "question particle", "вопрос. частица"),
    WordEntry(8, "不", "bù", "no / not", "нет / не"),
    WordEntry(9, "了", "le", "aspect particle", "частица аспекта"),
    WordEntry(10, "在", "zài", "in / at", "в / на"),
    WordEntry(11, "有", "yǒu", "have", "иметь"),
    WordEntry(12, "和", "hé", "and", "и"),
    WordEntry(13, "人", "rén", "person", "человек"),
    WordEntry(14, "这", "zhè", "this / these", "этот / эти"),
    WordEntry(15, "中", "zhōng", "middle / center", "середина / центр"),
    WordEntry(16, "大", "dà", "big", "большой"),
    WordEntry(17, "来", "lái", "come", "приходить"),
    WordEntry(18, "上", "shàng", "on / up", "на / вверх"),
    WordEntry(19, "个", "gè", "measure word", "счётное слово"),
    WordEntry(20, "国", "guó", "country", "страна"),
    WordEntry(21, "我们", "wǒmen", "we", "мы"),
    WordEntry(22, "去", "qù", "go", "идти"),
    WordEntry(23, "说", "shuō", "say / speak", "говорить"),
    WordEntry(24, "为", "wèi", "for", "для / ради"),
    WordEntry(25, "子", "zǐ", "child / son", "ребёнок / сын"),
    WordEntry(26, "生", "shēng", "life / birth", "жизнь / рождение"),
    WordEntry(27, "会", "huì", "can / will", "мочь / уметь"),
    WordEntry(28, "到", "dào", "arrive / reach", "прибывать / достигать"),
    WordEntry(29, "时", "shí", "time / hour", "время / час"),
    WordEntry(30, "要", "yào", "want / need", "хотеть / нужно"),
    WordEntry(31, "出", "chū", "go out", "выходить"),
    WordEntry(32, "也", "yě", "also / too", "тоже / также"),
    WordEntry(33, "学", "xué", "study", "учиться"),
    WordEntry(34, "下", "xià", "down / below", "вниз / ниже"),
    WordEntry(35, "对", "duì", "right / correct", "правильно / верно"),
    WordEntry(36, "去", "qù", "go", "идти"),
    WordEntry(37, "能", "néng", "can / be able", "мочь / уметь"),
    WordEntry(38, "后", "hòu", "after / behind", "после / позади"),
    WordEntry(39, "就", "jiù", "then / just", "тогда / просто"),
    WordEntry(40, "多", "duō", "many / much", "много / многие"),
    WordEntry(41, "小", "xiǎo", "small", "маленький"),
    WordEntry(42, "心", "xīn", "heart / mind", "сердце / душа"),
    WordEntry(43, "而", "ér", "but / however", "но / однако"),
    WordEntry(44, "天", "tiān", "sky / day", "небо / день"),
    WordEntry(45, "没", "méi", "not have / without", "не иметь / без"),
    WordEntry(46, "从", "cóng", "from", "от / из"),
    WordEntry(47, "那", "nà", "that / there", "тот / та"),
    WordEntry(48, "得", "dé", "get / obtain", "получать / достать"),
    WordEntry(49, "地", "de", "particle", "частица места"),
    WordEntry(50, "把", "bǎ", "hold / grasp", "держать / брать"),
]


_HUNGARIAN = [
    "te / ön",
    "szia / jó",
    "ő (férfi)",
    "ő (nő)",
    "én",
    "lenni",
    "kérdő partikula",
    "nem",
    "befejezett aspektus",
    "-ban / -ben / -nál",
    "van / birtokol",
    "és",
    "ember",
    "ez / ezek",
    "közép",
    "nagy",
    "jön",
    "fent / rajta",
    "számlálószó",
    "ország",
    "mi",
    "menni",
    "mond / beszél",
    "számára / miatt",
    "gyermek / fiú",
    "élet / születés",
    "tud / fog",
    "megérkezik / elér",
    "idő / óra",
    "akar / kell",
    "kimegy",
    "is / szintén",
    "tanul",
    "le / lent",
    "helyes / jó",
    "menni",
    "képes / tud",
    "után / mögött",
    "akkor / éppen",
    "sok",
    "kicsi",
    "szív / elme",
    "de / azonban",
    "ég / nap",
    "nincs / nélkül",
    "-tól / -ből",
    "az / ott",
    "kap / megszerez",
    "partikula",
    "fog / tart",
]

for _word, _hungarian in zip(HSK1_SAMPLE, _HUNGARIAN):
    _word.hungarian = _hungarian


LOOKUP = {word.chinese: word for word in HSK1_SAMPLE}


DATASET_META = [
    {
        "id": "hsk1_old",
        "label": "HSK1 (old)",
        "standard": "HSK 2.0",
        "count": 150,
        "source": "plaktos/hsk_csv hsk1.csv",
    },
    {
        "id": "hsk2_old",
        "label": "HSK2 (old)",
        "standard": "HSK 2.0 cumulative",
        "count": 300,
        "source": "plaktos/hsk_csv hsk1.csv + hsk2.csv",
    },
    {
        "id": "hsk1_new",
        "label": "HSK1 (new / 3.0)",
        "standard": "HSK 3.0 / 2025",
        "count": 300,
        "source": "Chinese Language Hub hsk-1.json",
    },
    {
        "id": "hsk2_new",
        "label": "HSK2 (new / 3.0)",
        "standard": "HSK 3.0 / 2025 cumulative",
        "count": 497,
        "source": "Chinese Language Hub hsk-1.json + hsk-2.json",
    },
]


def get_hsk1_sample() -> list[dict]:
    return [word.to_dict() for word in get_dataset_words("hsk1_old")[:50]]


def get_dataset_list() -> list[dict]:
    datasets = []
    for item in DATASET_META:
        words = get_dataset_words(item["id"])
        datasets.append({**item, "count": len(words)})
    return datasets


def get_dataset(dataset_id: str | None) -> dict:
    dataset_id = dataset_id or "hsk1_old"
    meta = next((item for item in DATASET_META if item["id"] == dataset_id), DATASET_META[0])
    words = get_dataset_words(meta["id"])
    return {**meta, "count": len(words), "words": [word.to_dict() for word in words]}


@lru_cache(maxsize=8)
def get_dataset_words(dataset_id: str) -> tuple[WordEntry, ...]:
    if dataset_id == "hsk1_old":
        return tuple(_load_old_dataset(["data_hsk_old_1.csv"]))
    if dataset_id == "hsk2_old":
        return tuple(_load_old_dataset(["data_hsk_old_1.csv", "data_hsk_old_2.csv"]))
    if dataset_id == "hsk1_new":
        return tuple(_load_new_dataset(["data_hsk1_new.json"]))
    if dataset_id == "hsk2_new":
        return tuple(_load_new_dataset(["data_hsk1_new.json", "data_hsk2_new.json"]))
    return tuple(HSK1_SAMPLE)


def _load_old_dataset(file_names: list[str]) -> list[WordEntry]:
    rows: list[tuple[str, str, str]] = []
    for file_name in file_names:
        path = ROOT / file_name
        if not path.exists():
            continue
        with path.open(encoding="utf-8-sig", newline="") as file:
            rows.extend((row[0], row[1], row[2]) for row in csv.reader(file) if len(row) >= 3)
    return _rows_to_words(rows)


def _load_new_dataset(file_names: list[str]) -> list[WordEntry]:
    rows: list[tuple[str, str, str]] = []
    for file_name in file_names:
        path = ROOT / file_name
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        rows.extend((item["simplified"], item["pinyin"], item["english"]) for item in data.get("terms", []))
    return _rows_to_words(rows)


def _rows_to_words(rows: list[tuple[str, str, str]]) -> list[WordEntry]:
    russian_by_hanzi = _russian_map_from_chineseplus()
    hungarian_by_hanzi = _hungarian_map_from_new_hsk()
    words: list[WordEntry] = []
    for hanzi, pinyin, english in rows:
        known = LOOKUP.get(hanzi)
        target = known.target if known and known.target else russian_by_hanzi.get(hanzi) or _translate_fallback(english, "ru")
        hungarian = known.hungarian if known and known.hungarian else hungarian_by_hanzi.get(hanzi) or _translate_fallback(english, "hu")
        words.append(
            WordEntry(
                index=len(words) + 1,
                chinese=hanzi,
                pinyin=pinyin,
                english=_clean_english(english),
                target=target,
                hungarian=hungarian,
            )
        )
    return words


@lru_cache(maxsize=1)
def _russian_map_from_chineseplus() -> dict[str, str]:
    pattern = re.compile(
        r"<tr[^>]*>.*?<td><!--t=[^>]+-->(?P<n>\d+).*?"
        r"<h2[^>]*><!--t=[^>]+-->(?P<hanzi>.*?)<!----></h2>.*?"
        r"<td[^>]*q:key=\"zP_1\"><!--t=[^>]+-->(?P<pinyin>.*?)<!----></td>.*?"
        r"<div[^>]*word-wrap:break-word;white-space:normal\"><!--t=[^>]+-->(?P<ru>.*?)<!----></div>",
        re.S,
    )
    result: dict[str, str] = {}
    for file_name in ("data_chineseplus_hsk2_ru.html", "data_chineseplus_hsk2_level2_ru.html"):
        path = ROOT / file_name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in pattern.finditer(text):
            hanzi = _strip_tags(match.group("hanzi"))
            ru = _strip_tags(match.group("ru"))
            if hanzi and ru:
                result[hanzi] = ru
    return result


@lru_cache(maxsize=1)
def _hungarian_map_from_new_hsk() -> dict[str, str]:
    result: dict[str, str] = {}
    for file_name in ("data_hsk1_new.json", "data_hsk2_new.json"):
        path = ROOT / file_name
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("terms", []):
            hanzi = item.get("simplified")
            english = item.get("english")
            if hanzi and english and hanzi not in result:
                result[hanzi] = _translate_fallback(english, "hu")
    return result


def _strip_tags(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = unescape(value)
    return " ".join(value.split())


def _clean_english(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = value.replace("to ", "", 1) if value.startswith("to ") else value
    return value


EXACT_TRANSLATIONS: dict[str, tuple[str, str]] = {
    "love": ("любовь / любить", "szerelem / szeret"),
    "eight": ("восемь", "nyolc"),
    "dad": ("папа", "apa"),
    "father": ("отец", "apa"),
    "hundred": ("сто", "száz"),
    "daytime": ("дневное время", "nappal"),
    "half": ("половина", "fél"),
    "cup": ("чашка / стакан", "csésze / pohár"),
    "side": ("сторона", "oldal"),
    "illness; sick": ("болезнь / больной", "betegség / beteg"),
    "not": ("не / нет", "nem"),
    "dish; vegetable": ("блюдо / овощ", "étel / zöldség"),
    "tea": ("чай", "tea"),
    "sing": ("петь", "énekel"),
    "supermarket": ("супермаркет", "szupermarket"),
    "car; vehicle": ("машина / транспорт", "autó / jármű"),
    "eat": ("есть / кушать", "eszik"),
    "wear": ("носить / надевать", "visel / felvesz"),
    "taxi": ("такси", "taxi"),
    "big; large": ("большой", "nagy"),
    "everyone": ("все", "mindenki"),
    "arrive; to": ("прибывать / до", "megérkezik / -hoz"),
    "university": ("университет", "egyetem"),
    "possessive particle": ("частица принадлежности", "birtokos partikula"),
    "store": ("магазин", "bolt / üzlet"),
    "telephone": ("телефон", "telefon"),
    "computer": ("компьютер", "számítógép"),
    "television": ("телевизор", "televízió"),
    "movie": ("фильм", "film"),
    "younger brother": ("младший брат", "öcs"),
    "things; stuff": ("вещи", "dolgok"),
    "all": ("все", "mind"),
    "read": ("читать", "olvas"),
    "correct; towards": ("правильный / к", "helyes / felé"),
    "sorry": ("извините", "bocsánat"),
    "many; much": ("много", "sok"),
    "two": ("два", "kettő"),
    "son": ("сын", "fiú"),
    "rice; meal": ("рис / еда", "rizs / étkezés"),
    "room": ("комната", "szoba"),
    "very; extremely": ("очень", "nagyon"),
    "airplane": ("самолёт", "repülőgép"),
    "minute": ("минута", "perc"),
    "happy": ("радостный", "boldog"),
    "measure word": ("счётное слово", "számlálószó"),
    "song": ("песня", "dal"),
    "older brother": ("старший брат", "báty"),
    "give; for": ("давать / для", "ad / számára"),
    "company": ("компания", "cég"),
    "work; job": ("работа", "munka"),
    "expensive": ("дорогой", "drága"),
    "country": ("страна", "ország"),
    "still; yet": ("ещё / всё ещё", "még"),
    "child; children": ("ребёнок / дети", "gyerek / gyerekek"),
    "Chinese (language)": ("китайский язык", "kínai nyelv"),
    "Chinese character": ("китайский иероглиф", "kínai írásjegy"),
    "number; date": ("номер / дата", "szám / dátum"),
    "good": ("хороший", "jó"),
    "delicious": ("вкусный", "finom"),
    "beautiful": ("красивый", "szép"),
    "and; with": ("и / с", "és / -val"),
    "to drink": ("пить", "iszik"),
    "very": ("очень", "nagyon"),
    "behind; after": ("сзади / после", "mögött / után"),
    "return; go back": ("возвращаться", "visszatér"),
    "can; will; meeting": ("мочь / собрание", "tud / fog / találkozó"),
    "train": ("поезд", "vonat"),
    "how many; several": ("сколько / несколько", "hány / néhány"),
    "home; family": ("дом / семья", "otthon / család"),
    "to see; to meet": ("видеть / встречать", "lát / találkozik"),
    "call; be named": ("звать / называться", "hív / nevezik"),
    "dumpling": ("пельмень / цзяоцзы", "gombóc / jiaozi"),
    "egg": ("яйцо", "tojás"),
    "older sister": ("старшая сестра", "nővér"),
    "this year": ("этот год", "ez az év"),
    "today": ("сегодня", "ma"),
    "nine": ("девять", "kilenc"),
    "to feel; to think": ("чувствовать / думать", "érez / gondol"),
    "to open; to turn on": ("открывать / включать", "kinyit / bekapcsol"),
    "to see; to look; to watch": ("смотреть / видеть", "néz / lát"),
    "class; lesson": ("урок / занятие", "óra / lecke"),
    "mouth": ("рот", "száj"),
    "to come": ("приходить", "jön"),
    "teacher": ("учитель", "tanár"),
    "cold": ("холодный", "hideg"),
    "inside": ("внутри", "belül"),
    "zero": ("ноль", "nulla"),
    "six": ("шесть", "hat"),
    "question particle": ("вопросительная частица", "kérdő partikula"),
    "sell": ("продавать", "elad"),
    "to buy": ("покупать", "vesz"),
    "busy": ("занятый", "elfoglalt"),
    "mom": ("мама", "anya"),
    "younger sister": ("младшая сестра", "húg"),
    "bread": ("хлеб", "kenyér"),
    "name": ("имя", "név"),
    "that": ("тот / та", "az"),
    "which; where": ("который / где", "melyik / hol"),
    "male": ("мужской", "férfi"),
    "female": ("женский", "női"),
    "friend": ("друг", "barát"),
    "cheap": ("дешёвый", "olcsó"),
    "apple": ("яблоко", "alma"),
    "seven": ("семь", "hét"),
    "front; before": ("перед / до", "elöl / előtt"),
    "money": ("деньги", "pénz"),
    "thousand": ("тысяча", "ezer"),
    "please; invite": ("пожалуйста / приглашать", "kérem / meghív"),
    "to go": ("идти / ехать", "megy"),
    "hot": ("горячий", "forró"),
    "person; people": ("человек / люди", "ember / emberek"),
    "day; date": ("день / дата", "nap / dátum"),
    "three": ("три", "három"),
    "up; go up": ("верх / подниматься", "fel / felmegy"),
    "morning": ("утро", "reggel"),
    "who": ("кто", "ki"),
    "what": ("что", "mi"),
    "ten": ("десять", "tíz"),
    "matter; thing; affair": ("дело / вещь", "ügy / dolog"),
    "is; are; am": ("быть / есть", "lenni"),
    "time": ("время", "idő"),
    "mobile phone": ("мобильный телефон", "mobiltelefon"),
    "book": ("книга", "könyv"),
    "to sleep": ("спать", "alszik"),
    "water": ("вода", "víz"),
    "fruit": ("фрукт", "gyümölcs"),
    "to say; to speak": ("говорить", "mond / beszél"),
    "four": ("четыре", "négy"),
    "he; him": ("он / его", "ő"),
    "she; her": ("она / её", "ő"),
    "too; extremely": ("слишком / очень", "túl / nagyon"),
    "day; sky": ("день / небо", "nap / ég"),
    "weather": ("погода", "időjárás"),
    "listen": ("слушать", "hallgat"),
    "outside; external": ("снаружи / внешний", "kívül / külső"),
    "play, have fun": ("играть / развлекаться", "játszik / szórakozik"),
    "late; evening": ("поздний / вечер", "késő / este"),
    "ask": ("спрашивать", "kérdez"),
    "question": ("вопрос", "kérdés"),
    "I; me": ("я / меня", "én / engem"),
    "we; us": ("мы / нас", "mi / minket"),
    "five": ("пять", "öt"),
    "down; under": ("вниз / под", "le / alatt"),
    "want; think": ("хотеть / думать", "akar / gondol"),
    "Mr.; sir": ("господин", "úr"),
    "now": ("сейчас", "most"),
    "small": ("маленький", "kicsi"),
    "afternoon": ("день / после полудня", "délután"),
    "to write": ("писать", "ír"),
    "some": ("некоторые / немного", "néhány"),
    "thank you": ("спасибо", "köszönöm"),
    "new": ("новый", "új"),
    "week; day of the week": ("неделя / день недели", "hét / hét napja"),
    "Sunday": ("воскресенье", "vasárnap"),
    "rest": ("отдыхать", "pihen"),
    "learn; study": ("учиться", "tanul"),
    "snow": ("снег", "hó"),
    "student": ("студент / ученик", "diák"),
    "school": ("школа", "iskola"),
    "to want; to need": ("хотеть / нужно", "akar / kell"),
    "also; too": ("тоже / также", "is / szintén"),
    "one": ("один", "egy"),
    "doctor": ("врач", "orvos"),
    "hospital": ("больница", "kórház"),
    "chair": ("стул", "szék"),
    "have; there is/are": ("иметь / есть", "van / birtokol"),
    "rain": ("дождь", "eső"),
    "yuan (currency)": ("юань", "jüan"),
    "month; moon": ("месяц / луна", "hónap / hold"),
    "again; once more": ("снова", "újra"),
    "at; in; on": ("в / на / у", "-ban / -ben / -on"),
    "goodbye": ("до свидания", "viszlát"),
    "early; morning": ("ранний / утро", "korán / reggel"),
    "how; why": ("как / почему", "hogyan / miért"),
    "how about": ("как насчёт", "mi lenne"),
    "to look for": ("искать", "keres"),
    "this": ("этот / эта", "ez"),
    "here": ("здесь", "itt"),
    "really; truly": ("действительно", "tényleg / igazán"),
    "only": ("только", "csak"),
    "know": ("знать", "tud / ismer"),
    "China": ("Китай", "Kína"),
    "noon": ("полдень", "dél"),
    "live; reside": ("жить", "lakik / él"),
    "table": ("стол", "asztal"),
    "character; word": ("иероглиф / слово", "írásjegy / szó"),
    "sit; take (transport)": ("сидеть / ехать", "ül / utazik"),
    "do; make": ("делать", "csinál"),
    "yesterday": ("вчера", "tegnap"),
    "don't": ("не надо / не", "ne / ne tedd"),
    "make a phone call": ("звонить по телефону", "telefonál"),
    "o'clock; point": ("час / точка", "óra / pont"),
    "cinema": ("кинотеатр", "mozi"),
    "dog": ("собака", "kutya"),
    "pleasant to hear": ("приятный на слух", "kellemes hallani"),
    "fun; interesting": ("весёлый / интересный", "szórakoztató / érdekes"),
    "item": ("предмет", "darab / tétel"),
    "drive": ("водить машину", "vezet"),
    "cat": ("кот / кошка", "macska"),
    "it doesn't matter": ("ничего / неважно", "nem számít"),
    "don't have; there isn't": ("нет / не иметь", "nincs / nincs neki"),
    "plural marker": ("показатель мн. числа", "többesjel"),
    "noodles": ("лапша", "tészta"),
    "cooked rice": ("варёный рис", "főtt rizs"),
    "tomorrow": ("завтра", "holnap"),
    "over there": ("там", "ott / amott"),
    "that one": ("тот", "az az egy"),
    "which one": ("который", "melyik"),
    "there": ("там", "ott"),
    "where": ("где", "hol"),
    "those": ("те", "azok"),
    "which (plural)": ("которые", "melyek"),
    "hello": ("привет", "szia"),
    "you (plural)": ("вы / вы все", "ti / önök"),
    "you (polite form)": ("вы (вежл.)", "ön"),
    "milk": ("молоко", "tej"),
    "daughter": ("дочь", "lánygyermek"),
    "lady; Ms.": ("госпожа", "hölgy"),
    "get out of bed": ("вставать с кровати", "felkel"),
    "excuse me; may I ask": ("извините / можно спросить", "elnézést / kérdezhetek"),
    "attend class": ("быть на уроке", "órán van"),
    "fall ill": ("заболеть", "megbetegszik"),
    "it": ("оно / это", "az"),
    "they; them (male or mixed group)": ("они", "ők"),
    "they": ("они", "ők"),
    "they; them (female group)": ("они (жен.)", "ők"),
    "hear": ("слышать", "hall"),
    "classmate": ("одноклассник", "osztálytárs"),
    "outside": ("снаружи", "kint / kívül"),
    "dinner": ("ужин", "vacsora"),
    "evening; night": ("вечер / ночь", "este / éjszaka"),
    "feed": ("кормить", "etet"),
    "lunch": ("обед", "ebéd"),
    "finish class": ("закончить урок", "befejezi az órát"),
    "hour": ("час", "óra"),
    "like": ("нравиться", "kedvel / szeret"),
    "a little; some": ("немного", "egy kicsit / néhány"),
    "clothes": ("одежда", "ruha"),
    "a moment, briefly": ("ненадолго / момент", "egy pillanat / röviden"),
    "a little bit": ("немного", "egy kicsit"),
    "breakfast": ("завтрак", "reggeli"),
    "this side; here": ("эта сторона / здесь", "ez az oldal / itt"),
    "this one": ("этот", "ez az egy"),
    "in the process of; currently": ("в процессе / сейчас", "éppen / jelenleg"),
    "these": ("эти", "ezek"),
    "cook": ("готовить", "főz"),
    "ah": ("ах", "á / ah"),
    "hobby": ("хобби", "hobbi"),
    "white": ("белый", "fehér"),
    "class": ("класс / урок", "osztály / óra"),
    "help": ("помогать", "segít"),
    "bag": ("сумка", "táska"),
    "compare; than": ("сравнивать / чем", "összehasonlít / mint"),
    "pen": ("ручка", "toll"),
    "excuse me": ("извините", "elnézést"),
    "long": ("длинный", "hosszú"),
    "station": ("станция", "állomás"),
    "bed": ("кровать", "ágy"),
    "word": ("слово", "szó"),
    "since childhood": ("с детства", "gyerekkor óta"),
    "wrong": ("неправильный", "rossz / hibás"),
    "hit; call; play": ("бить / звонить / играть", "üt / hív / játszik"),
    "take a taxi": ("ехать на такси", "taxival megy"),
    "open": ("открывать", "kinyit"),
    "but": ("но", "de"),
    "wait": ("ждать", "vár"),
    "subway": ("метро", "metró"),
    "move": ("двигать / переезжать", "mozog / költözik"),
    "understand": ("понимать", "ért"),
    "fly": ("летать", "repül"),
    "tall; high": ("высокий", "magas"),
    "tell; inform": ("сообщать", "elmond / tájékoztat"),
    "with; follow": ("с / следовать", "-val / követ"),
    "height": ("рост / высота", "magasság"),
    "bus": ("автобус", "busz"),
    "past": ("прошлый / мимо", "múlt / mellett"),
    "or; still": ("или / всё ещё", "vagy / még"),
    "black": ("чёрный", "fekete"),
    "red color": ("красный цвет", "piros szín"),
    "paint": ("рисовать / красить", "fest / rajzol"),
    "flower": ("цветок", "virág"),
    "classroom": ("классная комната", "tanterem"),
    "airport": ("аэропорт", "repülőtér"),
    "remember": ("помнить", "emlékszik"),
    "introduce": ("представлять", "bemutat"),
    "enter": ("входить", "belép"),
    "close, near": ("близко", "közel"),
    "frequently, often": ("часто", "gyakran"),
    "plane ticket": ("билет на самолёт", "repülőjegy"),
    "start": ("начинать", "kezd"),
    "take a test; examine": ("сдавать экзамен / проверять", "vizsgázik / megvizsgál"),
    "exam": ("экзамен", "vizsga"),
    "possibly": ("возможно", "lehetséges"),
    "fast; quick": ("быстрый", "gyors"),
    "about to": ("собираться", "mindjárt / készül"),
    "pants": ("брюки", "nadrág"),
    "basketball": ("баскетбол", "kosárlabda"),
    "tired": ("усталый", "fáradt"),
    "distance/from": ("расстояние / от", "távolság / -tól"),
    "building; floor": ("здание / этаж", "épület / emelet"),
    "road": ("дорога", "út"),
    "green color": ("зелёный цвет", "zöld szín"),
    "on the road": ("по дороге", "úton"),
    "travel": ("путешествовать", "utazik"),
    "slow": ("медленный", "lassú"),
    "every": ("каждый", "minden"),
    "boring, uninteresting": ("скучный", "unalmas"),
    "door": ("дверь", "ajtó"),
    "entrance; doorway": ("вход", "bejárat"),
    "ticket (for entry)": ("билет", "belépőjegy"),
    "take; to hold": ("брать / держать", "vesz / tart"),
    "grandmother (paternal)": ("бабушка по отцу", "apai nagymama"),
    "then": ("тогда / затем", "akkor / aztán"),
    "boy": ("мальчик", "fiú"),
    "that way": ("так / таким образом", "úgy / arrafelé"),
    "bird": ("птица", "madár"),
    "girl": ("девочка", "lány"),
    "beside; next to": ("рядом", "mellett"),
    "run": ("бегать", "fut"),
    "ticket": ("билет", "jegy"),
    "in front": ("спереди", "elöl"),
    "stand up; to rise": ("вставать / подниматься", "feláll / emelkedik"),
    "sunny": ("солнечный", "napos"),
    "ball; sports": ("мяч / спорт", "labda / sport"),
    "wife": ("жена", "feleség"),
    "let": ("позволять", "enged"),
    "above": ("сверху / выше", "fent / felett"),
    "surf the internet": ("сидеть в интернете", "internetezik"),
    "body; health": ("тело / здоровье", "test / egészség"),
    "thing": ("вещь", "dolog"),
    "hand": ("рука", "kéz"),
    "watch": ("смотреть / часы", "néz / óra"),
    "comfortable": ("удобный", "kényelmes"),
    "give as a gift; escort; deliver": ("дарить / сопровождать / доставлять", "ajándékoz / kísér / kézbesít"),
    "although; even though": ("хотя", "bár / habár"),
    "so; therefore": ("поэтому", "ezért"),
    "pain": ("боль", "fájdalom"),
    "kick": ("пинать", "rúg"),
    "strip": ("полоса", "csík"),
    "dance": ("танцевать", "táncol"),
    "head": ("голова", "fej"),
    "foreign country": ("заграница", "külföld"),
    "finish": ("заканчивать", "befejez"),
    "ten thousand": ("десять тысяч", "tízezer"),
    "forget": ("забывать", "elfelejt"),
    "towards": ("по направлению к", "felé"),
    "online; on the internet": ("онлайн / в интернете", "online / interneten"),
    "position / place (respectful)": ("место (вежл.)", "hely (udvarias)"),
    "why": ("почему", "miért"),
    "wash": ("мыть", "mos"),
    "below": ("ниже / снизу", "lent / alatt"),
    "smile; to laugh": ("улыбаться / смеяться", "mosolyog / nevet"),
    "childhood": ("детство", "gyerekkor"),
    "continue": ("продолжать", "folytat"),
    "surname": ("фамилия", "vezetéknév"),
    "restroom": ("туалет", "mosdó"),
    "hope": ("надеяться", "remél"),
    "eye": ("глаз", "szem"),
    "color": ("цвет", "szín"),
    "medicine": ("лекарство", "gyógyszer"),
    "pharmacy": ("аптека", "gyógyszertár"),
    "grandfather (paternal)": ("дедушка по отцу", "apai nagyapa"),
    "a moment; a while": ("момент / некоторое время", "pillanat / egy ideig"),
    "overcast": ("пасмурный", "borús"),
    "because": ("потому что", "mert"),
    "together": ("вместе", "együtt"),
    "meaning": ("значение", "jelentés"),
    "swim": ("плавать", "úszik"),
    "right (direction)": ("право / направо", "jobb / jobbra"),
    "interesting": ("интересный", "érdekes"),
    "right side": ("правая сторона", "jobb oldal"),
    "fish": ("рыба", "hal"),
    "far": ("далеко", "messze"),
    "exercise/sport": ("упражнение / спорт", "edzés / sport"),
    "stand; station": ("стоять / станция", "áll / állomás"),
    "husband": ("муж", "férj"),
    "indicating continuous action": ("показатель длительного действия", "folyamatos cselekvést jelöl"),
    "so, such": ("такой", "ilyen / olyan"),
    "just; currently": ("как раз / сейчас", "éppen / jelenleg"),
    "this way": ("так / сюда", "így / erre"),
    "week": ("неделя", "hét"),
    "prepare": ("готовить / подготавливать", "készül / előkészít"),
    "oneself": ("сам", "önmaga"),
    "walk": ("ходить пешком", "sétál / gyalogol"),
    "most; the best": ("самый / лучший", "leginkább / legjobb"),
    "left": ("левый", "bal"),
    "left side": ("левая сторона", "bal oldal"),
    "football; soccer": ("футбол", "foci / labdarúgás"),
    "beijing": ("Пекин", "Peking"),
    "train station": ("железнодорожная станция", "vasútállomás"),
    "young lady": ("девушка / мисс", "kisasszony / fiatal hölgy"),
    "assistance": ("помощь", "segítség"),
    "newspaper": ("газета", "újság"),
    "sing a song": ("петь песню", "énekel"),
    "lady; ms": ("госпожа", "hölgy"),
    "behind": ("сзади", "mögött"),
    "child": ("ребёнок", "gyerek"),
    "a boat": ("лодка", "hajó"),
    "play basketball": ("играть в баскетбол", "kosárlabdázik"),
    "first": ("первый", "első"),
    "waiter": ("официант", "pincér"),
    "kilogram (kg)": ("килограмм", "kilogramm"),
    "red": ("красный", "piros"),
    "reply": ("ответ", "válaszol / válasz"),
    "a man": ("мужчина", "férfi"),
    "woman": ("женщина", "nő"),
    "mutton": ("баранина", "birkehús"),
    "open up": ("открывать", "kinyit"),
    "bicycle": ("велосипед", "kerékpár"),
}


KEYWORD_TRANSLATIONS: list[tuple[str, tuple[str, str]]] = [
    ("particle", ("частица", "partikula")),
    ("measure word", ("счётное слово", "számlálószó")),
    ("not", ("не / нет", "nem")),
    ("person", ("человек", "ember")),
    ("people", ("люди", "emberek")),
    ("friend", ("друг", "barát")),
    ("family", ("семья", "család")),
    ("school", ("школа", "iskola")),
    ("student", ("ученик / студент", "diák")),
    ("teacher", ("учитель", "tanár")),
    ("time", ("время", "idő")),
    ("day", ("день", "nap")),
    ("year", ("год", "év")),
    ("month", ("месяц", "hónap")),
    ("money", ("деньги", "pénz")),
    ("food", ("еда", "étel")),
    ("restaurant", ("ресторан", "étterem")),
    ("water", ("вода", "víz")),
    ("tea", ("чай", "tea")),
    ("coffee", ("кофе", "kávé")),
    ("shop", ("магазин", "bolt")),
    ("store", ("магазин", "üzlet")),
    ("work", ("работа", "munka")),
    ("go", ("идти / ехать", "megy")),
    ("come", ("приходить", "jön")),
    ("see", ("видеть", "lát")),
    ("look", ("смотреть", "néz")),
    ("say", ("говорить", "mond")),
    ("speak", ("говорить", "beszél")),
    ("write", ("писать", "ír")),
    ("read", ("читать", "olvas")),
    ("study", ("учиться", "tanul")),
    ("learn", ("учиться", "tanul")),
    ("buy", ("покупать", "vesz")),
    ("sell", ("продавать", "elad")),
    ("eat", ("есть", "eszik")),
    ("drink", ("пить", "iszik")),
    ("sleep", ("спать", "alszik")),
    ("big", ("большой", "nagy")),
    ("small", ("маленький", "kicsi")),
    ("good", ("хороший", "jó")),
    ("bad", ("плохой", "rossz")),
    ("hot", ("горячий", "forró")),
    ("cold", ("холодный", "hideg")),
    ("many", ("много", "sok")),
    ("much", ("много", "sok")),
    ("few", ("мало", "kevés")),
    ("number", ("номер / число", "szám")),
    ("question", ("вопрос", "kérdés")),
    ("can", ("мочь", "tud")),
    ("want", ("хотеть", "akar")),
    ("need", ("нужно", "kell")),
    ("think", ("думать", "gondol")),
    ("know", ("знать", "tud / ismer")),
    ("love", ("любить", "szeret")),
]


def _translate_fallback(english: str, language: str) -> str:
    cleaned = _clean_english(english)
    normalized = cleaned.lower().strip(" .")
    exact = EXACT_TRANSLATIONS.get(normalized)
    if exact is None:
        exact = next((value for key, value in EXACT_TRANSLATIONS.items() if key.lower() == normalized), None)
    if exact:
        return exact[0 if language == "ru" else 1]
    if any(separator in normalized for separator in (";", ",", " / ")):
        parts = [part.strip() for part in re.split(r";|,| / ", cleaned) if part.strip()]
        translated = [_translate_fallback(part, language) for part in parts[:3]]
        if translated and any(part.lower() != original.lower() for part, original in zip(translated, parts)):
            return " / ".join(translated)
    for keyword, translations in KEYWORD_TRANSLATIONS:
        if keyword in normalized:
            return translations[0 if language == "ru" else 1]
    return cleaned


def enrich_words(raw_words: list[dict]) -> list[dict]:
    enriched: list[dict] = []
    for i, item in enumerate(raw_words):
        word = WordEntry.from_dict(item, i + 1)
        known = LOOKUP.get(word.chinese)
        locks = set(word.lockedFields)
        if known:
            if not word.pinyin and "pinyin" not in locks:
                word.pinyin = known.pinyin
            if not word.english and "english" not in locks:
                word.english = known.english
            if not word.target and "target" not in locks:
                word.target = known.target
            if not word.hungarian and "hungarian" not in locks:
                word.hungarian = known.hungarian
        enriched.append(word.to_dict())
    return enriched
