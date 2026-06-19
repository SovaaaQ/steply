from __future__ import annotations

import re

from app.core.gamification_rules import getRecoveryTask
from app.models import Habit, Prediction, Recommendation, User

from .constants import (
    AFTER_COMPLETION_RECOMMENDATION_TYPE,
    DATA_COLLECTION_RECOMMENDATION_TYPE,
    EARLY_RECOVERY_RECOMMENDATION_TYPE,
    FIRST_STEP_RECOMMENDATION_TYPE,
    KEEP_REGULAR_RECOMMENDATION_TYPE,
    MAX_RECOMMENDATION_MESSAGE_WORDS,
    MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE,
    ON_TRACK_SUPPORT_RECOMMENDATION_TYPE,
    PLAN_AHEAD_RECOMMENDATION_TYPE,
    RESET_PLAN_RECOMMENDATION_TYPE,
    RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE,
    RISK_RECOVERY_RECOMMENDATION_TYPE,
    SOFT_RECOVERY_RECOMMENDATION_TYPE,
    STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
    STREAK_SUPPORT_RECOMMENDATION_TYPE,
    _RECOVERY_SCENARIO_TYPES,
)


_LIST_TAIL_PATTERN = re.compile(r"\b(?:Шаги|Действия)\s*:", re.IGNORECASE)
_NUMBERED_TAIL_PATTERN = re.compile(r"(?:^|\s)\d+[.)]\s+.*$", re.DOTALL)
_LONG_DASH_PATTERN = re.compile(r"[—–−]+")
_WHITESPACE_PATTERN = re.compile(r"\s+")
_AWKWARD_CONTEXT_REPLACEMENTS = (
    (
        re.compile(r"\bрядом с местом для вечера\b", re.IGNORECASE),
        "на видное место на вечер",
    ),
    (re.compile(r"\bместо для вечера\b", re.IGNORECASE), "видное место на вечер"),
    (re.compile(r"\bместом для вечера\b", re.IGNORECASE), "видным местом на вечер"),
)

_EQUIPMENT_BY_KEYWORD = (
    ("скакал", "скакалка", "скакалку"),
    ("кроссов", "кроссовки", "кроссовки"),
    ("коврик", "коврик", "коврик"),
    ("гантел", "гантели", "гантели"),
    ("резинк", "резинка", "резинку"),
    ("бутыл", "бутылка воды", "бутылку воды"),
)

_LEARNING_KEYWORDS = (
    "диплом",
    "курсов",
    "учеб",
    "проект",
    "курс",
    "урок",
    "лекц",
    "конспект",
    "матем",
)
_HEALTH_KEYWORDS = (
    "здоров",
    "сон",
    "спать",
    "засып",
    "вод",
    "лекар",
    "таблет",
    "витамин",
    "питани",
    "завтрак",
    "давлен",
    "самочув",
    "медитац",
    "дыхани",
)
_LEISURE_KEYWORDS = (
    "отдых",
    "игр",
    "хобби",
    "музык",
    "гитар",
    "рисова",
    "рисун",
    "творч",
    "фильм",
    "сериал",
    "танц",
    "прогул",
)


def _clean_text(value: str) -> str:
    without_dashes = _LONG_DASH_PATTERN.sub(" ", value.replace(" ", " "))
    return _WHITESPACE_PATTERN.sub(" ", without_dashes).strip()


def _feature_int(features: dict, key: str, default: int = 0) -> int:
    try:
        return int(features.get(key) or default)
    except (TypeError, ValueError):
        return default


def _feature_float(features: dict, key: str, default: float = 0.0) -> float:
    try:
        return float(features.get(key) or default)
    except (TypeError, ValueError):
        return default


def _feature_bool(features: dict, key: str) -> bool:
    return bool(features.get(key))


def _lower_first(value: str) -> str:
    text = value.strip()
    if not text:
        return text
    return f"{text[0].lower()}{text[1:]}"


def _capitalize_first_letter(value: str) -> str:
    text = value.strip()
    for index, char in enumerate(text):
        if char.isalpha():
            return f"{text[:index]}{char.upper()}{text[index + 1:]}"
    return text


def _habit_text_field(habit: Habit, field: str) -> str:
    value = getattr(habit, field, "")
    return value if isinstance(value, str) else ""


def _habit_context_text(habit: Habit) -> str:
    return f"{_habit_text_field(habit, 'title')} {_habit_text_field(habit, 'description')}".lower()


def _equipment_forms(habit: Habit | None = None, text: str = "") -> tuple[str, str] | None:
    context = text.lower()
    if habit is not None:
        context = f"{_habit_context_text(habit)} {context}"

    for keyword, nominative, accusative in _EQUIPMENT_BY_KEYWORD:
        if keyword in context:
            return nominative, accusative

    return None


def _has_any_keyword(context: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in context for keyword in keywords)


def _habit_topic(habit: Habit) -> str:
    context = _habit_context_text(habit)
    if any(keyword in context for keyword in ("англий", "english", "слова", "язык")):
        return "language"
    if _has_any_keyword(context, _LEARNING_KEYWORDS):
        return "study"
    if any(keyword in context for keyword in ("python", "пайтон", "код", "программ")):
        return "code"
    if any(keyword in context for keyword in ("чтен", "книг")):
        return "reading"
    if any(keyword in context for keyword in ("курен", "сигар", "никотин")):
        return "smoking"
    if any(
        keyword in context
        for keyword in ("спорт", "трен", "заряд", "скакал", "прыж", "пробеж", "гантел", "йог")
    ):
        return "sport"
    if _has_any_keyword(context, _HEALTH_KEYWORDS):
        return "health"
    if _has_any_keyword(context, _LEISURE_KEYWORDS):
        return "leisure"
    return "general"


def _health_focus(habit: Habit) -> str:
    context = _habit_context_text(habit)
    if any(keyword in context for keyword in ("сон", "спать", "засып")):
        return "sleep"
    if "вод" in context:
        return "water"
    if any(keyword in context for keyword in ("лекар", "таблет", "витамин")):
        return "medicine"
    if any(keyword in context for keyword in ("питани", "завтрак", "обед", "ужин")):
        return "nutrition"
    if any(keyword in context for keyword in ("медитац", "дыхани")):
        return "calm"
    return "general"


def _leisure_focus(habit: Habit) -> str:
    context = _habit_context_text(habit)
    if any(keyword in context for keyword in ("рисова", "рисун", "творч")):
        return "drawing"
    if any(keyword in context for keyword in ("музык", "гитар")):
        return "music"
    if any(keyword in context for keyword in ("фильм", "сериал")):
        return "watching"
    if any(keyword in context for keyword in ("прогул", "танц")):
        return "movement"
    if "игр" in context:
        return "game"
    return "general"


def _habit_title_fragment(habit: Habit) -> str:
    title = _clean_text(getattr(habit, "title", "") or "привычка")
    return f"«{title}»"


def _preferred_time_fragment(habit: Habit) -> str:
    preferred_time = getattr(habit, "preferred_time", None)
    if not preferred_time:
        return ""
    if hasattr(preferred_time, "strftime"):
        return f" в {preferred_time.strftime('%H:%M')}"
    text = str(preferred_time)
    if len(text) >= 5:
        return f" в {text[:5]}"
    return ""


def _has_custom_recovery_task(habit: Habit) -> bool:
    recovery_task = getattr(habit, "recovery_task", None)
    return isinstance(recovery_task, str) and bool(recovery_task.strip())


def _recovery_task_fragment(habit: Habit) -> str:
    if not _has_custom_recovery_task(habit):
        topic = _habit_topic(habit)
        if topic == "language":
            return "повторите три знакомых слова вслух или один короткий диалог"
        if topic == "study":
            return "откройте файл и поправьте один абзац или два пункта плана"
        if topic == "code":
            return "запустите редактор и повторите один простой пример кода"
        if topic == "reading":
            return "откройте книгу на закладке и прочитайте один короткий фрагмент"
        if topic == "sport":
            return "сделайте две минуты разминки без полной тренировки"
        if topic == "smoking":
            return "отложите первую сигарету и запишите, что именно запустило желание"
        if topic == "health":
            focus = _health_focus(habit)
            if focus == "sleep":
                return "уберите экран и подготовьте место для сна на несколько минут"
            if focus == "water":
                return "налейте стакан воды и поставьте его рядом"
            if focus == "medicine":
                return "сверьтесь со своим напоминанием или назначением без изменения дозировки"
            if focus == "nutrition":
                return "подготовьте один простой прием пищи или полезную заготовку"
            if focus == "calm":
                return "сделайте одну спокойную минуту дыхания без оценки результата"
            return "сделайте один безопасный шаг для самочувствия без резкой нагрузки"
        if topic == "leisure":
            focus = _leisure_focus(habit)
            if focus == "drawing":
                return "откройте материалы и сделайте один быстрый набросок"
            if focus == "music":
                return "возьмите инструмент или откройте трек и начните с одной минуты"
            if focus == "watching":
                return "выберите один короткий эпизод или фрагмент без автопродолжения"
            if focus == "movement":
                return "выйдите на короткую прогулку или включите один трек для движения"
            if focus == "game":
                return "запустите один короткий раунд с заранее понятной остановкой"
            return "выделите короткий приятный слот без цели сделать идеально"
        return "сделайте самый маленький видимый шаг"
    return _lower_first(getRecoveryTask(habit).strip().rstrip(" ."))


def _primary_action_fragment(habit: Habit) -> str:
    title = _habit_title_fragment(habit)
    time_hint = _preferred_time_fragment(habit)
    topic = _habit_topic(habit)
    if topic == "language":
        return "повторите вслух три знакомых слова и один короткий диалог"
    if topic == "study":
        return f"откройте файл {title}{time_hint} и поправьте один конкретный абзац"
    if topic == "code":
        return "откройте редактор и запустите один короткий пример кода"
    if topic == "reading":
        return "откройте книгу на закладке и прочитайте один короткий фрагмент"
    if topic == "sport":
        return "сделайте короткую разминку и завершите на первом легком повторе"
    if topic == "smoking":
        return "отложите первую сигарету, выпейте воды и отметьте момент тяги"
    if topic == "health":
        focus = _health_focus(habit)
        if focus == "sleep":
            return "подготовьте сон: уберите экран и сделайте комнату чуть спокойнее"
        if focus == "water":
            return "налейте стакан воды, выпейте комфортный объем и отметьте привычку"
        if focus == "medicine":
            return "сверьтесь со своим напоминанием или назначением и отметьте факт выполнения"
        if focus == "nutrition":
            return "подготовьте простой прием пищи без усложнения и отметьте результат"
        if focus == "calm":
            return "сделайте одну спокойную минуту дыхания и отметьте паузу"
        return "выполните небольшой безопасный шаг для самочувствия и отметьте его"
    if topic == "leisure":
        focus = _leisure_focus(habit)
        if focus == "drawing":
            return "откройте материалы и сделайте один быстрый набросок без оценки"
        if focus == "music":
            return "возьмите инструмент или включите трек и уделите этому одну короткую минуту"
        if focus == "watching":
            return "выберите короткий фрагмент для отдыха и остановитесь после него"
        if focus == "movement":
            return "выйдите на короткую прогулку или подвигайтесь под один трек"
        if focus == "game":
            return "сыграйте один короткий раунд и заранее выберите точку остановки"
        return "начните приятное занятие с короткого слота без требования результата"
    return f"сделайте один короткий шаг для {title}"


def _minimum_action_fragment(habit: Habit) -> str:
    if _has_custom_recovery_task(habit):
        return f"только {_recovery_task_fragment(habit)}"

    topic = _habit_topic(habit)
    if topic == "language":
        return "только три слова вслух без новой темы"
    if topic == "study":
        return "только откройте документ и выделите место следующей правки"
    if topic == "code":
        return "только откройте редактор и добавьте одну строку"
    if topic == "reading":
        return "одна страница с закладки без нормы по времени"
    if topic == "sport":
        return "две минуты разминки без полной тренировки"
    if topic == "smoking":
        return "пауза без спора с собой: вода, дыхание и запись триггера"
    if topic == "health":
        focus = _health_focus(habit)
        if focus == "sleep":
            return "только уберите экран и приглушите свет"
        if focus == "water":
            return "только поставьте стакан воды рядом"
        if focus == "medicine":
            return "только откройте напоминание и проверьте назначение"
        if focus == "nutrition":
            return "только подготовьте один простой продукт или тарелку"
        if focus == "calm":
            return "только один спокойный вдох и выдох"
        return "один безопасный микрошаг без попытки резко менять режим"
    if topic == "leisure":
        focus = _leisure_focus(habit)
        if focus == "drawing":
            return "только откройте материалы и проведите одну линию"
        if focus == "music":
            return "только возьмите инструмент или включите один фрагмент"
        if focus == "watching":
            return "только выберите короткий фрагмент без автопродолжения"
        if focus == "movement":
            return "только выйдите на несколько минут или включите один трек"
        if focus == "game":
            return "только один короткий раунд без продления"
        return "пять минут приятного занятия без цели закончить"
    return "один видимый шаг без полной версии привычки"


def _completion_criteria_fragment(habit: Habit) -> str:
    title = _habit_title_fragment(habit)
    topic = _habit_topic(habit)
    if topic == "language":
        return "слова произнесены или завершен один короткий диалог"
    if topic == "study":
        return "файл сохранен с одной правкой или двумя пунктами плана"
    if topic == "code":
        return "редактор открыт, пример запущен или одна строка изменена"
    if topic == "reading":
        return "фрагмент дочитан и чтение отмечено"
    if topic == "sport":
        return "разминка сделана и отмечена"
    if topic == "smoking":
        return (
            "пауза отмечена и триггер записан; при сильной тяге стоит обратиться "
            "к специалисту"
        )
    if topic == "health":
        focus = _health_focus(habit)
        if focus == "medicine":
            return "назначение проверено, факт выполнения отмечен; дозировки не менялись"
        if focus == "sleep":
            return "условия для сна подготовлены и шаг отмечен"
        if focus == "water":
            return "вода подготовлена или выпита в комфортном объеме, отметка добавлена"
        return "безопасный шаг для самочувствия сделан и отмечен"
    if topic == "leisure":
        return "короткий отдых начат, точка остановки понятна и шаг отмечен"
    return f"шаг для {title} отмечен в приложении"


def _setup_fragment(habit: Habit) -> str:
    topic = _habit_topic(habit)
    equipment = _equipment_forms(habit)

    if topic == "language":
        return "оставьте список слов открытым на первом экране или закладке"
    if topic == "study":
        return "откройте документ на нужном месте и оставьте пометку для следующей правки"
    if topic == "code":
        return "откройте проект и оставьте рядом одну понятную задачу для следующего запуска"
    if topic == "reading":
        return "положите книгу с закладкой на видное место"
    if topic == "sport":
        if equipment:
            nominative, accusative = equipment
            if nominative == "кроссовки":
                return "поставьте кроссовки на видное место для следующего выхода"
            return f"положите {accusative} на видное место для следующей короткой разминки"
        return "подготовьте одежду или инвентарь для следующей короткой разминки"
    if topic == "smoking":
        return "запишите триггер и подготовьте воду для следующей паузы"
    if topic == "health":
        focus = _health_focus(habit)
        if focus == "sleep":
            return "оставьте телефон вне кровати и подготовьте спокойный свет"
        if focus == "water":
            return "поставьте стакан или бутылку воды на видное место"
        if focus == "medicine":
            return "проверьте напоминание и оставьте его на привычном месте"
        if focus == "nutrition":
            return "оставьте простую заготовку или список продуктов на видном месте"
        return "оставьте безопасную подсказку для следующего шага самочувствия"
    if topic == "leisure":
        focus = _leisure_focus(habit)
        if focus == "drawing":
            return "положите материалы на видное место для короткого наброска"
        if focus == "music":
            return "оставьте инструмент или плейлист готовым к короткому старту"
        if focus == "watching":
            return "выберите короткий фрагмент заранее и отключите автопродолжение"
        if focus == "game":
            return "выберите один короткий режим и точку остановки заранее"
        return "подготовьте приятное занятие так, чтобы начать без долгого выбора"
    return "оставьте видимую подсказку для следующего короткого шага"


def _repair_message_naturalness(value: str, habit: Habit | None = None) -> str:
    text = value
    for pattern, replacement in _AWKWARD_CONTEXT_REPLACEMENTS:
        text = pattern.sub(replacement, text)

    text = re.sub(r"\bследующ(?:ий|его)\s+лучший\s+шаг\b", "следующий шаг", text, flags=re.IGNORECASE)
    text = re.sub(r"\bспокойные\s+подсказки\b", "подсказки по риску", text, flags=re.IGNORECASE)
    text = re.sub(r"\bбез\s+давления\b", "без перегруза", text, flags=re.IGNORECASE)
    text = re.sub(r"\bбарьер\s+снижен\s+до\s+пропуска\b", "риск снижен до минимума", text, flags=re.IGNORECASE)
    text = re.sub(r"\bуберите\s+барьер\b", "сделайте старт проще", text, flags=re.IGNORECASE)

    equipment = _equipment_forms(habit, text)
    if equipment:
        nominative, accusative = equipment
        text = re.sub(
            r"\bСнаряд(?=\s+лежит\b)",
            nominative.capitalize(),
            text,
        )
        text = re.sub(r"\bснаряд(?=\s+лежит\b)", nominative, text)
        text = re.sub(r"\bСнаряд\b", accusative.capitalize(), text)
        text = re.sub(r"\bснаряд\b", accusative, text)
    else:
        text = re.sub(r"\bСнаряд\b", "Инвентарь", text)
        text = re.sub(r"\bснаряд\b", "инвентарь", text)

    return text


def _strip_terminal_punctuation(value: str) -> str:
    return value.rstrip(" ,;:.!?")


def _sentence_fragment(value: str) -> str:
    return _capitalize_first_letter(_clean_text(value).rstrip(" ,;:.!?"))


def _format_minutes(value: int | None) -> str:
    minutes = max(int(value or 5), 1)
    if minutes % 10 == 1 and minutes % 100 != 11:
        unit = "минута"
    elif minutes % 10 in {2, 3, 4} and minutes % 100 not in {12, 13, 14}:
        unit = "минуты"
    else:
        unit = "минут"
    return f"{minutes} {unit}"


def _recovery_time_fragment(habit: Habit) -> str:
    return _format_minutes(getattr(habit, "recovery_minutes", None))


def _action_plan_message(today: str, minimum: str, done: str) -> str:
    return (
        f"Сегодня: {_sentence_fragment(today)} "
        f"Минимум: {_sentence_fragment(minimum)} "
        f"Готово: {_sentence_fragment(done)}"
    )


def _strip_list_tail(value: str) -> str:
    text = value.strip()
    marker = _LIST_TAIL_PATTERN.search(text)
    if marker:
        text = text[: marker.start()]
    text = _NUMBERED_TAIL_PATTERN.sub("", text)
    return text


def _strip_outer_quotes(value: str) -> str:
    text = value.strip()
    quote_pairs = {
        '"': '"',
        "'": "'",
        "«": "»",
        "“": "”",
        "„": "“",
    }
    while len(text) >= 2 and text[0] in quote_pairs and text[-1] == quote_pairs[text[0]]:
        text = text[1:-1].strip()
    return text


def _normalize_recommendation_message(value: str, habit: Habit | None = None) -> str:
    text = _strip_outer_quotes(
        _clean_text(_repair_message_naturalness(_strip_list_tail(value), habit))
    )
    if not text:
        text = _strip_outer_quotes(_clean_text(_repair_message_naturalness(value, habit)))

    words = text.split()
    if len(words) > MAX_RECOMMENDATION_MESSAGE_WORDS:
        text = " ".join(words[:MAX_RECOMMENDATION_MESSAGE_WORDS])

    return _strip_terminal_punctuation(text)


def _normalize_recommendation(recommendation: Recommendation, habit: Habit | None = None) -> None:
    recommendation.title = _strip_terminal_punctuation(_clean_text(recommendation.title))
    recommendation.message = _normalize_recommendation_message(recommendation.message, habit)


def _has_configured_pet(user: User) -> bool:
    return bool(user.pet_type and user.pet_name)


def _should_create_first_step_recommendation(
    user: User,
    prediction: Prediction,
    active_habit_count: int,
) -> bool:
    features = prediction.features or {}
    total_entries = _feature_int(features, "total_entries")

    return (
        active_habit_count == 1
        and total_entries == 0
        and _has_configured_pet(user)
    )


def _build_first_step_recommendation_text(user: User, habit: Habit) -> tuple[str, str, str, str]:
    pet_name = _clean_text(user.pet_name or "")
    pet_hint = f", а {pet_name} получит первый повод радоваться" if pet_name else ""
    action = _primary_action_fragment(habit)
    minimum = _minimum_action_fragment(habit)
    done = _completion_criteria_fragment(habit)

    return (
        FIRST_STEP_RECOMMENDATION_TYPE,
        "Первый шаг",
        _action_plan_message(
            f"сделайте самый маленький шаг для «{habit.title}»: {action}",
            minimum,
            f"{done}, поставлена первая отметка{pet_hint}",
        ),
        "normal",
    )


def _build_recommendation_text(
    user: User,
    habit: Habit,
    prediction: Prediction,
    active_habit_count: int,
    previous_type: str | None = None,
) -> tuple[str, str, str, str]:
    features = prediction.features or {}
    total_entries = _feature_int(features, "total_entries")
    missed_count = _feature_int(features, "missed_count")
    current_streak = _feature_int(features, "current_streak")
    consecutive_missed = _feature_int(features, "consecutive_missed")
    completed_last_7 = _feature_int(features, "completed_last_7_days")
    missed_last_7 = _feature_int(features, "missed_last_7_days")
    total_last_7 = _feature_int(
        features,
        "total_last_7_days",
        completed_last_7 + missed_last_7,
    )
    days_since_last = features.get("days_since_last_completion")
    recent_miss_rate = _feature_float(features, "recent_miss_rate")
    completion_rate = _feature_float(features, "completion_rate")
    completion_rate_last_7 = _feature_float(features, "completion_rate_last_7")
    completed_today = _feature_bool(features, "completed_today")
    missed_today = _feature_bool(features, "missed_today")
    recovery_task = _recovery_task_fragment(habit)
    primary_action = _primary_action_fragment(habit)
    minimum_action = _minimum_action_fragment(habit)
    completion_criteria = _completion_criteria_fragment(habit)
    is_on_track_period = (
        total_last_7 >= 3
        and missed_last_7 == 0
        and completion_rate_last_7 >= 0.8
    )
    previous_was_recovery = previous_type in _RECOVERY_SCENARIO_TYPES

    if _should_create_first_step_recommendation(user, prediction, active_habit_count):
        return _build_first_step_recommendation_text(user, habit)

    if completed_today:
        if current_streak >= 3 or is_on_track_period:
            series_text = (
                f"серия уже {current_streak} подряд"
                if current_streak >= 2
                else "последние отметки идут без пропусков"
            )
            return (
                STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
                "Удержать серию",
                _action_plan_message(
                    (
                        "закрепите сегодняшнюю отметку и подготовьте место к следующему повтору: "
                        f"{_setup_fragment(habit)}"
                    ),
                    "только оставьте одну видимую подсказку без нового подхода сегодня",
                    f"следующий старт понятен заранее, {series_text}",
                ),
                "low",
            )

        if total_entries <= 2:
            return (
                AFTER_COMPLETION_RECOMMENDATION_TYPE,
                "После отметки",
                _action_plan_message(
                    f"оставьте видимую подсказку для следующего выполнения: {_setup_fragment(habit)}",
                    "не делайте второй подход сегодня, пока привычка только закрепляется",
                    "сегодняшняя отметка уже засчитана, следующий старт подготовлен",
                ),
                "normal",
            )

        return (
            ON_TRACK_SUPPORT_RECOMMENDATION_TYPE,
            "Идет по плану",
            _action_plan_message(
                (
                    "подготовьте первый понятный шаг для следующего выполнения: "
                    f"{_setup_fragment(habit)}"
                ),
                "только оставьте подсказку на видном месте без новой нагрузки сегодня",
                "следующий повтор можно начать без долгой подготовки",
            ),
            "low",
        )

    if (
        previous_was_recovery
        and consecutive_missed >= 3
        and (prediction.risk_level == "high" or recent_miss_rate >= 0.45)
    ):
        return (
            RISK_IGNORED_RECOVERY_RECOMMENDATION_TYPE,
            "Пересоберите условия",
            _action_plan_message(
                f"уберите полную версию на сегодня и оставьте только точку входа: {recovery_task}",
                f"{minimum_action}; если не получается, уменьшите условие еще вдвое",
                f"условия облегчены, засчитан минимальный шаг; {completion_criteria}",
            ),
            "high",
        )

    if consecutive_missed >= 5 or (
        total_last_7 >= 5 and missed_last_7 >= 4 and completion_rate_last_7 <= 0.2
    ):
        return (
            RESET_PLAN_RECOMMENDATION_TYPE,
            "План перезапуска",
            _action_plan_message(
                f"начните новый цикл «{habit.title}» без старой нормы: {recovery_task}",
                f"{minimum_action} без попытки закрыть всю паузу",
                f"план упрощен, отмечен первый шаг перезапуска; {completion_criteria}",
            ),
            "high",
        )

    if consecutive_missed >= 2:
        return (
            MISS_STREAK_RECOVERY_RECOMMENDATION_TYPE,
            "Разорвать пропуски",
            _action_plan_message(
                f"разорвите серию пропусков одним минимальным шагом: {recovery_task}",
                f"{minimum_action} без компенсации прошлых дней",
                f"серия пропусков остановлена новой отметкой; {completion_criteria}",
            ),
            "high" if consecutive_missed >= 3 else "normal",
        )

    if total_entries < 3 and (missed_count > 0 or missed_today):
        return (
            EARLY_RECOVERY_RECOMMENDATION_TYPE,
            "После первого пропуска",
            _action_plan_message(
                f"сразу закройте первый разрыв коротким вариантом: {recovery_task}",
                f"{minimum_action} без компенсации первого пропуска",
                f"первый пропуск не стал серией; {completion_criteria}",
            ),
            "normal",
        )

    if prediction.risk_level == "high":
        return (
            RISK_RECOVERY_RECOMMENDATION_TYPE,
            "Снизить риск",
            _action_plan_message(
                f"сделайте шаг меньше до пропуска: {recovery_task}",
                f"{minimum_action} до обычного времени или ближайшего свободного окна",
                f"риск снижен, отмечен минимум; {completion_criteria}",
            ),
            "high",
        )

    if prediction.risk_level == "medium":
        if recent_miss_rate >= 0.25 or missed_last_7 > 0 or consecutive_missed == 1:
            return (
                SOFT_RECOVERY_RECOMMENDATION_TYPE,
                "Сделать легче",
                _action_plan_message(
                    f"снизьте объем «{habit.title}» до короткой версии: {recovery_task}",
                    minimum_action,
                    f"минимальная версия завершена; {completion_criteria}",
                ),
                "normal",
            )
        return (
            PLAN_AHEAD_RECOMMENDATION_TYPE,
            "Запланируйте заранее",
            _action_plan_message(
                f"выберите конкретное окно для «{habit.title}» и подготовьте первый шаг: {primary_action}",
                minimum_action,
                "время и место старта понятны до выполнения",
            ),
            "normal",
        )

    if total_entries < 3:
        return (
            DATA_COLLECTION_RECOMMENDATION_TYPE,
            "Пока рано считать риск",
            _action_plan_message(
                primary_action,
                minimum_action,
                f"добавлена отметка; {completion_criteria}",
            ),
            "normal",
        )

    if current_streak >= 3:
        return (
            STREAK_SUPPORT_RECOMMENDATION_TYPE,
            "Серия укрепляется",
            _action_plan_message(
                f"подготовьте следующий повтор «{habit.title}» без усложнения цели: {primary_action}",
                minimum_action,
                f"серия {current_streak} подряд защищена от резкого роста нагрузки",
            ),
            "low",
        )

    if is_on_track_period:
        return (
            STREAK_MAINTENANCE_RECOMMENDATION_TYPE,
            "Ритм держится",
            _action_plan_message(
                f"оставьте «{habit.title}» в том же формате и выберите мини-версию для сложного дня",
                minimum_action,
                "есть понятный план на обычный и облегченный повтор",
            ),
            "low",
        )

    if days_since_last is not None and int(days_since_last) > 2:
        return (
            SOFT_RECOVERY_RECOMMENDATION_TYPE,
            "Вернитесь к ритму",
            _action_plan_message(
                f"верните «{habit.title}» через короткий шаг: {recovery_task}",
                f"{minimum_action} без попытки наверстать все сразу",
                f"возвращение отмечено; {completion_criteria}",
            ),
            "normal",
        )

    return (
        KEEP_REGULAR_RECOMMENDATION_TYPE,
        "Ритм держится",
        _action_plan_message(
            primary_action,
            minimum_action,
            f"отметка добавлена, текущая регулярность {round(completion_rate * 100)}% сохранена",
        ),
        "low",
    )
