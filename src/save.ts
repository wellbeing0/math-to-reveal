import { DEFAULT_SETTINGS, normalizeSettings, type MathSettings, type PathId } from "./mathEngine";

export interface PathProgress {
  path: PathId;
  gradeLane: MathSettings["gradeLane"];
  promptIndex: number;
  seed: number;
  correct: number;
  mistakes: number;
  streak: number;
  answeredPromptIds: string[];
}

export interface MathSave {
  version: 5;
  settings: MathSettings;
  completedPrompts: number;
  completedSessions: number;
  revealedPieces: number;
  bestStreak: number;
  pathProgress: Record<string, PathProgress>;
}

const SAVE_KEY = "math-to-reveal-save-v1";

export const DEFAULT_SAVE: MathSave = {
  version: 5,
  settings: DEFAULT_SETTINGS,
  completedPrompts: 0,
  completedSessions: 0,
  revealedPieces: 0,
  bestStreak: 0,
  pathProgress: {}
};

export function loadSave(storage: Storage): MathSave {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) {
      return DEFAULT_SAVE;
    }
    const parsed = JSON.parse(raw) as Partial<MathSave>;
    return {
      version: 5,
      settings: normalizeSettings(parsed.settings),
      completedPrompts: clampNonNegative(parsed.completedPrompts),
      completedSessions: clampNonNegative(parsed.completedSessions),
      revealedPieces: clampNonNegative(parsed.revealedPieces),
      bestStreak: clampNonNegative(parsed.bestStreak),
      pathProgress: normalizePathProgress(parsed.pathProgress)
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function saveGame(storage: Storage, save: MathSave): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage: Storage, keepSettings: MathSettings): MathSave {
  const next = { ...DEFAULT_SAVE, settings: keepSettings };
  saveGame(storage, next);
  return next;
}

export function canUseStorage(storage: Storage): boolean {
  const testKey = "math-to-reveal-storage-test";
  try {
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function pathProgressKeyFor(path: PathId, settings: MathSettings, gradeLane: MathSettings["gradeLane"]): string {
  if (path === "mix") {
    return [
      "mix",
      settings.gradeLanes.join("+"),
      settings.enabledOperations.join("+"),
      settings.enableFractions ? "fractions" : "no-fractions",
      settings.enableDecimals ? "decimals" : "no-decimals",
      settings.decimalPlace,
      settings.fractionModes.join("+"),
      settings.decimalModes.join("+")
    ].join(":");
  }

  const decimalSuffix = path === "decimals" ? ":" + settings.decimalPlace : "";
  return gradeLane + ":" + path + decimalSuffix;
}

function clampNonNegative(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function normalizePathProgress(value: unknown): Record<string, PathProgress> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Record<string, PathProgress> = {};
  for (const [key, item] of Object.entries(value as Record<string, Partial<PathProgress>>)) {
    if (!item || !isPathId(item.path) || !isGradeLane(item.gradeLane)) {
      continue;
    }
    next[key] = {
      path: item.path,
      gradeLane: item.gradeLane,
      promptIndex: clampNonNegative(item.promptIndex),
      seed: clampNonNegative(item.seed),
      correct: clampNonNegative(item.correct),
      mistakes: clampNonNegative(item.mistakes),
      streak: clampNonNegative(item.streak),
      answeredPromptIds: Array.isArray(item.answeredPromptIds)
        ? item.answeredPromptIds.filter((id): id is string => typeof id === "string").slice(-20)
        : []
    };
  }
  return next;
}

function isPathId(value: unknown): value is PathId {
  return typeof value === "string" && ["count", "add", "subtract", "placeValue", "skipCount", "groups", "times", "divide", "arrays", "fractions", "decimals", "mix"].includes(value);
}

function isGradeLane(value: unknown): value is MathSettings["gradeLane"] {
  return value === "kindergarten" || value === "grade1" || value === "grade2" || value === "grade3" || value === "grade4";
}
