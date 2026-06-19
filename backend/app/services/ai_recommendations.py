from __future__ import annotations

import json
import logging
import re
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from app.core.config import get_settings
from app.models import Habit, Prediction, User


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AIRecommendationDraft:
    title: str
    message: str


MAX_TITLE_CHARS = 70
MAX_MESSAGE_CHARS = 520
MAX_MESSAGE_WORDS = 56

_ACTION_PLAN_LABEL_PATTERN = re.compile(
    r"(?:^|\s)(Сегодня|Минимум|Готово)\s*:\s*",
    re.IGNORECASE,
)
_ACTIVE_TODAY_VERBS_PATTERN = re.compile(
    r"\b(?:сделайте|выполните|прыг\w*|прыж\w*|напишите|прочитайте|повторите|"
    r"запустите|позанимайтесь|потренируйтесь)\b",
    re.IGNORECASE,
)
_FOLLOW_UP_WORD_PATTERN = re.compile(
    r"\b(?:следующ\w*|завтра|подготов\w*|остав\w*|полож\w*|постав\w*|"
    r"заплан\w*|закреп\w*)\b",
    re.IGNORECASE,
)
_BAD_AI_PHRASES = (
    "место для вечера",
    "местом для вечера",
    "места для вечера",
    "вечернее место",
    "уберите барьер",
    "барьер снижен",
    "следующий лучший шаг",
    "спокойные подсказки",
    "без давления",
)
_LEARNING_KEYWORDS = (
    "англий",
    "english",
    "слова",
    "язык",
    "диплом",
    "курсов",
    "учеб",
    "проект",
    "курс",
    "урок",
    "лекц",
    "конспект",
    "python",
    "пайтон",
    "код",
    "программ",
    "чтен",
    "книг",
)
_SPORT_KEYWORDS = ("спорт", "трен", "заряд", "скакал", "прыж", "пробеж", "гантел", "йог")
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
    "курен",
    "сигар",
    "никотин",
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
_EQUIPMENT_BY_KEYWORD = (
    ("скакал", "скакалка", "скакалку"),
    ("кроссов", "кроссовки", "кроссовки"),
    ("коврик", "коврик", "коврик"),
    ("гантел", "гантели", "гантели"),
    ("резинк", "резинка", "резинку"),
    ("бутыл", "бутылка воды", "бутылку воды"),
)
_UNSAFE_HEALTH_ADVICE_PATTERN = re.compile(
    r"\b(?:измени(?:те)?|увелич(?:ьте|ить)|уменьш(?:ьте|ить)|отмен(?:ите|ить)|"
    r"назнач(?:ьте|ить)|прекрат(?:ите|ить)|замен(?:ите|ить))\b.{0,40}"
    r"\b(?:доз\w*|лекар\w*|таблет\w*|препарат\w*|назначени\w*)\b",
    re.IGNORECASE,
)
_FOOD_AND_JUMP_PATTERN = re.compile(
    r"\b(?:после|сразу после)\s+(?:ужина|обеда|еды|приема пищи)\b.{0,80}"
    r"\b(?:прыг\w*|прыж\w*|скакал\w*)\b",
    re.IGNORECASE,
)


def _clean_text(value: str) -> str:
    without_dashes = value.replace("\u00a0", " ")
    for dash in ("—", "–", "−"):
        without_dashes = without_dashes.replace(dash, " ")
    return " ".join(without_dashes.split()).strip()


def _clip_text(value: str, max_length: int) -> str:
    text = _clean_text(value)
    if len(text) <= max_length:
        return text
    clipped = text[: max_length + 1]
    for separator in (". ", "! ", "? ", "; ", ", ", " "):
        position = clipped.rfind(separator)
        if position >= max_length * 0.55:
            clipped = clipped[:position]
            break
    return clipped.rstrip(" ,;:.!?")


def _clip_words(value: str, max_words: int) -> str:
    text = _clean_text(value)
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(" ,;:.!?")


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


def _context_text(context: dict[str, Any] | None) -> str:
    if not context:
        return ""
    habit = context.get("habit")
    if not isinstance(habit, dict):
        return ""
    fields = [habit.get("title"), habit.get("description"), habit.get("recovery_task")]
    return " ".join(str(field or "") for field in fields).lower()


def _topic_hint_from_text(text: str) -> str:
    if any(keyword in text for keyword in _SPORT_KEYWORDS):
        return "sport"
    if any(keyword in text for keyword in _HEALTH_KEYWORDS):
        return "health"
    if any(keyword in text for keyword in _LEARNING_KEYWORDS):
        return "learning"
    if any(keyword in text for keyword in _LEISURE_KEYWORDS):
        return "leisure"
    return "general"


def _context_topic_hint(context: dict[str, Any] | None) -> str:
    if not context:
        return "general"
    habit = context.get("habit")
    if isinstance(habit, dict) and isinstance(habit.get("topic_hint"), str):
        return str(habit["topic_hint"])
    return _topic_hint_from_text(_context_text(context))


def _equipment_forms(context: dict[str, Any] | None, text: str) -> tuple[str, str] | None:
    source = f"{_context_text(context)} {text}".lower()
    for keyword, nominative, accusative in _EQUIPMENT_BY_KEYWORD:
        if keyword in source:
            return nominative, accusative
    return None


def _has_unsafe_domain_mismatch(message: str, context: dict[str, Any] | None) -> bool:
    topic_hint = _context_topic_hint(context)
    if topic_hint == "health" and _UNSAFE_HEALTH_ADVICE_PATTERN.search(message):
        return True
    if topic_hint == "sport" and _FOOD_AND_JUMP_PATTERN.search(message):
        return True
    return False


def _repair_ai_text(value: str, context: dict[str, Any] | None) -> str | None:
    text = value
    text = re.sub(
        r"\bрядом с местом для вечера\b",
        "на видное место на вечер",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\bместо для вечера\b",
        "видное место на вечер",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"\bместом для вечера\b",
        "видным местом на вечер",
        text,
        flags=re.IGNORECASE,
    )

    equipment = _equipment_forms(context, text)
    has_generic_equipment = re.search(r"\bснаряд\w*\b", text, flags=re.IGNORECASE)
    if has_generic_equipment and not equipment:
        return None

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

    return text


def _parse_action_plan(value: str) -> dict[str, str] | None:
    matches = list(_ACTION_PLAN_LABEL_PATTERN.finditer(value))
    expected_labels = ["сегодня", "минимум", "готово"]
    if len(matches) != len(expected_labels):
        return None

    segments: dict[str, str] = {}
    for index, match in enumerate(matches):
        label = match.group(1).lower()
        if label != expected_labels[index]:
            return None
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(value)
        segment = _clean_text(value[start:end]).strip(" ,;:.!?")
        if not segment:
            return None
        segments[label] = segment

    return segments


def _completed_today(context: dict[str, Any] | None) -> bool:
    if not context:
        return False
    risk = context.get("risk")
    if not isinstance(risk, dict):
        return False
    features = risk.get("features")
    return isinstance(features, dict) and bool(features.get("completed_today"))


def _looks_like_completed_day_follow_up(message: str, context: dict[str, Any] | None) -> bool:
    if not _completed_today(context):
        return True

    segments = _parse_action_plan(message)
    if not segments:
        return False

    today = segments["сегодня"]
    has_follow_up = bool(_FOLLOW_UP_WORD_PATTERN.search(today))
    has_active_habit_action = bool(_ACTIVE_TODAY_VERBS_PATTERN.search(today))
    return has_follow_up and not has_active_habit_action


def _has_bad_ai_phrase(value: str) -> bool:
    lowered = value.lower()
    return any(phrase in lowered for phrase in _BAD_AI_PHRASES) or bool(
        re.search(r"\bснаряд\w*\b", lowered)
    )


def _compact_features(features: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {
        "total_entries",
        "completed_count",
        "missed_count",
        "completion_rate",
        "completed_last_7_days",
        "missed_last_7_days",
        "completion_rate_last_7",
        "total_last_7_days",
        "recent_miss_rate",
        "consecutive_missed",
        "current_streak",
        "longest_streak",
        "completed_today",
        "missed_today",
        "latest_entry_status",
        "weekday",
        "weekday_success_rate",
        "days_since_last_completion",
        "user_activity_score",
        "target_per_week",
        "difficulty",
        "history_confidence",
    }
    return {key: features[key] for key in allowed_keys if key in features}


def _normalize_ai_payload(
    payload: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> Optional[AIRecommendationDraft]:
    title = _clip_text(str(payload.get("title") or ""), MAX_TITLE_CHARS).rstrip(" ,;:.!?")
    raw_message = _strip_outer_quotes(_clip_text(
        _clip_words(str(payload.get("message") or ""), MAX_MESSAGE_WORDS),
        MAX_MESSAGE_CHARS,
    ))
    repaired_message = _repair_ai_text(raw_message, context)
    if repaired_message is None:
        return None
    message = _strip_outer_quotes(
        _clip_text(_clip_words(repaired_message, MAX_MESSAGE_WORDS), MAX_MESSAGE_CHARS)
    )

    if not title or not message:
        return None
    if _parse_action_plan(message) is None:
        return None
    if _has_bad_ai_phrase(message):
        return None
    if _has_unsafe_domain_mismatch(message, context):
        return None
    if not _looks_like_completed_day_follow_up(message, context):
        return None

    return AIRecommendationDraft(title=title, message=message)


def _build_context(
    habit: Habit,
    prediction: Prediction,
    today: date,
    base_type: str,
    base_title: str,
    base_message: str,
    user: Optional[User] = None,
    refresh_mode: str = "auto",
    variation_seed: Optional[str] = None,
) -> dict[str, Any]:
    context: dict[str, Any] = {
        "today": today.isoformat(),
        "habit": {
            "title": habit.title,
            "description": habit.description,
            "topic_hint": _topic_hint_from_text(
                f"{habit.title or ''} {habit.description or ''} {habit.recovery_task or ''}".lower()
            ),
            "frequency_type": habit.frequency_type,
            "target_per_week": habit.target_per_week,
            "difficulty": habit.difficulty,
            "preferred_time": habit.preferred_time.isoformat() if habit.preferred_time else None,
            "recovery_minutes": habit.recovery_minutes,
            "recovery_task": habit.recovery_task,
            "schedule_days": habit.schedule_days,
        },
        "risk": {
            "recommendation_type": base_type,
            "base_title": base_title,
            "base_message": base_message,
            "risk_level": prediction.risk_level,
            "miss_risk": prediction.miss_risk,
            "completion_probability": prediction.completion_probability,
            "features": _compact_features(prediction.features or {}),
        },
        "request": {
            "mode": refresh_mode,
            "variation_seed": variation_seed,
        },
    }

    if user:
        context["user"] = {
            "pet_type": user.pet_type,
            "pet_name": user.pet_name,
        }

    return context


def _system_instructions() -> str:
    return (
        "Ты генерируешь персональные советы для адаптивного веб-приложения Steply. "
        "Пиши по-русски, спокойно и конкретно. Учитывай название, описание, сложность, "
        "время и историю конкретной привычки. Не копируй базовый совет дословно и не "
        "возвращай один и тот же текст для разных привычек. Дай маленький, предметный "
        "шаг именно для этой привычки: что сделать, когда и как упростить при риске. "
        "Если recommendation_type равен first_step, не оценивай риск и не проси историю: "
        "дай стартовый совет для первого выполнения привычки сегодня. "
        "Если тип after_completion, on_track_support, streak_maintenance или streak_support, "
        "поддержи успешное выполнение и предложи, как закрепить ритм без повышения нагрузки. "
        "Если risk.features.completed_today равен true, не предлагай делать привычку еще раз "
        "сегодня: предложи только подготовить следующий повтор или оставить видимую подсказку. "
        "Если тип early_recovery, miss_streak_recovery, risk_recovery, soft_recovery, "
        "risk_ignored_recovery или reset_plan, не повторяй общие фразы про риск: предложи "
        "упрощение старта, перенос времени, микрошаг или перезапуск условий. "
        "Для risk_recovery предотвращай пропуск до того, как он случился. "
        "Для early_recovery помоги закрыть первый разрыв, пока он не стал серией. "
        "Для miss_streak_recovery останови серию пропусков одним минимальным действием. "
        "Для soft_recovery уменьши объем без перезапуска привычки. "
        "Для risk_ignored_recovery и reset_plan признай, что прежний формат пока слишком тяжелый, "
        "но без обвинений и стыда. "
        "Если тип plan_ahead, помоги подготовить выполнение заранее до пропуска. "
        "Message должен быть практическим планом из трех коротких предложений строго в формате: "
        "'Сегодня: ... Минимум: ... Готово: ...'. "
        "В 'Сегодня' назови конкретное наблюдаемое действие, в 'Минимум' - облегченный вариант "
        "на случай нехватки сил или риска, в 'Готово' - понятный критерий завершения. "
        "Называй реальные предметы обычными словами: 'скакалка', 'кроссовки', 'книга', "
        "'документ'. Не используй слово 'снаряд', канцелярит и машинные фразы вроде "
        "'место для вечера', 'уберите барьер', 'без давления' или 'лучший шаг'. "
        "Если habit.topic_hint равен sport, не предлагай интенсивные действия сразу после еды. "
        "Если habit.topic_hint равен health, не меняй дозировки, назначения и лечение; "
        "совет должен быть про напоминание, подготовку среды или безопасный микрошаг. "
        "Если habit.topic_hint равен learning, привязывай совет к файлу, карточкам, примеру, "
        "странице или конспекту. Если habit.topic_hint равен leisure, сохраняй мягкий тон отдыха "
        "и заранее называй точку остановки. "
        "Не превращай recovery_minutes в одинаковый таймер для всех привычек; упоминай минуты "
        "только когда они делают совет точнее, иначе опиши предметный облегченный вариант. "
        "title до 4 слов, message 28-52 слова. "
        "Не ставь точки в конце предложений и не используй длинные тире. "
        "Не используй нумерацию, '1)', '2)', маркированные списки, слово 'Шаги' и абстрактные "
        "формулировки вроде 'уберите барьер' без конкретизации. "
        "Если request.mode равен manual_refresh, дай альтернативный микрошаг и новую формулировку, "
        "даже если контекст похож на прошлый запрос. "
        "Не обещай медицинский эффект, не ставь "
        "диагнозы и не назначай лечение. Если привычка связана со здоровьем, зависимостью, "
        "курением, алкоголем, питанием или лекарствами, добавь мягкую фразу о том, что при "
        "выраженных симптомах или зависимости стоит обратиться к специалисту. Не добавляй эту "
        "фразу для обычных учебных, рабочих, бытовых или творческих привычек без явной темы "
        "здоровья. Не используй "
        "слово 'нейросеть'. Не ругай пользователя и не усиливай чувство вины."
    )


def _user_prompt(context: dict[str, Any]) -> str:
    return (
        "Сформируй совет на сегодня на основе контекста. Верни только JSON вида "
        '{"title":"...","message":"Сегодня: ... Минимум: ... Готово: ..."}. '
        "Никакого текста вне JSON. Не добавляй actions или другие поля. "
        "В message не ставь точки в конце сегментов. "
        f"Контекст: {json.dumps(context, ensure_ascii=False)}"
    )


def _build_bothub_request(context: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    request_meta = (
        context.get("request") if isinstance(context.get("request"), dict) else {}
    )
    is_manual_refresh = request_meta.get("mode") == "manual_refresh"
    return {
        "model": settings.bothub_model,
        "messages": [
            {"role": "system", "content": _system_instructions()},
            {"role": "user", "content": _user_prompt(context)},
        ],
        "temperature": 0.7 if is_manual_refresh else 0.45,
        "max_tokens": 180,
    }


def _extract_json_object(value: str) -> dict[str, Any]:
    text = value.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        payload = json.loads(text[start : end + 1])

    if not isinstance(payload, dict):
        raise json.JSONDecodeError("Expected JSON object", text, 0)

    return payload


def generate_ai_recommendation(
    habit: Habit,
    prediction: Prediction,
    today: date,
    base_type: str,
    base_title: str,
    base_message: str,
    user: Optional[User] = None,
    refresh_mode: str = "auto",
    variation_seed: Optional[str] = None,
) -> Optional[AIRecommendationDraft]:
    settings = get_settings()
    provider = settings.ai_provider.lower()
    if not settings.ai_enabled:
        return None

    context = _build_context(
        habit=habit,
        prediction=prediction,
        today=today,
        base_type=base_type,
        base_title=base_title,
        base_message=base_message,
        user=user,
        refresh_mode=refresh_mode,
        variation_seed=variation_seed,
    )

    if provider != "bothub":
        return None

    return _generate_bothub_recommendation(context)


def _generate_bothub_recommendation(context: dict[str, Any]) -> Optional[AIRecommendationDraft]:
    settings = get_settings()
    api_key = settings.bothub_api_key.strip()
    if not api_key:
        return None

    request = urllib.request.Request(
        f"{settings.bothub_base_url.rstrip('/')}/chat/completions",
        data=json.dumps(_build_bothub_request(context)).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=settings.ai_request_timeout_seconds,
        ) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            return None
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            return None
        message = first_choice.get("message")
        if not isinstance(message, dict):
            return None
        response_text = str(message.get("content") or "").strip()
        if not response_text:
            return None
        return _normalize_ai_payload(_extract_json_object(response_text), context)
    except (
        json.JSONDecodeError,
        OSError,
        TimeoutError,
        urllib.error.URLError,
        urllib.error.HTTPError,
        socket.timeout,
    ):
        logger.warning("AI recommendation provider failed; using heuristic fallback", exc_info=True)
        return None
