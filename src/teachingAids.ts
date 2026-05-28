import { type MathPrompt, type MathSettings, type Operation, type PartModel } from "./mathEngine";
import { type SupportContext } from "./sessionFlow";

export type TeachingStepKind = "understand" | "plan" | "try" | "check";
export type TeachingMediaKind = "image" | "audio" | "gif" | "video";

export interface TeachingAidStep {
  kind: TeachingStepKind;
  title: string;
  prompts: string[];
  media?: TeachingAidMedia[];
}

export interface TeachingAidMedia {
  kind: TeachingMediaKind;
  src: string;
  alt?: string;
  caption?: string;
}

export interface TeachingAid {
  id: string;
  conceptKey: string;
  title: string;
  buttonLabel: string;
  appliesTo: {
    operations: Operation[];
    gradeLanes?: MathSettings["gradeLane"][];
  };
  steps: TeachingAidStep[];
  media?: TeachingAidMedia[];
  reviewQuestion?: string;
}

function teachingGraphic(key: string, alt: string, caption?: string): TeachingAidMedia[] {
  return [{ kind: "image", src: teachingGraphicSrc(key), alt, caption }];
}

function teachingGraphicSrc(key: string): string {
  return teachingGraphicSrcFromArt(TEACHING_GRAPHICS[key] ?? TEACHING_GRAPHICS["blank"]);
}

function teachingGraphicSvg(key: string): string {
  return teachingGraphicSvgFromArt(TEACHING_GRAPHICS[key] ?? TEACHING_GRAPHICS["blank"]);
}

function teachingGraphicFromArt(art: string, alt: string, caption?: string): TeachingAidMedia[] {
  return [{ kind: "image", src: teachingGraphicSrcFromArt(art), alt, caption }];
}

function teachingGraphicSrcFromArt(art: string): string {
  return "data:image/svg+xml," + encodeURIComponent(teachingGraphicSvgFromArt(art));
}

function teachingGraphicSvgFromArt(art: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 260" role="img">',
    '<rect width="520" height="260" rx="18" fill="#f9fbf7"/>',
    '<rect x="12" y="12" width="496" height="236" rx="16" fill="#ffffff" stroke="#d8dfcf" stroke-width="4"/>',
    art,
    "</svg>"
  ].join("");
}

export function teachingAidStepMedia(aid: TeachingAid, step: TeachingAidStep, prompt: MathPrompt | null = null, preview = false): TeachingAidMedia[] {
  const dynamic = !preview && prompt ? dynamicTeachingMedia(aid, step, prompt) : [];
  return dynamic.length > 0 ? dynamic : exampleMedia(step.media ?? aid.media ?? []);
}

function exampleMedia(media: TeachingAidMedia[]): TeachingAidMedia[] {
  return media.map((item) => ({
    ...item,
    alt: item.alt?.startsWith("Example:") ? item.alt : "Example: " + (item.alt ?? "teaching picture"),
    caption: item.caption ?? "Example picture; active problems use the current numbers."
  }));
}

function t(x: number, y: number, text: string, size = 24, fill = "#273a33", weight = 800): string {
  return '<text x="' + x + '" y="' + y + '" font-family="Arial, sans-serif" font-size="' + size + '" font-weight="' + weight + '" fill="' + fill + '">' + escapeSvgText(text) + "</text>";
}

function escapeSvgText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function gem(x: number, y: number, label = "", fill = "#54b99d", crossed = false): string {
  const mark = crossed
    ? '<path d="M' + (x - 20) + " " + (y - 20) + " L" + (x + 20) + " " + (y + 20) + ' M' + (x + 20) + " " + (y - 20) + " L" + (x - 20) + " " + (y + 20) + '" stroke="#c44f45" stroke-width="7" stroke-linecap="round"/>'
    : "";
  const text = label ? t(x - (label.length > 1 ? 12 : 7), y + 9, label, 20, "#ffffff", 900) : "";
  return '<circle cx="' + x + '" cy="' + y + '" r="24" fill="' + fill + '" stroke="#216b58" stroke-width="4"/>' + text + mark;
}

function rowGems(count: number, startX: number, y: number, opts: { labels?: boolean; splitAfter?: number; crossedFrom?: number } = {}): string {
  let out = "";
  for (let index = 0; index < count; index += 1) {
    const gap = opts.splitAfter !== undefined && index >= opts.splitAfter ? 24 : 0;
    out += gem(startX + index * 48 + gap, y, opts.labels ? String(index + 1) : "", index < (opts.splitAfter ?? count) ? "#54b99d" : "#f2b84b", opts.crossedFrom !== undefined && index >= opts.crossedFrom);
  }
  return out;
}

function arrow(x1: number, y1: number, x2: number, y2: number, color = "#2c7a61"): string {
  return '<path d="M' + x1 + " " + y1 + " C" + ((x1 + x2) / 2) + " " + (y1 - 28) + " " + ((x1 + x2) / 2) + " " + (y2 - 28) + " " + x2 + " " + y2 + '" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" marker-end="url(#arrow)"/>';
}

function arrowDefs(): string {
  return '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#2c7a61"/></marker></defs>';
}

function tensBlock(x: number, y: number): string {
  let out = '<g>';
  for (let index = 0; index < 10; index += 1) {
    out += '<rect x="' + x + '" y="' + (y + index * 13) + '" width="34" height="11" rx="3" fill="#54b99d" stroke="#216b58" stroke-width="2"/>';
  }
  return out + "</g>";
}

function ones(count: number, startX: number, y: number): string {
  let out = "";
  for (let index = 0; index < count; index += 1) {
    out += '<rect x="' + (startX + index * 24) + '" y="' + y + '" width="18" height="18" rx="5" fill="#f2b84b" stroke="#9a6a17" stroke-width="2"/>';
  }
  return out;
}

function arrayDots(rows: number, columns: number, x: number, y: number, highlightedRow = -1): string {
  let out = "";
  for (let row = 0; row < rows; row += 1) {
    if (row === highlightedRow) {
      out += '<rect x="' + (x - 18) + '" y="' + (y + row * 40 - 18) + '" width="' + (columns * 40 - 4) + '" height="36" rx="18" fill="#e5f4ef"/>';
    }
    for (let col = 0; col < columns; col += 1) {
      out += '<circle cx="' + (x + col * 40) + '" cy="' + (y + row * 40) + '" r="13" fill="' + (row === highlightedRow ? "#f2b84b" : "#54b99d") + '" stroke="#216b58" stroke-width="3"/>';
    }
  }
  return out;
}

function groupBox(x: number, y: number, count: number, label = "", fill = "#ffffff"): string {
  const width = count > 4 ? 160 : 118;
  const dots = groupDots(count, x + 28, y + 34);
  const caption = label ? t(x + 14, y + 92, label, 18, "#273a33", 800) : "";
  return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="108" rx="16" fill="' + fill + '" stroke="#2c7a61" stroke-width="4" stroke-dasharray="8 8"/>'
    + dots
    + caption;
}

function groupDots(count: number, x: number, y: number): string {
  let out = "";
  for (let index = 0; index < count; index += 1) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    out += '<circle cx="' + (x + col * 24) + '" cy="' + (y + row * 28) + '" r="10" fill="#54b99d" stroke="#216b58" stroke-width="3"/>';
  }
  return out;
}

function fractionBar(colored: number, total: number, x: number, y: number): string {
  let out = "";
  for (let index = 0; index < total; index += 1) {
    out += '<rect x="' + (x + index * 62) + '" y="' + y + '" width="58" height="80" rx="8" fill="' + (index < colored ? "#54b99d" : "#ffffff") + '" stroke="#216b58" stroke-width="4"/>';
  }
  return out;
}

function miniFractionBar(colored: number, total: number, x: number, y: number, label: string): string {
  let out = t(x, y - 14, label, 20, "#273a33", 800);
  for (let index = 0; index < total; index += 1) {
    out += '<rect x="' + (x + index * 36) + '" y="' + y + '" width="34" height="74" rx="7" fill="' + (index < colored ? "#54b99d" : "#ffffff") + '" stroke="#216b58" stroke-width="4"/>';
  }
  return out;
}

function hundredGrid(colored: number, x: number, y: number): string {
  let out = "";
  for (let index = 0; index < 100; index += 1) {
    const row = Math.floor(index / 10);
    const col = index % 10;
    out += '<rect x="' + (x + col * 15) + '" y="' + (y + row * 15) + '" width="13" height="13" fill="' + (index < colored ? "#54b99d" : "#ffffff") + '" stroke="#216b58" stroke-width="1"/>';
  }
  return out;
}

function dynamicTeachingMedia(aid: TeachingAid, step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  if (!aid.appliesTo.operations.includes(prompt.operation)) {
    return [];
  }
  if (prompt.operation === "count") {
    return renderCountingStep(step, prompt);
  }
  if (prompt.operation === "add") {
    return renderAdditionStep(step, prompt);
  }
  if (prompt.operation === "subtract") {
    return renderSubtractionStep(step, prompt);
  }
  if (prompt.operation === "placeValue") {
    return renderPlaceValueStep(step, prompt);
  }
  if (prompt.operation === "skipCount") {
    return renderSkipCountStep(step, prompt);
  }
  if (prompt.operation === "groups" || prompt.operation === "arrays" || prompt.operation === "multiply" || prompt.operation === "divide") {
    return renderGroupsArraysStep(step, prompt);
  }
  if (prompt.operation === "fraction") {
    return renderFractionStep(step, prompt);
  }
  if (prompt.operation === "decimal") {
    return renderDecimalStep(step, prompt);
  }
  return [];
}

function renderCountingStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const count = numberValue(prompt.visualCount ?? prompt.metadata.answer, 5);
  const label = count === 1 ? "1 gem" : String(count) + " gems";
  const art = t(42, 54, step.kind === "check" ? "The last number you say is the answer" : "Count the active gems")
    + gemGrid(count, 72, 108, { labels: step.kind === "try" || step.kind === "check" })
    + (step.kind === "check" ? t(352, 218, "last number = ?", 22, "#216b58") : "");
  return teachingGraphicFromArt(art, "Active count problem showing " + label + ".", "Uses this problem's count.");
}

function renderAdditionStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const left = numberValue(prompt.metadata.left, 0);
  const right = numberValue(prompt.metadata.right, 0);
  const bigger = Math.max(left, right);
  const smaller = Math.min(left, right);
  const smallModel = left + right <= 20;
  let art = "";
  let alt = "Active addition problem " + left + " plus " + right + ".";
  if (smallModel) {
    if (step.kind === "understand") {
      art = t(66, 54, "Two groups join together")
        + groupBox(62, 92, left, String(left), "#e5f4ef")
        + t(252, 150, "+", 34)
        + groupBox(302, 92, right, String(right), "#fff5d8");
    } else if (step.kind === "plan") {
      art = t(50, 54, "Start at " + bigger + ", then count on " + smaller)
        + groupBox(70, 96, Math.max(1, Math.min(bigger, 12)), "start: " + bigger, "#e5f4ef")
        + t(252, 152, "+", 34)
        + groupBox(312, 96, Math.max(1, Math.min(smaller, 12)), smaller === 0 ? "+0" : "count " + smaller, "#fff5d8");
    } else if (step.kind === "try") {
      art = countOnLine(bigger, smaller);
      alt = "Active addition count-on line starts at " + bigger + " and makes " + smaller + " jumps.";
    } else {
      art = t(54, 54, smaller === 0 ? "Adding zero keeps the number" : "Adding more makes the total grow")
        + equationCard(String(left), "+", String(right), "?")
        + t(118, 218, smaller === 0 ? "No new gems joined." : "Check that your total is more than the start.", 22, "#216b58");
    }
  } else {
    art = t(54, 54, step.kind === "check" ? "Check tens and ones" : "Add tens, then ones")
      + twoDigitBreak(left, 64, 90, "#e5f4ef")
      + t(232, 148, "+", 34)
      + twoDigitBreak(right, 290, 90, "#fff5d8")
      + t(154, 224, String(left) + " + " + String(right) + " = ?", 28, "#216b58");
  }
  return teachingGraphicFromArt(art, alt, "Uses this problem's addends.");
}

function renderSubtractionStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const left = numberValue(prompt.metadata.left, 0);
  const right = numberValue(prompt.metadata.right, 0);
  const smallModel = left <= 20;
  let art = "";
  if (smallModel) {
    if (step.kind === "check") {
      art = t(64, 54, "Add back the part taken away")
        + equationCard("?", "+", String(right), String(left))
        + t(92, 218, "Your answer plus " + right + " should return to " + left + ".", 22, "#216b58");
    } else {
      art = t(46, 54, step.kind === "try" ? "Count what is still there" : "Start with " + left + " and take away " + right)
        + gemGrid(left, 54, 104, { crossedFrom: left - right })
        + t(78, 224, "start: " + left, 22, "#216b58")
        + t(328, 224, "take away: " + right, 22, "#c44f45");
    }
  } else {
    art = t(58, 54, step.kind === "check" ? "Check with addition" : "Subtract ones, then tens")
      + equationCard(String(left), "-", String(right), "?")
      + t(122, 218, "? + " + right + " should return to " + left, 22, "#216b58");
  }
  return teachingGraphicFromArt(art, "Active subtraction problem " + left + " minus " + right + ".", "Uses this problem's start and take-away numbers.");
}

function renderPlaceValueStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const tens = numberValue(prompt.metadata.tens, Math.floor(numberValue(prompt.metadata.answer, 34) / 10));
  const oneCount = numberValue(prompt.metadata.ones, numberValue(prompt.metadata.answer, 34) % 10);
  const value = tens * 10 + oneCount;
  const art = t(62, 54, step.kind === "try" ? "Count tens first, then ones" : "Tens and ones make the number")
    + tensBlocks(tens, 58, 82)
    + ones(oneCount, 58 + Math.min(tens, 6) * 44 + 22, 152)
    + t(88, 224, String(tens) + " tens = " + String(tens * 10), 22, "#216b58")
    + t(292, 224, String(oneCount) + " ones = " + String(oneCount), 22, "#9a6a17")
    + (step.kind === "check" ? t(188, 188, String(value) + " = " + String(tens * 10) + " + " + String(oneCount), 24, "#273a33") : "");
  return teachingGraphicFromArt(art, "Active place-value problem with " + tens + " tens and " + oneCount + " ones.", "Uses this problem's tens and ones.");
}

function renderSkipCountStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const pattern = skipPattern(prompt);
  const art = t(52, 54, step.kind === "check" ? "Every jump stays +" + pattern.step : "Start, then jump +" + pattern.step)
    + arrowDefs()
    + pattern.values.map((value, index) => {
      const x = 58 + index * 116;
      return '<rect x="' + x + '" y="118" width="78" height="58" rx="14" fill="' + (value === null ? "#fff5d8" : "#e5f4ef") + '" stroke="' + (value === null ? "#9a6a17" : "#216b58") + '" stroke-width="4"/>'
        + t(x + (value === null ? 28 : 18), 156, value === null ? "?" : String(value), 28, "#273a33")
        + (index < pattern.values.length - 1 ? arrow(x + 78, 120, x + 112, 120) + t(x + 82, 104, "+" + pattern.step, 18, "#216b58") : "");
    }).join("");
  return teachingGraphicFromArt(art, "Active skip-count pattern with jumps of " + pattern.step + ".", "Uses this problem's jump size and missing slot.");
}

function renderGroupsArraysStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const left = numberValue(prompt.metadata.left, 3);
  const right = numberValue(prompt.metadata.right, 4);
  if (prompt.operation === "divide") {
    const total = left;
    const groups = right;
    const missingFactor = prompt.question.includes("x ?");
    const art = t(54, 54, missingFactor ? "Use the fact family" : "Share into equal groups")
      + t(66, 104, missingFactor ? String(groups) + " x ? = " + total : String(total) + " / " + String(groups) + " = ?", 34, "#273a33")
      + sharedGroups(total, groups)
      + t(92, 224, missingFactor ? "Each equal group has the same missing size." : "Split the total into " + groups + " equal groups.", 21, "#216b58");
    return teachingGraphicFromArt(art, "Active division problem with " + total + " total split into " + groups + " equal groups.", "Uses this problem's division numbers.");
  }
  const rows = prompt.visualArray?.rows ?? left;
  const columns = prompt.visualArray?.columns ?? right;
  const art = t(54, 54, prompt.operation === "arrays" ? "Rows and columns show equal groups" : "Equal groups have the same size")
    + (prompt.operation === "groups"
      ? groupRow(left, right, 54, 92)
      : arrayDotsFit(rows, columns, 74, 86, 300, 128))
    + t(352, 118, prompt.operation === "groups" ? String(left) + " groups" : String(rows) + " rows", 24, "#216b58")
    + t(352, 156, prompt.operation === "groups" ? String(right) + " in each" : String(columns) + " columns", 24, "#216b58")
    + t(352, 196, "total = ?", 24, "#273a33");
  return teachingGraphicFromArt(art, "Active equal-groups problem using " + left + " and " + right + ".", "Uses this problem's groups or array.");
}

function renderFractionStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  const mode = prompt.metadata.mode;
  if (prompt.visualCompare) {
    const art = t(48, 54, "Compare same-size wholes")
      + partBar(prompt.visualCompare.left, 58, 104, 190, 58, "A: " + modelText(prompt.visualCompare.left))
      + partBar(prompt.visualCompare.right, 278, 104, 190, 58, "B: " + modelText(prompt.visualCompare.right))
      + t(92, 222, "If denominators match, compare colored parts.", 21, "#216b58");
    return teachingGraphicFromArt(art, "Active fraction comparison with models A and B.", "Uses this problem's fraction comparison.");
  }
  if (prompt.visualEquivalent) {
    const [left, right] = prompt.visualEquivalent.models;
    const art = t(48, 54, "Compare the amount, not piece count")
      + partBar(left, 58, 104, 190, 58, "A: " + modelText(left))
      + partBar(right, 278, 104, 190, 58, "B: " + modelText(right))
      + t(106, 222, "Same colored length means equivalent.", 21, "#216b58");
    return teachingGraphicFromArt(art, "Active equivalent-fraction models.", "Uses this problem's equivalent-fraction models.");
  }
  if (prompt.visualOperation) {
    const left = prompt.visualOperation.left;
    const right = prompt.visualOperation.right;
    const art = t(50, 54, "Same denominator stays the same")
      + partBar(left, 50, 104, 170, 58, modelText(left))
      + t(236, 142, prompt.visualOperation.operator, 34)
      + partBar(right, 284, 104, 170, 58, modelText(right))
      + t(118, 222, "Combine or remove numerator parts. Result = ?", 21, "#216b58");
    return teachingGraphicFromArt(art, "Active fraction operation with denominator " + left.total + ".", "Uses this problem's fraction operation.");
  }
  const partModel = prompt.visualPart ?? partFromPrompt(prompt, "fraction");
  const art = t(50, 54, mode === "match" ? "Match colored parts to the fraction" : "Numerator and denominator")
    + partBar(partModel, 96, 106, 328, 68, modelText(partModel))
    + t(84, 222, String(partModel.total) + " equal parts; " + String(partModel.colored) + " colored parts.", 21, "#216b58");
  return teachingGraphicFromArt(art, "Active fraction model with " + partModel.colored + " colored out of " + partModel.total + " equal parts.", "Uses this problem's fraction model.");
}

function renderDecimalStep(step: TeachingAidStep, prompt: MathPrompt): TeachingAidMedia[] {
  if (prompt.visualCompare) {
    const art = t(48, 54, "Compare how much of the whole is colored")
      + decimalModel(prompt.visualCompare.left, 58, 88, 160, 118, "A: " + modelText(prompt.visualCompare.left))
      + decimalModel(prompt.visualCompare.right, 288, 88, 160, 118, "B: " + modelText(prompt.visualCompare.right));
    return teachingGraphicFromArt(art, "Active decimal comparison models.", "Uses this problem's decimal comparison.");
  }
  if (prompt.visualEquivalent) {
    const [left, right] = prompt.visualEquivalent.models;
    const art = t(46, 54, "Tenths can match hundredths")
      + decimalModel(left, 58, 88, 160, 118, modelText(left))
      + decimalModel(right, 288, 88, 160, 118, modelText(right))
      + t(124, 232, "Same colored amount means same value.", 21, "#216b58");
    return teachingGraphicFromArt(art, "Active decimal equivalence models.", "Uses this problem's decimal equivalence models.");
  }
  if (prompt.visualOperation) {
    const left = prompt.visualOperation.left;
    const right = prompt.visualOperation.right;
    const unit = decimalUnit(left.total);
    const art = t(48, 54, "Combine or remove " + unit)
      + decimalModel(left, 54, 86, 140, 104, modelText(left))
      + t(222, 142, prompt.visualOperation.operator, 34)
      + decimalModel(right, 282, 86, 140, 104, modelText(right))
      + t(112, 230, "Keep the same place value. Result = ?", 21, "#216b58");
    return teachingGraphicFromArt(art, "Active decimal operation using " + unit + ".", "Uses this problem's decimal operation.");
  }
  const partModel = prompt.visualPart ?? partFromPrompt(prompt, "decimal");
  const unit = decimalUnit(partModel.total);
  const art = t(52, 54, "This model is split into " + unit)
    + decimalModel(partModel, 136, 82, 220, 138, modelText(partModel))
    + t(92, 236, String(partModel.colored) + " colored " + unit + " keeps its place value.", 21, "#216b58");
  return teachingGraphicFromArt(art, "Active decimal model with " + partModel.colored + " colored " + unit + ".", "Uses this problem's decimal model.");
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function partFromPrompt(prompt: MathPrompt, kind: PartModel["kind"]): PartModel {
  const colored = numberValue(prompt.metadata.left, 1);
  const total = numberValue(prompt.metadata.denominator ?? prompt.metadata.right, kind === "decimal" ? prompt.metadata.decimalPlace === "hundredths" ? 100 : 10 : 4);
  return { kind, colored, total, label: kind === "decimal" ? decimalText(colored, total) : String(colored) + "/" + String(total) };
}

function modelText(model: PartModel): string {
  return model.label ?? (model.kind === "decimal" ? decimalText(model.colored, model.total) : String(model.colored) + "/" + String(model.total));
}

function decimalText(colored: number, total: number): string {
  return total === 100 ? "0." + String(colored).padStart(2, "0") : "0." + String(colored);
}

function decimalUnit(total: number): string {
  return total === 100 ? "hundredths" : "tenths";
}

function gemGrid(count: number, startX: number, startY: number, opts: { labels?: boolean; crossedFrom?: number } = {}): string {
  const visible = Math.min(Math.max(0, count), 20);
  const columns = Math.min(10, Math.max(1, visible));
  let out = "";
  for (let index = 0; index < visible; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    out += gem(startX + col * 42, startY + row * 46, opts.labels ? String(index + 1) : "", "#54b99d", opts.crossedFrom !== undefined && index >= opts.crossedFrom);
  }
  if (count > visible) {
    out += t(startX + columns * 42 + 4, startY + 12, "+ " + String(count - visible) + " more", 20, "#216b58");
  }
  return out;
}

function countOnLine(start: number, jumps: number): string {
  if (jumps === 0) {
    return t(56, 54, "Zero jumps means stay at " + start)
      + '<path d="M96 154 H424" stroke="#2c7a61" stroke-width="6" stroke-linecap="round"/>'
      + t(224, 138, String(start), 30, "#273a33")
      + t(178, 214, "No new steps. Total = ?", 22, "#216b58");
  }
  const jumpCount = Math.min(jumps, 6);
  const spacing = 320 / jumpCount;
  let art = t(58, 54, "Count on " + jumps + " jumps")
    + arrowDefs()
    + '<path d="M92 164 H428" stroke="#2c7a61" stroke-width="5" stroke-linecap="round"/>'
    + t(82, 204, String(start), 22, "#273a33");
  for (let index = 0; index < jumpCount; index += 1) {
    const x1 = 96 + index * spacing;
    const x2 = 96 + (index + 1) * spacing;
    art += arrow(x1, 136, x2, 136) + t(x1 + spacing / 2 - 10, 116, "+1", 16, "#216b58");
  }
  art += t(400, 204, jumps > jumpCount ? "..." : "?", 24, "#273a33");
  return art;
}

function equationCard(left: string, operator: string, right: string, result: string): string {
  return '<rect x="72" y="104" width="376" height="72" rx="18" fill="#ffffff" stroke="#d8dfcf" stroke-width="4"/>'
    + t(102, 150, left, 30, "#273a33")
    + t(190, 150, operator, 30, "#273a33")
    + t(260, 150, right, 30, "#273a33")
    + t(336, 150, "= " + result, 30, "#216b58");
}

function twoDigitBreak(value: number, x: number, y: number, fill: string): string {
  const tensCount = Math.floor(value / 10);
  const onesCount = value % 10;
  return '<rect x="' + x + '" y="' + y + '" width="158" height="92" rx="16" fill="' + fill + '" stroke="#d8dfcf" stroke-width="4"/>'
    + t(x + 18, y + 36, String(value), 30, "#273a33")
    + t(x + 18, y + 72, String(tensCount) + " tens + " + String(onesCount) + " ones", 16, "#216b58");
}

function tensBlocks(count: number, startX: number, y: number): string {
  let out = "";
  const visible = Math.min(count, 6);
  for (let index = 0; index < visible; index += 1) {
    out += tensBlock(startX + index * 44, y);
  }
  if (count > visible) {
    out += t(startX + visible * 44 + 8, y + 74, "+ " + String(count - visible) + " tens", 18, "#216b58");
  }
  return out;
}

function skipPattern(prompt: MathPrompt): { values: Array<number | null>; step: number } {
  const step = numberValue(prompt.metadata.step, 1);
  const values = prompt.question.split(",").map((part) => {
    const trimmed = part.trim();
    return trimmed === "?" ? null : Number(trimmed);
  }).map((value) => Number.isFinite(value as number) ? value as number : null);
  return { values: values.length > 0 ? values : [null], step };
}

function groupRow(groups: number, size: number, x: number, y: number): string {
  const visibleGroups = Math.min(groups, 3);
  let out = "";
  for (let index = 0; index < visibleGroups; index += 1) {
    out += groupBox(x + index * 128, y, Math.min(size, 12), String(size));
  }
  if (groups > visibleGroups) {
    out += t(x + visibleGroups * 128 + 4, y + 60, "+ " + String(groups - visibleGroups) + " groups", 18, "#216b58");
  }
  return out;
}

function sharedGroups(total: number, groups: number): string {
  const visibleGroups = Math.min(groups, 4);
  let out = "";
  for (let index = 0; index < visibleGroups; index += 1) {
    out += '<rect x="' + (70 + index * 94) + '" y="132" width="74" height="58" rx="16" fill="#ffffff" stroke="#2c7a61" stroke-width="4" stroke-dasharray="8 8"/>'
      + t(94 + index * 94, 168, "?", 28, "#273a33");
  }
  if (groups > visibleGroups) {
    out += t(70 + visibleGroups * 94, 166, "+ " + String(groups - visibleGroups) + " more", 18, "#216b58");
  }
  out += t(354, 104, "total: " + total, 22, "#216b58");
  return out;
}

function arrayDotsFit(rows: number, columns: number, x: number, y: number, width: number, height: number): string {
  const rowCount = Math.max(1, rows);
  const columnCount = Math.max(1, columns);
  const spacingX = columnCount > 1 ? width / (columnCount - 1) : 0;
  const spacingY = rowCount > 1 ? height / (rowCount - 1) : 0;
  const radius = Math.max(4, Math.min(12, spacingX || 12, spacingY || 12) - 2);
  let out = "";
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < columnCount; col += 1) {
      out += '<circle cx="' + (x + col * spacingX) + '" cy="' + (y + row * spacingY) + '" r="' + radius + '" fill="#54b99d" stroke="#216b58" stroke-width="2"/>';
    }
  }
  return out;
}

function partBar(model: PartModel, x: number, y: number, width: number, height: number, label: string): string {
  const total = Math.max(1, model.total);
  const cellWidth = width / total;
  let out = t(x, y - 14, label, 18, "#273a33", 800);
  for (let index = 0; index < total; index += 1) {
    out += '<rect x="' + (x + index * cellWidth) + '" y="' + y + '" width="' + Math.max(4, cellWidth - 2) + '" height="' + height + '" rx="6" fill="' + (index < model.colored ? "#54b99d" : "#ffffff") + '" stroke="#216b58" stroke-width="3"/>';
  }
  return out;
}

function decimalModel(model: PartModel, x: number, y: number, width: number, height: number, label: string): string {
  let out = t(x, y - 12, label, 18, "#273a33", 800);
  if (model.total === 10) {
    const cellWidth = width / 10;
    for (let index = 0; index < 10; index += 1) {
      out += '<rect x="' + (x + index * cellWidth) + '" y="' + y + '" width="' + Math.max(4, cellWidth - 2) + '" height="' + height + '" rx="5" fill="' + (index < model.colored ? "#54b99d" : "#ffffff") + '" stroke="#216b58" stroke-width="3"/>';
    }
    return out;
  }
  const cell = Math.min(width, height) / 10;
  for (let index = 0; index < 100; index += 1) {
    const row = Math.floor(index / 10);
    const col = index % 10;
    out += '<rect x="' + (x + col * cell) + '" y="' + (y + row * cell) + '" width="' + Math.max(3, cell - 1) + '" height="' + Math.max(3, cell - 1) + '" fill="' + (index < model.colored ? "#54b99d" : "#ffffff") + '" stroke="#216b58" stroke-width="1"/>';
  }
  return out;
}

const TEACHING_GRAPHICS: Record<string, string> = {
  blank: t(176, 136, "Think it through"),
  "counting-understand": t(42, 54, "Count the gems you can see") + rowGems(5, 142, 138),
  "counting-plan": t(48, 54, "Touch each gem one time") + arrowDefs() + rowGems(5, 128, 144) + arrow(90, 204, 122, 174) + arrow(166, 204, 170, 174) + arrow(214, 204, 218, 174) + arrow(262, 204, 266, 174) + arrow(310, 204, 314, 174),
  "counting-try": t(82, 54, "Say one number for each gem") + rowGems(5, 128, 140, { labels: true }),
  "counting-check": t(64, 54, "The last number is the answer") + rowGems(5, 118, 132, { labels: true }) + '<rect x="380" y="104" width="84" height="66" rx="12" fill="#fff5d8" stroke="#9a6a17" stroke-width="4"/>' + t(404, 148, "5"),
  "addition-understand": t(74, 54, "Two groups join together") + groupBox(64, 92, 7, "7", "#e5f4ef") + t(252, 150, "+", 34) + groupBox(302, 92, 4, "4", "#fff5d8"),
  "addition-plan": t(54, 54, "Start at 7, then count on 4") + groupBox(64, 92, 7, "start: 7", "#e5f4ef") + t(252, 150, "+", 34) + groupBox(302, 92, 4, "count on 4", "#fff5d8"),
  "addition-try": t(70, 54, "Count on one step at a time") + arrowDefs() + t(80, 168, "7") + t(166, 168, "8") + t(252, 168, "9") + t(334, 168, "10") + t(426, 168, "11") + arrow(102, 132, 158, 132) + arrow(188, 132, 244, 132) + arrow(274, 132, 330, 132) + arrow(366, 132, 422, 132) + t(202, 218, "7 + 4 = 11", 26, "#216b58"),
  "addition-check": t(54, 54, "Adding more grows; +0 stays") + '<rect x="70" y="106" width="76" height="58" rx="12" fill="#e5f4ef" stroke="#216b58" stroke-width="4"/>' + t(96, 144, "7") + t(174, 144, "+", 34) + '<rect x="222" y="106" width="76" height="58" rx="12" fill="#fff5d8" stroke="#9a6a17" stroke-width="4"/>' + t(250, 144, "4") + t(326, 144, "= ?", 32),
  "subtraction-understand": t(52, 54, "Start with the whole group") + rowGems(9, 54, 132, { crossedFrom: 6 }) + t(74, 210, "start: 9", 22, "#216b58") + t(346, 210, "take away 3", 22, "#c44f45"),
  "subtraction-plan": t(54, 54, "Cross out the part that leaves") + rowGems(9, 54, 132, { crossedFrom: 6 }),
  "subtraction-try": t(76, 54, "Count what is still there") + rowGems(6, 102, 132) + t(398, 144, "= 6", 34),
  "subtraction-check": t(66, 54, "Add back to check") + rowGems(6, 66, 128) + t(360, 140, "+ 3 = 9", 30),
  "place-understand": t(64, 54, "Tens digit and ones digit") + t(92, 164, "34", 64, "#273a33", 900) + tensBlock(250, 76) + tensBlock(294, 76) + tensBlock(338, 76) + ones(4, 392, 132),
  "place-plan": t(86, 54, "Break into tens and ones") + t(92, 148, "34", 58) + t(186, 148, "=", 44) + t(244, 148, "30", 48, "#216b58") + t(326, 148, "+", 42) + t(382, 148, "4", 48, "#9a6a17"),
  "place-try": t(76, 54, "Count tens first, then ones") + tensBlock(90, 80) + tensBlock(134, 80) + tensBlock(178, 80) + t(96, 236, "10") + t(140, 236, "20") + t(184, 236, "30") + ones(4, 292, 134),
  "place-check": t(72, 54, "Match both parts") + '<rect x="82" y="100" width="142" height="86" rx="14" fill="#e5f4ef" stroke="#216b58" stroke-width="4"/>' + t(112, 150, "3 tens") + '<rect x="286" y="100" width="142" height="86" rx="14" fill="#fff5d8" stroke="#9a6a17" stroke-width="4"/>' + t(314, 150, "4 ones"),
  "skip-understand": t(58, 54, "Start number and jump size") + arrowDefs() + t(80, 158, "10") + t(182, 158, "15") + t(284, 158, "20") + t(386, 158, "?") + arrow(112, 122, 174, 122) + arrow(214, 122, 276, 122) + arrow(316, 122, 378, 122) + t(146, 108, "+5", 18) + t(248, 108, "+5", 18) + t(350, 108, "+5", 18),
  "skip-plan": t(74, 54, "Tap each equal jump") + arrowDefs() + t(84, 158, "10") + t(184, 158, "15") + t(284, 158, "20") + t(386, 158, "?") + arrow(114, 122, 176, 122) + arrow(214, 122, 276, 122) + arrow(314, 122, 378, 122),
  "skip-try": t(68, 54, "Make one jump at a time") + '<rect x="78" y="104" width="354" height="76" rx="16" fill="#e5f4ef" stroke="#216b58" stroke-width="4"/>' + t(108, 152, "10, 15, 20, ?", 32),
  "skip-check": t(82, 54, "All jumps stay the same") + t(108, 136, "+5") + t(218, 136, "+5") + t(328, 136, "+5") + '<path d="M90 164 H430" stroke="#2c7a61" stroke-width="5" stroke-linecap="round"/>',
  "groups-understand": t(64, 54, "Groups and each group size") + groupBox(54, 88, 4, "group 1") + groupBox(202, 88, 4, "group 2") + groupBox(350, 88, 4, "group 3"),
  "groups-plan": t(72, 54, "Count by groups") + groupBox(54, 88, 4, "4") + groupBox(202, 88, 4, "8") + groupBox(350, 88, 4, "12"),
  "groups-try": t(84, 54, "Point to each group") + groupBox(54, 88, 4, "4") + groupBox(202, 88, 4, "8") + groupBox(350, 88, 4, "12"),
  "groups-check": t(80, 54, "Rows and columns match") + arrayDots(3, 4, 92, 90) + '<rect x="66" y="68" width="170" height="116" rx="16" fill="none" stroke="#2c7a61" stroke-width="4" stroke-dasharray="8 8"/>' + t(300, 116, "3 rows") + t(300, 156, "4 columns") + t(300, 196, "12 total", 24, "#216b58"),
  "fraction-understand": t(68, 54, "Equal parts and colored parts") + miniFractionBar(3, 4, 70, 116, "A: 3 of 4") + miniFractionBar(2, 4, 292, 116, "B: 2 of 4"),
  "fraction-plan": t(58, 54, "Denominator total, numerator colored") + miniFractionBar(3, 4, 70, 122, "A") + t(134, 104, "3/4", 26, "#216b58") + miniFractionBar(2, 4, 292, 122, "B") + t(356, 104, "2/4", 26, "#216b58"),
  "fraction-try": t(44, 54, "Compare after the wholes match") + miniFractionBar(3, 4, 70, 116, "A: 3/4") + miniFractionBar(2, 4, 292, 116, "B: 2/4") + t(180, 226, "same-size wholes", 22, "#216b58"),
  "fraction-check": t(82, 54, "Match the picture") + miniFractionBar(3, 4, 70, 116, "A: 3/4") + miniFractionBar(2, 4, 292, 116, "B: 2/4") + t(196, 226, "A has more colored parts", 22, "#216b58"),
  "decimal-understand": t(70, 54, "Tenths or hundredths?") + hundredGrid(23, 92, 78) + t(298, 140, "100 tiny parts", 26),
  "decimal-plan": t(62, 54, "Count colored parts with place") + hundredGrid(23, 70, 78) + t(272, 128, "23 hundredths") + t(318, 168, "= 0.23", 30),
  "decimal-try": t(54, 54, "Groups first, then extras") + hundredGrid(23, 70, 78) + t(274, 120, "10 + 10 + 3", 30) + t(336, 166, "23", 34, "#216b58"),
  "decimal-check": t(62, 54, "Decimal matches colored parts") + hundredGrid(23, 70, 78) + '<rect x="298" y="104" width="118" height="66" rx="14" fill="#e5f4ef" stroke="#216b58" stroke-width="4"/>' + t(324, 148, "0.23", 30)
};

export const TEACHING_AIDS: TeachingAid[] = [
  {
    id: "counting-small-groups",
    conceptKey: "counting-small-groups",
    title: "Count one at a time",
    buttonLabel: "Count together",
    appliesTo: { operations: ["count"], gradeLanes: ["kindergarten"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["What are we counting? Count only the gems you can see."], media: teachingGraphic("counting-understand", "Five green gems to count.") },
      { kind: "plan", title: "Plan", prompts: ["Touch each gem one time so none are skipped or counted twice."], media: teachingGraphic("counting-plan", "Arrows point to each gem once.") },
      { kind: "try", title: "Try", prompts: ["Start at one and say one number for each gem."], media: teachingGraphic("counting-try", "Each gem is labeled one through five.") },
      { kind: "check", title: "Check", prompts: ["Point again. Did the last number match your answer?"], media: teachingGraphic("counting-check", "The last counted gem shows five as the answer.") }
    ],
    reviewQuestion: "What number did you say last?"
  },
  {
    id: "addition-within-20",
    conceptKey: "addition-within-20",
    title: "Add by making a picture",
    buttonLabel: "Show a way",
    appliesTo: { operations: ["add"], gradeLanes: ["kindergarten", "grade1", "grade2"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["What two numbers are joining together?"], media: teachingGraphic("addition-understand", "Two groups of gems join together.") },
      { kind: "plan", title: "Plan", prompts: ["Start with the bigger number, then count on the smaller number."], media: teachingGraphic("addition-plan", "Seven gems start the count, then four more are added.") },
      { kind: "try", title: "Try", prompts: ["Tap or count one small step at a time. What number do you land on?"], media: teachingGraphic("addition-try", "A number line counts on from seven to eleven.") },
      { kind: "check", title: "Check", prompts: ["If you add more, the total grows. If you add zero, it stays the same."], media: teachingGraphic("addition-check", "The example checks that adding more grows and adding zero stays the same.") }
    ],
    reviewQuestion: "What counting step helped most?"
  },
  {
    id: "subtraction-within-20",
    conceptKey: "subtraction-within-20",
    title: "Subtract by taking away",
    buttonLabel: "Use a picture",
    appliesTo: { operations: ["subtract"], gradeLanes: ["kindergarten", "grade1", "grade2"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["What number do you start with? What is being taken away?"], media: teachingGraphic("subtraction-understand", "Nine gems with three crossed out.") },
      { kind: "plan", title: "Plan", prompts: ["Picture the whole group, then cross out the part that leaves."], media: teachingGraphic("subtraction-plan", "Three gems are crossed out from the whole group.") },
      { kind: "try", title: "Try", prompts: ["Count what is still there after taking away."], media: teachingGraphic("subtraction-try", "Six uncrossed gems remain.") },
      { kind: "check", title: "Check", prompts: ["Can you add the answer and the taken-away part to get the start number?"], media: teachingGraphic("subtraction-check", "Six plus three returns to nine.") }
    ],
    reviewQuestion: "How could adding check your subtraction?"
  },
  {
    id: "place-value-tens-ones",
    conceptKey: "place-value-tens-ones",
    title: "Tens and ones",
    buttonLabel: "Think tens",
    appliesTo: { operations: ["placeValue"], gradeLanes: ["grade2"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["Which digit tells how many tens? Which digit tells how many ones?"], media: teachingGraphic("place-understand", "The number thirty-four with three tens rods and four ones.") },
      { kind: "plan", title: "Plan", prompts: ["Break the number into tens and ones before choosing."], media: teachingGraphic("place-plan", "Thirty-four breaks into thirty plus four.") },
      { kind: "try", title: "Try", prompts: ["Count tens first, then add the ones."], media: teachingGraphic("place-try", "Three tens are counted before four ones.") },
      { kind: "check", title: "Check", prompts: ["Does your choice match both the tens and the ones?"], media: teachingGraphic("place-check", "A check card shows three tens and four ones.") }
    ],
    reviewQuestion: "Which part was tens?"
  },
  {
    id: "skip-count-patterns",
    conceptKey: "skip-count-patterns",
    title: "Find the counting pattern",
    buttonLabel: "Find pattern",
    appliesTo: { operations: ["skipCount"], gradeLanes: ["grade2"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["What number does the pattern start with? How much does it jump?"], media: teachingGraphic("skip-understand", "A skip-counting line starts at ten and jumps by five.") },
      { kind: "plan", title: "Plan", prompts: ["Say each jump out loud or tap each jump with your finger."], media: teachingGraphic("skip-plan", "Equal arrows jump from ten to a missing number.") },
      { kind: "try", title: "Try", prompts: ["Make one jump at a time until the missing spot."], media: teachingGraphic("skip-try", "The pattern reads ten, fifteen, twenty, then a missing number.") },
      { kind: "check", title: "Check", prompts: ["Do all the jumps stay the same size?"], media: teachingGraphic("skip-check", "Every jump is labeled plus five.") }
    ]
  },
  {
    id: "groups-arrays",
    conceptKey: "groups-arrays",
    title: "Use groups",
    buttonLabel: "Use groups",
    appliesTo: { operations: ["groups", "arrays", "multiply", "divide"], gradeLanes: ["grade2", "grade3"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["How many groups are there? How many are in each group?"], media: teachingGraphic("groups-understand", "Three rows with four dots in each row.") },
      { kind: "plan", title: "Plan", prompts: ["Count by groups instead of counting every dot one by one."], media: teachingGraphic("groups-plan", "Three equal groups of four dots.") },
      { kind: "try", title: "Try", prompts: ["Point to each group and count the total."], media: teachingGraphic("groups-try", "The groups count four, eight, twelve.") },
      { kind: "check", title: "Check", prompts: ["Would rows and columns give the same total?"], media: teachingGraphic("groups-check", "An array shows three rows and four columns.") }
    ],
    reviewQuestion: "What did one group show?"
  },
  {
    id: "fraction-parts",
    conceptKey: "fraction-parts",
    title: "Look at equal parts",
    buttonLabel: "Use parts",
    appliesTo: { operations: ["fraction"], gradeLanes: ["grade4"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["How many equal parts are in the whole? How many are colored?"], media: teachingGraphic("fraction-understand", "Two same-size bars show three-fourths and two-fourths.") },
      { kind: "plan", title: "Plan", prompts: ["The denominator tells total equal parts. The numerator tells colored parts."], media: teachingGraphic("fraction-plan", "The same bars are labeled with numerator and denominator.") },
      { kind: "try", title: "Try", prompts: ["Compare colored parts only after checking the wholes are the same size."], media: teachingGraphic("fraction-try", "Three-fourths and two-fourths use same-size wholes.") },
      { kind: "check", title: "Check", prompts: ["Does your answer match the picture, not just the biggest number?"], media: teachingGraphic("fraction-check", "Three-fourths has more colored parts than two-fourths.") }
    ],
    reviewQuestion: "What did the denominator tell you?"
  },
  {
    id: "decimal-place-value",
    conceptKey: "decimal-place-value",
    title: "Tenths and hundredths",
    buttonLabel: "Use grid",
    appliesTo: { operations: ["decimal"], gradeLanes: ["grade4"] },
    steps: [
      { kind: "understand", title: "Understand", prompts: ["Is the grid split into tenths or hundredths?"], media: teachingGraphic("decimal-understand", "A hundredths grid with twenty-three colored squares.") },
      { kind: "plan", title: "Plan", prompts: ["Count colored parts and keep the place value with them."], media: teachingGraphic("decimal-plan", "Twenty-three colored hundredths are written as zero point two three.") },
      { kind: "try", title: "Try", prompts: ["Count groups first, then count the extra parts."], media: teachingGraphic("decimal-try", "Two groups of ten and three extra squares make twenty-three.") },
      { kind: "check", title: "Check", prompts: ["Does the decimal match the number of colored parts?"], media: teachingGraphic("decimal-check", "The hundredths grid matches the decimal zero point two three.") }
    ],
    reviewQuestion: "Was this tenths or hundredths?"
  }
];

export function teachingAidForPrompt(prompt: MathPrompt, settings: MathSettings): TeachingAid | null {
  return teachingAidForContext({
    gradeLane: prompt.gradeLane,
    operation: prompt.operation,
    path: prompt.path,
    promptFamily: prompt.metadata.mode ?? prompt.operation,
    conceptKey: [prompt.gradeLane, prompt.operation, prompt.metadata.mode ?? prompt.path, prompt.metadata.decimalPlace ?? ""].filter(Boolean).join(":"),
    skillTag: prompt.operation + ":" + prompt.path
  }, settings);
}

export function teachingAidForContext(context: SupportContext, settings: MathSettings): TeachingAid | null {
  const aid = TEACHING_AIDS.find((candidate) => {
    const operationMatch = candidate.appliesTo.operations.includes(context.operation);
    const gradeMatch = !candidate.appliesTo.gradeLanes || candidate.appliesTo.gradeLanes.includes(context.gradeLane);
    return operationMatch && gradeMatch;
  }) ?? null;
  if (!aid || settings.hiddenTeachingAidIds.includes(aid.id)) {
    return null;
  }
  return aid;
}

export function normalizeTeachingAidIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const validIds = new Set(TEACHING_AIDS.map((aid) => aid.id));
  return [...new Set(value.filter((item): item is string => typeof item === "string" && validIds.has(item)))];
}
