const NON_BREAKING_SPACE = "\u00a0";
const CYRILLIC_PATTERN = /[А-Яа-яЁё]/;

const RUSSIAN_SHORT_WORDS = [
  "а",
  "бы",
  "в",
  "во",
  "вы",
  "да",
  "до",
  "ее",
  "её",
  "ей",
  "ему",
  "ею",
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
  "ко",
  "ли",
  "мы",
  "на",
  "над",
  "не",
  "ни",
  "но",
  "о",
  "об",
  "обо",
  "он",
  "она",
  "они",
  "оно",
  "от",
  "по",
  "под",
  "при",
  "про",
  "с",
  "со",
  "то",
  "ты",
  "у",
  "что",
  "я"
]
  .sort((left, right) => right.length - left.length)
  .join("|");

const SHORT_WORD_SPACE_PATTERN = new RegExp(
  `(^|[\\s\\u00a0([{«„"'])(${RUSSIAN_SHORT_WORDS})([\\s\\u00a0]+)`,
  "giu"
);

const XP_PATTERN = /(\d)\s+(XP)/g;
const PERCENT_PATTERN = /(\d)\s+(%)/g;

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
  if (!CYRILLIC_PATTERN.test(value)) {
    return value;
  }

  return value
    .replace(SHORT_WORD_SPACE_PATTERN, (_match, prefix: string, word: string) => {
      return `${prefix}${word}${NON_BREAKING_SPACE}`;
    })
    .replace(XP_PATTERN, `$1${NON_BREAKING_SPACE}$2`)
    .replace(PERCENT_PATTERN, `$1${NON_BREAKING_SPACE}$2`);
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
