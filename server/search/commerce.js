import { compactText } from "./text.js";

const PHONE_BRANDS =
  "iQOO|Vivo|Redmi|Realme|OnePlus|Samsung|Galaxy|Motorola|Moto|POCO|Poco|Nothing|CMF|Infinix|Tecno|Lava|OPPO|Oppo|Honor|Nokia|Xiaomi";

const MODEL_NOISE =
  /\b(?:and\s+more|all\s+models|key|price|review|specifications|features|camera|battery|processor|display|launch|available|india|under|best|with\s+prices|news|teased|debut|arrive|could\s+feature|has\s+a\s+starting|starts?\s+at)\b.*$/i;

function cleanPhoneModel(value) {
  const cleaned = compactText(value)
    .replace(MODEL_NOISE, "")
    .replace(/[,:;|()]+$/g, "")
    .trim();

  if (cleaned.length < 5 || cleaned.length > 48) return "";
  if (/\b(?:mobile phones|smartphones|phones under|mobiles under)\b/i.test(cleaned)) return "";
  if (/^(?:Samsung|OnePlus|Nokia|Xiaomi|Redmi|Realme|Vivo|OPPO|Oppo|Motorola|Moto|Poco|POCO)\s+(?:mobile|mobiles|phone|phones)$/i.test(cleaned)) return "";
  if (/\b(?:ecosystem|telecom|how to|gaming|versus|vs|iphone)\b/i.test(cleaned)) return "";
  return cleaned;
}

export function extractPhoneModels(text) {
  const normalized = compactText(text);
  const pattern = new RegExp(
    `\\b(?:${PHONE_BRANDS})\\s+(?:[A-Z0-9][A-Za-z0-9+\\-]*(?:\\s+[A-Z0-9][A-Za-z0-9+\\-]*){0,5})`,
    "gi",
  );

  return [
    ...new Set(
      (normalized.match(pattern) || [])
        .flatMap((match) => splitJoinedModels(match).map(cleanPhoneModel))
        .filter(Boolean),
    ),
  ];
}

export function extractPriceSignals(text, budget = "") {
  const maxBudget = Number(String(budget || "").replace(/[^\d]/g, ""));
  const normalized = compactText(text);
  const matches = [];
  const pattern = /(?:\u20B9|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/gi;
  let match;

  while ((match = pattern.exec(normalized))) {
    const numeric = Number(match[1].replace(/[^\d]/g, ""));
    if (!numeric || numeric < 3000) continue;
    const context = normalized.slice(Math.max(0, match.index - 36), match.index + match[0].length + 36);
    const isBudgetConstraint =
      maxBudget &&
      Math.abs(numeric - maxBudget) <= 1 &&
      /\b(?:under|below|budget|category|segment|list|price\s+list|phones?\s+under|mobiles?\s+under)\b/i.test(context);
    if (isBudgetConstraint) continue;
    if (maxBudget && numeric > maxBudget + 1500) continue;
    matches.push(formatInr(numeric));
  }

  return [...new Set(matches)].slice(0, 8);
}

export function extractSpecSignals(text) {
  const normalized = compactText(text);
  const pattern =
    /\b(?:Snapdragon|Dimensity|Exynos|Helio)\s?[A-Za-z0-9+ -]{2,24}|\b\d{4,5}\s?mAh\b|\b\d{2,3}\s?MP\b|\b(?:AMOLED|LCD|OLED|120Hz|144Hz)\b/gi;
  return [...new Set(normalized.match(pattern) || [])].slice(0, 12);
}

export function extractStructuredFields(text, budget = "") {
  const normalized = compactText(text);
  return {
    chipset: cleanChipset(firstMatch(normalized, /\b(?:Snapdragon|Dimensity|Exynos|Helio)\s?[A-Za-z0-9+ -]{2,28}\b/i)),
    display: firstMatch(normalized, /\b(?:AMOLED|OLED|LCD|IPS LCD|pOLED)\b/i),
    refreshRate: firstMatch(normalized, /\b(?:90|120|144)\s?Hz\b/i),
    battery: firstMatch(normalized, /\b\d{4,5}\s?mAh\b/i),
    charging: firstMatch(normalized, /\b\d{2,3}\s?W\b/i),
    camera: firstMatch(normalized, /\b\d{2,3}\s?MP\b/i),
    price: extractPriceSignals(normalized, budget)[0] || "",
  };
}

export function extractStructuredProducts(text, { budget = "", sourceIndex = null, sourceDomain = "" } = {}) {
  const normalized = compactText(text);
  const models = extractPhoneModels(normalized).slice(0, 10);

  return models
    .map((model) => {
      const windows = modelWindows(normalized, model);
      const fieldText = windows.join(" ");
      const fields = extractStructuredFields(fieldText || model, budget);
      const modelCountInWindow = extractPhoneModels(fieldText).length;
      const priceLooksLikeListRange =
        modelCountInWindow > 1 && /\b(?:prices?\s+ranging|ranging\s+from|between|from\s+(?:\u20B9|Rs\.?|INR).+?\bto\b)\b/i.test(fieldText);
      return {
        model,
        chipset: fields.chipset,
        display: fields.display,
        refreshRate: fields.refreshRate,
        battery: fields.battery,
        charging: fields.charging,
        camera: fields.camera,
        price: priceLooksLikeListRange ? "" : fields.price,
        source: sourceIndex,
        domain: sourceDomain,
      };
    })
    .filter((product) => product.model);
}

export function formatPriceSignal(prices = []) {
  return prices.length ? prices.slice(0, 2).join(", ") : "Check live seller price";
}

export function formatInr(value) {
  const numeric = Number(String(value).replace(/[^\d]/g, ""));
  return numeric ? `₹${numeric.toLocaleString("en-IN")}` : "";
}

function firstMatch(text, pattern) {
  const match = compactText(text).match(pattern);
  return match ? compactText(match[0]) : "";
}

function cleanChipset(value) {
  return compactText(value)
    .replace(/\b(?:SoC|RAM|Front|Rear|Camera|More results|lack).*$/i, "")
    .replace(/\bProcessor\b.*$/i, "Processor")
    .trim();
}

function splitJoinedModels(value) {
  return compactText(value).split(new RegExp(`\\s+and\\s+(?=(?:${PHONE_BRANDS})\\b)`, "i"));
}

function modelWindows(text, model) {
  const lowerText = text.toLowerCase();
  const lowerModel = model.toLowerCase();
  const windows = [];
  let start = 0;

  while (windows.length < 3) {
    const index = lowerText.indexOf(lowerModel, start);
    if (index === -1) break;
    windows.push(text.slice(Math.max(0, index - 160), index + model.length + 360));
    start = index + lowerModel.length;
  }

  return windows;
}
