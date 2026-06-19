import { useEffect, useState } from "react";

import qrCodeUrl from "../../assets/qr-code.svg";

interface QrConfig {
  version: number;
  dataCodewords: number;
  eccCodewords: number;
  alignment: number[];
}

interface QrSvgData {
  path: string;
  size: number;
}

interface AuthQrCardProps {
  variant?: "auth" | "demo";
  eyebrow?: string;
  title?: string;
  description?: string;
}

const QR_CONFIGS: QrConfig[] = [
  { version: 1, dataCodewords: 19, eccCodewords: 7, alignment: [] },
  { version: 2, dataCodewords: 34, eccCodewords: 10, alignment: [6, 18] },
  { version: 3, dataCodewords: 55, eccCodewords: 15, alignment: [6, 22] },
  { version: 4, dataCodewords: 80, eccCodewords: 20, alignment: [6, 26] },
  { version: 5, dataCodewords: 108, eccCodewords: 26, alignment: [6, 30] }
];

const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);

let gfValue = 1;
for (let index = 0; index < 255; index += 1) {
  GF_EXP[index] = gfValue;
  GF_LOG[gfValue] = index;
  gfValue <<= 1;
  if (gfValue & 0x100) {
    gfValue ^= 0x11d;
  }
}
for (let index = 255; index < 512; index += 1) {
  GF_EXP[index] = GF_EXP[index - 255];
}

function normalizeAppUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/$/, "");
}

function getConfiguredAppUrls() {
  return [
    normalizeAppUrl(import.meta.env.VITE_PUBLIC_APP_URL),
    normalizeAppUrl(import.meta.env.VITE_APP_URL)
  ];
}

function getWindowOrigin() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeAppUrl(window.location.origin);
}

function isPhoneReachableUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "0.0.0.0" &&
      hostname !== "[::1]" &&
      hostname !== "::1"
    );
  } catch {
    return false;
  }
}

function getQrCandidates() {
  return [...getConfiguredAppUrls(), getWindowOrigin()].filter(
    (url, index, urls): url is string =>
      typeof url === "string" && isPhoneReachableUrl(url) && urls.indexOf(url) === index
  );
}

function multiplyGf(left: number, right: number) {
  if (left === 0 || right === 0) {
    return 0;
  }

  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function buildGeneratorPolynomial(degree: number) {
  let polynomial = [1];

  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);

    for (let position = 0; position < polynomial.length; position += 1) {
      next[position] ^= polynomial[position];
      next[position + 1] ^= multiplyGf(polynomial[position], GF_EXP[index]);
    }

    polynomial = next;
  }

  return polynomial.slice(1);
}

function buildErrorCorrection(dataCodewords: number[], degree: number) {
  const generator = buildGeneratorPolynomial(degree);
  const remainder = new Array<number>(degree).fill(0);

  dataCodewords.forEach((codeword) => {
    const factor = codeword ^ remainder.shift()!;
    remainder.push(0);

    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= multiplyGf(generator[index], factor);
    }
  });

  return remainder;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function getQrConfig(byteLength: number) {
  return QR_CONFIGS.find((config) => {
    const availableBits = config.dataCodewords * 8;
    const requiredBits = 4 + 8 + byteLength * 8;

    return requiredBits <= availableBits;
  });
}

function buildDataCodewords(value: string, config: QrConfig) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const bits: number[] = [];
  const capacityBits = config.dataCodewords * 8;

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  for (let index = 0; index < Math.min(4, capacityBits - bits.length); index += 1) {
    bits.push(0);
  }

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];

  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  }

  const padCodewords = [0xec, 0x11];
  let padIndex = 0;

  while (codewords.length < config.dataCodewords) {
    codewords.push(padCodewords[padIndex % 2]);
    padIndex += 1;
  }

  return codewords;
}

function getFormatBits(mask: number) {
  const errorCorrectionLevelLow = 1;
  const data = (errorCorrectionLevelLow << 3) | mask;
  let bits = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if ((bits >>> index) & 1) {
      bits ^= 0x537 << (index - 10);
    }
  }

  return ((data << 10) | (bits & 0x3ff)) ^ 0x5412;
}

function shouldMask(row: number, column: number) {
  return (row + column) % 2 === 0;
}

function createQrSvgData(value: string): QrSvgData {
  const byteLength = new TextEncoder().encode(value).length;
  const config = getQrConfig(byteLength);

  if (!config) {
    throw new Error("QR value is too long");
  }

  const size = config.version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null));
  const functionModules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  function setModule(row: number, column: number, isDark: boolean, isFunction = false) {
    if (row < 0 || column < 0 || row >= size || column >= size) {
      return;
    }

    modules[row][column] = isDark;
    if (isFunction) {
      functionModules[row][column] = true;
    }
  }

  function setFunctionModule(row: number, column: number, isDark: boolean) {
    setModule(row, column, isDark, true);
  }

  function addFinderPattern(row: number, column: number) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const targetRow = row + dy;
        const targetColumn = column + dx;
        const isDark =
          dy >= 0 &&
          dy <= 6 &&
          dx >= 0 &&
          dx <= 6 &&
          (dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));

        setFunctionModule(targetRow, targetColumn, isDark);
      }
    }
  }

  function addAlignmentPattern(centerRow: number, centerColumn: number) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const targetRow = centerRow + dy;
        const targetColumn = centerColumn + dx;

        if (!functionModules[targetRow]?.[targetColumn]) {
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          setFunctionModule(targetRow, targetColumn, distance === 0 || distance === 2);
        }
      }
    }
  }

  function drawFormatBits() {
    const bits = getFormatBits(0);
    const bit = (index: number) => ((bits >>> index) & 1) !== 0;

    for (let index = 0; index <= 5; index += 1) {
      setFunctionModule(8, index, bit(index));
    }
    setFunctionModule(8, 7, bit(6));
    setFunctionModule(8, 8, bit(7));
    setFunctionModule(7, 8, bit(8));
    for (let index = 9; index < 15; index += 1) {
      setFunctionModule(14 - index, 8, bit(index));
    }
    for (let index = 0; index < 8; index += 1) {
      setFunctionModule(size - 1 - index, 8, bit(index));
    }
    for (let index = 8; index < 15; index += 1) {
      setFunctionModule(8, size - 15 + index, bit(index));
    }
    setFunctionModule(8, size - 8, true);
  }

  addFinderPattern(0, 0);
  addFinderPattern(0, size - 7);
  addFinderPattern(size - 7, 0);

  for (let index = 8; index < size - 8; index += 1) {
    const isDark = index % 2 === 0;
    setFunctionModule(6, index, isDark);
    setFunctionModule(index, 6, isDark);
  }

  config.alignment.forEach((row) => {
    config.alignment.forEach((column) => {
      if (!functionModules[row]?.[column]) {
        addAlignmentPattern(row, column);
      }
    });
  });

  setFunctionModule(config.version * 4 + 9, 8, true);
  drawFormatBits();

  const dataCodewords = buildDataCodewords(value, config);
  const allCodewords = [
    ...dataCodewords,
    ...buildErrorCorrection(dataCodewords, config.eccCodewords)
  ];
  let bitIndex = 0;
  let upward = true;

  for (let rightColumn = size - 1; rightColumn >= 1; rightColumn -= 2) {
    if (rightColumn === 6) {
      rightColumn -= 1;
    }

    for (let vertical = 0; vertical < size; vertical += 1) {
      const row = upward ? size - 1 - vertical : vertical;

      for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
        const column = rightColumn - columnOffset;

        if (!functionModules[row][column]) {
          const codeword = allCodewords[bitIndex >>> 3] ?? 0;
          let isDark = ((codeword >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;

          if (shouldMask(row, column)) {
            isDark = !isDark;
          }

          setModule(row, column, isDark);
        }
      }
    }

    upward = !upward;
  }

  let path = "";

  modules.forEach((row, rowIndex) => {
    row.forEach((isDark, columnIndex) => {
      if (isDark) {
        path += `M${columnIndex} ${rowIndex}h1v1H${columnIndex}z`;
      }
    });
  });

  return { path, size };
}

function copyTextFallback(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

export function AuthQrCard({
  variant = "auth",
  eyebrow,
  title,
  description
}: AuthQrCardProps = {}) {
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<QrSvgData | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const isDemo = variant === "demo";
  const cardClassName = `auth-qr-card${isDemo ? " auth-qr-card-demo" : ""}`;
  const resolvedEyebrow = eyebrow ?? (isDemo ? "Демо-доступ" : "");
  const resolvedTitle = title ?? (isDemo ? "QR для комиссии" : "Откройте на телефоне");
  const resolvedDescription =
    description ??
    (isDemo
      ? "Сканируйте, чтобы открыть Steply на телефоне и проверить приложение"
      : "Сканируйте QR-код");

  useEffect(() => {
    const candidates = getQrCandidates();

    for (const candidate of candidates) {
      try {
        setQr(createQrSvgData(candidate));
        setAppUrl(candidate);
        return;
      } catch {
        continue;
      }
    }

    setAppUrl(candidates[0] ?? null);
  }, []);

  if (!appUrl) {
    return (
      <aside className="auth-qr-card auth-qr-card-hint" aria-label="Открытие Steply на телефоне">
        <div className="auth-qr-copy">
          {resolvedEyebrow && <span className="auth-qr-eyebrow">{resolvedEyebrow}</span>}
          <strong>QR появится на публичном адресе</strong>
          <span>
            На хостинге QR возьмёт текущий домен сайта, для локального показа задайте
            <code>VITE_PUBLIC_APP_URL=http://IP:5173</code> в root <code>.env</code>
          </span>
        </div>
      </aside>
    );
  }

  async function copyAppUrl() {
    if (!appUrl) {
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(appUrl);
      } else if (!copyTextFallback(appUrl)) {
        throw new Error("Copy fallback failed");
      }
      setCopyStatus("Скопировано");
    } catch {
      setCopyStatus(copyTextFallback(appUrl) ? "Скопировано" : "Скопируйте ссылку вручную");
    }
  }

  return (
    <aside className={cardClassName} aria-label="QR-код для открытия Steply на телефоне">
      <div className="auth-qr-code" aria-hidden="true">
        {qr ? (
          <img src={qrCodeUrl} alt="QR code" />
        ) : (
          <span>S</span>
        )}
      </div>
      <div className="auth-qr-copy">
        {resolvedEyebrow && <span className="auth-qr-eyebrow">{resolvedEyebrow}</span>}
        <strong>{resolvedTitle}</strong>
        <span>{resolvedDescription}</span>
        <a className="auth-qr-link" href={appUrl}>
          {appUrl}
        </a>
        <button className="auth-qr-copy-button" type="button" onClick={() => void copyAppUrl()}>
          Скопировать
        </button>
        {copyStatus && <small>{copyStatus}</small>}
      </div>
    </aside>
  );
}
