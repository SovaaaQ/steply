const NON_BREAKING_SPACE = "\u00a0";
const WORD_JOINER = "\u2060";
const TYPOGRAPHY_RELEVANT_PATTERN =
  /[А-Яа-яЁё]|\d\s*(?:[–-]\s*\d|\s+(?:XP|%))|[№§]|\s[—–·]\s/;

const RUSSIAN_SHORT_WORDS = [
  "а",
  "без",
  "близ",
  "бы",
  "в",
  "ведь",
  "во",
  "возле",
  "вот",
  "все",
  "всё",
  "вместо",
  "вы",
  "да",
  "даже",
  "для",
  "до",
  "едва",
  "ее",
  "её",
  "ей",
  "ему",
  "ею",
  "если",
  "еще",
  "ещё",
  "же",
  "за",
  "и",
  "из",
  "изо",
  "или",
  "им",
  "их",
  "к",
  "как",
  "когда",
  "ко",
  "ли",
  "лишь",
  "меж",
  "между",
  "мы",
  "на",
  "над",
  "не",
  "ни",
  "но",
  "о",
  "об",
  "обо",
  "около",
  "он",
  "она",
  "они",
  "оно",
  "от",
  "по",
  "под",
  "после",
  "почти",
  "перед",
  "при",
  "про",
  "ради",
  "разве",
  "с",
  "сквозь",
  "со",
  "среди",
  "то",
  "только",
  "ты",
  "у",
  "уже",
  "что",
  "чтоб",
  "чтобы",
  "через",
  "я"
]
  .sort((left, right) => right.length - left.length)
  .join("|");

const SHORT_WORD_SPACE_PATTERN = new RegExp(
  `(^|[\\s\\u00a0([{«„"'])(${RUSSIAN_SHORT_WORDS})([\\s\\u00a0]+)`,
  "giu"
);

const RUSSIAN_NUMBER_UNITS = [
  "день",
  "дня",
  "дней",
  "минут",
  "минута",
  "минуту",
  "минуты",
  "отметка",
  "отметки",
  "отметок",
  "привычка",
  "привычки",
  "привычек",
  "пропуск",
  "пропуска",
  "пропусков",
  "раз",
  "раза",
  "разов",
  "слово",
  "слова",
  "слов",
  "час",
  "часа",
  "часов"
]
  .sort((left, right) => right.length - left.length)
  .join("|");

const NUMBER_VALUE_PATTERN = `\\d+(?:[.,]\\d+)?(?:${WORD_JOINER}[–-]${WORD_JOINER}\\d+(?:[.,]\\d+)?)?`;
const NUMBER_UNIT_PATTERN = new RegExp(
  `(${NUMBER_VALUE_PATTERN})([\\s\\u00a0]+)(${RUSSIAN_NUMBER_UNITS})(?=$|[\\s\\u00a0.,;:!?)}\\]»])`,
  "giu"
);
const RANGE_DASH_PATTERN = /(\d+(?:[.,]\d+)?)\s*([–-])\s*(\d+(?:[.,]\d+)?)/g;
const DASH_SPACE_PATTERN = /([^\s\u00a0])[\s\u00a0]+([—–])[\s\u00a0]+([^\s\u00a0])/g;
const MIDDLE_DOT_PATTERN = /([^\s\u00a0])[\s\u00a0]*·[\s\u00a0]*([^\s\u00a0])/g;
const NUMBER_SIGN_PATTERN = /([№§])[\s\u00a0]+([^\s\u00a0])/g;
const XP_PATTERN = /([+−-]?\d+(?:[.,]\d+)?)\s+(XP)\b/g;
const PERCENT_PATTERN = /(\d+(?:[.,]\d+)?)\s+(%)/g;
const SPACE_BEFORE_PUNCTUATION_PATTERN = /[\s\u00a0]+([,.;:!?])/g;

const SKIPPED_TYPOGRAPHY_SELECTOR = [
  "canvas",
  "code",
  "input",
  "kbd",
  "noscript",
  "option",
  "pre",
  "samp",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
  "[data-typography-ignore='true']"
].join(",");

export function formatRussianTypography(value: string) {
  if (!TYPOGRAPHY_RELEVANT_PATTERN.test(value)) {
    return value;
  }

  return value
    .replace(RANGE_DASH_PATTERN, `$1${WORD_JOINER}$2${WORD_JOINER}$3`)
    .replace(DASH_SPACE_PATTERN, `$1${NON_BREAKING_SPACE}$2${NON_BREAKING_SPACE}$3`)
    .replace(MIDDLE_DOT_PATTERN, `$1${NON_BREAKING_SPACE}·${NON_BREAKING_SPACE}$2`)
    .replace(NUMBER_SIGN_PATTERN, `$1${NON_BREAKING_SPACE}$2`)
    .replace(SHORT_WORD_SPACE_PATTERN, (_match, prefix: string, word: string) => {
      return `${prefix}${word}${NON_BREAKING_SPACE}`;
    })
    .replace(NUMBER_UNIT_PATTERN, `$1${NON_BREAKING_SPACE}$3`)
    .replace(XP_PATTERN, `$1${NON_BREAKING_SPACE}$2`)
    .replace(PERCENT_PATTERN, `$1${NON_BREAKING_SPACE}$2`)
    .replace(SPACE_BEFORE_PUNCTUATION_PATTERN, "$1");
}

function shouldSkipTextNode(node: Text) {
  const parent = node.parentElement;

  return !parent || Boolean(parent.closest(SKIPPED_TYPOGRAPHY_SELECTOR));
}

function formatTextNode(node: Text) {
  if (!node.nodeValue || shouldSkipTextNode(node)) {
    return;
  }

  const formattedValue = formatRussianTypography(node.nodeValue);

  if (formattedValue !== node.nodeValue) {
    node.nodeValue = formattedValue;
  }
}

export function applyRussianTypography(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    formatTextNode(root as Text);
    return;
  }

  if (root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  if (root instanceof Element && root.closest(SKIPPED_TYPOGRAPHY_SELECTOR)) {
    return;
  }

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim() || shouldSkipTextNode(node as Text)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach(formatTextNode);
}

export function watchRussianTypography(root: Node) {
  let frameId = 0;

  const scheduleFormatting = () => {
    if (frameId) {
      return;
    }

    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      applyRussianTypography(root);
    });
  };

  applyRussianTypography(root);

  const observer = new MutationObserver(() => {
    scheduleFormatting();
  });

  observer.observe(root, {
    characterData: true,
    childList: true,
    subtree: true
  });

  return () => {
    observer.disconnect();

    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
  };
}
