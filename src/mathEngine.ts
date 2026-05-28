import { normalizeTeachingAidIds } from "./teachingAids";

export type GradeLane = "kindergarten" | "grade1" | "grade2" | "grade3" | "grade4";
export type Operation =
  | "count"
  | "add"
  | "subtract"
  | "placeValue"
  | "skipCount"
  | "groups"
  | "multiply"
  | "divide"
  | "arrays"
  | "fraction"
  | "decimal";
export type PathId =
  | "count"
  | "add"
  | "subtract"
  | "placeValue"
  | "skipCount"
  | "groups"
  | "times"
  | "divide"
  | "arrays"
  | "fractions"
  | "decimals"
  | "mix";
export type InputMode = "choice" | "keypad";
export type AnswerValue = number | string;
export type DecimalPlace = "tenths" | "hundredths";
export type FractionMode = "name" | "match" | "compare" | "equivalent" | "addSubtract";
export type DecimalMode = "name" | "match" | "compare" | "equivalent" | "addSubtract";
export type PartModelKind = "fraction" | "decimal";
export type RewardThemeId =
  | "kittens"
  | "dinosaurs"
  | "dinosaurStickers"
  | "starWars"
  | "monsterTrucks"
  | "constructionEquipment"
  | "bugs";

export interface PartModel {
  kind: PartModelKind;
  colored: number;
  total: number;
  label?: string;
}

export interface MathSettings {
  gradeLane: GradeLane;
  gradeLanes: GradeLane[];
  enabledOperations: Operation[];
  maxAddend: number;
  maxAnswer: number;
  sessionLength: number;
  reducedMotion: boolean;
  allowRegrouping: boolean;
  enableFractions: boolean;
  enableDecimals: boolean;
  decimalPlace: DecimalPlace;
  fractionModes: FractionMode[];
  decimalModes: DecimalMode[];
  rewardTheme: RewardThemeId;
  hiddenRewardMediaIds: string[];
  attemptsToReward: number;
  seenTeachingAidIds: string[];
  hiddenTeachingAidIds: string[];
}

export interface MathPrompt {
  id: string;
  path: PathId;
  gradeLane: GradeLane;
  operation: Operation;
  inputMode: InputMode;
  question: string;
  audioInstructionId?: string;
  hint: string;
  visualCount?: number;
  visualGroups?: number[];
  visualArray?: { rows: number; columns: number };
  visualFraction?: { colored: number; total: number };
  visualPart?: PartModel;
  visualCompare?: { left: PartModel; right: PartModel };
  visualEquivalent?: { models: [PartModel, PartModel] };
  visualOperation?: { left: PartModel; right: PartModel; result: PartModel; operator: "+" | "-" };
  acceptedAnswers: AnswerValue[];
  choices: AnswerValue[];
  metadata: {
    left?: number;
    right?: number;
    answer: AnswerValue;
    helped: boolean;
    tens?: number;
    ones?: number;
    step?: number;
    denominator?: number;
    mode?: FractionMode | DecimalMode;
    decimalPlace?: DecimalPlace;
  };
}

export interface PromptRequest {
  path: PathId;
  settings: MathSettings;
  promptIndex: number;
  random: RandomSource;
  recentPromptIds?: string[];
}

export interface RandomSource {
  next(): number;
}

export const DEFAULT_SETTINGS: MathSettings = {
  gradeLane: "grade1",
  gradeLanes: ["grade1"],
  enabledOperations: ["count", "add", "subtract"],
  maxAddend: 10,
  maxAnswer: 20,
  sessionLength: 5,
  reducedMotion: false,
  allowRegrouping: false,
  enableFractions: false,
  enableDecimals: false,
  decimalPlace: "tenths",
  fractionModes: ["name", "match", "compare"],
  decimalModes: ["name", "match", "compare"],
  rewardTheme: "kittens",
  hiddenRewardMediaIds: [],
  attemptsToReward: 2,
  seenTeachingAidIds: [],
  hiddenTeachingAidIds: []
};

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    }
  };
}

export function eligiblePaths(settings: MathSettings): PathId[] {
  const operations = operationsForGrade(settings);
  const paths: PathId[] = [];
  for (const operation of operations) {
    const path = pathForOperation(operation);
    if (path && !paths.includes(path)) {
      paths.push(path);
    }
  }
  if (paths.length > 1) {
    paths.push("mix");
  }
  return paths.length > 0 ? paths : fallbackPaths(settings.gradeLane);
}

export function normalizeSettings(value: Partial<MathSettings> | null | undefined): MathSettings {
  const gradeLanes = normalizeGradeLanes(value?.gradeLanes, value?.gradeLane);
  const gradeLane = primaryGradeLane(gradeLanes);
  const hasGrade4 = gradeLanes.includes("grade4");
  const defaultFractions = hasGrade4 ? true : Boolean(value?.enableFractions);
  const defaultDecimals = hasGrade4 ? true : Boolean(value?.enableDecimals);
  const enableFractions = hasGrade4 ? true : defaultFractions;
  const enableDecimals = hasGrade4 ? true : defaultDecimals;
  const allowedOps = allowedOperationsForGrades(gradeLanes, enableFractions, enableDecimals);
  const incomingOps = uniqueOperations(value?.enabledOperations ?? defaultOperationsForGrades(gradeLanes));
  const enabledOperations = incomingOps.filter((operation) => allowedOps.includes(operation));
  const defaultOps = defaultOperationsForGrades(gradeLanes);
  const effectiveOperations = enabledOperations.length > 0 ? enabledOperations : defaultOps;
  const maxAnswerMinimum = minimumMaxAnswerFor(gradeLanes, effectiveOperations);

  return {
    gradeLane,
    gradeLanes,
    enabledOperations: effectiveOperations,
    maxAddend: clampInteger(value?.maxAddend, defaultMaxAddend(gradeLane), 3, gradeLane === "grade1" ? 12 : 99),
    maxAnswer: clampInteger(value?.maxAnswer, defaultMaxAnswer(gradeLane), maxAnswerMinimum, gradeLane === "grade1" ? 20 : 200),
    sessionLength: clampInteger(value?.sessionLength, gradeLane === "kindergarten" || gradeLane === "grade1" ? 5 : 6, 3, 10),
    reducedMotion: Boolean(value?.reducedMotion),
    allowRegrouping: Boolean(value?.allowRegrouping),
    enableFractions,
    enableDecimals,
    decimalPlace: value?.decimalPlace === "hundredths" ? "hundredths" : "tenths",
    fractionModes: normalizeModes(value?.fractionModes, ["name", "match", "compare"], allFractionModes),
    decimalModes: normalizeModes(value?.decimalModes, ["name", "match", "compare"], allDecimalModes),
    rewardTheme: normalizeRewardThemeId(value?.rewardTheme),
    hiddenRewardMediaIds: normalizeHiddenRewardMediaIds(value?.hiddenRewardMediaIds),
    attemptsToReward: clampInteger(value?.attemptsToReward, 2, 0, 3),
    seenTeachingAidIds: normalizeTeachingAidIds(value?.seenTeachingAidIds),
    hiddenTeachingAidIds: normalizeTeachingAidIds(value?.hiddenTeachingAidIds)
  };
}

function normalizeRewardThemeId(value: unknown): RewardThemeId {
  return value === "dinosaurs"
    || value === "dinosaurStickers"
    || value === "starWars"
    || value === "monsterTrucks"
    || value === "constructionEquipment"
    || value === "bugs"
    ? value
    : "kittens";
}

function normalizeHiddenRewardMediaIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = value.filter((item): item is string => typeof item === "string" && item.startsWith("giphy-"));
  return [...new Set(ids)].slice(0, 200);
}

export function generatePrompt(request: PromptRequest): MathPrompt {
  const recent = new Set(request.recentPromptIds ?? []);
  let prompt = generatePromptOnce(request, 0);
  if (recent.size === 0 || !recent.has(prompt.id)) {
    return prompt;
  }

  for (let offset = 1; offset <= 16; offset += 1) {
    prompt = generatePromptOnce(request, offset);
    if (!recent.has(prompt.id)) {
      return prompt;
    }
  }
  return prompt;
}

export function validateAnswer(prompt: MathPrompt, answer: AnswerValue): boolean {
  return prompt.acceptedAnswers.includes(answer);
}

export function buildChoices(answer: number, min: number, max: number, random: RandomSource, count = 4): number[] {
  const targetCount = Math.min(count, Math.max(1, max - min + 1));
  const values = new Set<number>([answer]);
  const nearby = [answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3]
    .filter((value) => value >= min && value <= max);
  for (const value of nearby) {
    if (values.size >= targetCount) {
      break;
    }
    values.add(value);
  }
  while (values.size < targetCount) {
    values.add(randomInt(random, min, max));
  }
  return shuffle([...values], random);
}

function generatePromptOnce(request: PromptRequest, offset: number): MathPrompt {
  const random = offset === 0
    ? request.random
    : createSeededRandom((request.promptIndex + 1) * 1009 + offset * 7919 + Math.floor(request.random.next() * 100000));
  const operation = resolveOperation(request.path, request.settings, random);
  const gradeLane = gradeLaneForOperation(operation, request.settings);
  const nextRequest = { ...request, settings: { ...request.settings, gradeLane }, random };
  if (operation === "count") {
    return generateCountPrompt(nextRequest);
  }
  if (operation === "subtract") {
    return generateSubtractionPrompt(nextRequest);
  }
  if (operation === "placeValue") {
    return generatePlaceValuePrompt(nextRequest);
  }
  if (operation === "skipCount") {
    return generateSkipCountPrompt(nextRequest);
  }
  if (operation === "groups") {
    return generateGroupsPrompt(nextRequest);
  }
  if (operation === "multiply") {
    return generateMultiplicationPrompt(nextRequest);
  }
  if (operation === "divide") {
    return generateDivisionPrompt(nextRequest);
  }
  if (operation === "arrays") {
    return generateArrayPrompt(nextRequest);
  }
  if (operation === "fraction") {
    return generateFractionPrompt(nextRequest);
  }
  if (operation === "decimal") {
    return generateDecimalPrompt(nextRequest);
  }
  return generateAdditionPrompt(nextRequest);
}

function generateCountPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const max = settings.gradeLane === "kindergarten" ? Math.min(settings.maxAnswer, 10) : Math.min(settings.maxAnswer, 20);
  const answer = randomInt(random, 1, max);
  return basePrompt({
    id: "count-" + promptIndex + "-" + answer,
    path,
    settings,
    operation: "count",
    inputMode: "choice",
    question: "How many gems?",
    hint: "Count each gem once.",
    audioInstructionId: "how-many-gems",
    answer,
    choices: buildChoices(answer, 1, max, random),
    visualCount: answer
  });
}

function generateAdditionPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const grade2 = settings.gradeLane === "grade2" || settings.gradeLane === "grade3" || settings.gradeLane === "grade4";
  const maxAddend = grade2 ? Math.min(settings.maxAddend, 99) : settings.gradeLane === "kindergarten" ? Math.min(settings.maxAddend, 5) : settings.maxAddend;
  const maxAnswer = grade2 ? Math.min(settings.maxAnswer, 200) : settings.gradeLane === "kindergarten" ? Math.min(settings.maxAnswer, 10) : settings.maxAnswer;
  const [left, right] = grade2 && !settings.allowRegrouping
    ? twoDigitNoRegroupingAddends(random, maxAnswer)
    : boundedAddends(random, maxAddend, maxAnswer);
  const answer = left + right;
  return basePrompt({
    id: "add-" + promptIndex + "-" + left + "-" + right,
    path,
    settings,
    operation: "add",
    inputMode: grade2 ? "keypad" : "choice",
    question: String(left) + " + " + String(right) + " = ?",
    hint: grade2 ? "Add tens, then ones." : "Put the two numbers together.",
    answer,
    choices: buildChoices(answer, 0, maxAnswer, random),
    left,
    right
  });
}

function generateSubtractionPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const grade2 = settings.gradeLane === "grade2" || settings.gradeLane === "grade3" || settings.gradeLane === "grade4";
  const maxAnswer = grade2 ? Math.min(settings.maxAnswer, 200) : settings.gradeLane === "kindergarten" ? Math.min(settings.maxAnswer, 10) : settings.maxAnswer;
  const [left, right] = grade2 && !settings.allowRegrouping
    ? twoDigitNoRegroupingSubtraction(random, maxAnswer)
    : boundedSubtraction(random, maxAnswer);
  const answer = left - right;
  return basePrompt({
    id: "subtract-" + promptIndex + "-" + left + "-" + right,
    path,
    settings,
    operation: "subtract",
    inputMode: grade2 ? "keypad" : "choice",
    question: String(left) + " - " + String(right) + " = ?",
    hint: grade2 ? "Subtract ones, then tens." : "Find what is left.",
    answer,
    choices: buildChoices(answer, 0, maxAnswer, random),
    left,
    right
  });
}

function generatePlaceValuePrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const tens = randomInt(random, 2, 9);
  const ones = randomInt(random, 0, 9);
  const answer = tens * 10 + ones;
  const question = random.next() > 0.5
    ? String(tens) + " tens and " + String(ones) + " ones = ?"
    : String(tens * 10) + " + " + String(ones) + " = ?";
  return basePrompt({
    id: "place-value-" + promptIndex + "-" + answer,
    path,
    settings,
    operation: "placeValue",
    inputMode: "choice",
    question,
    hint: "Tens make groups of ten. Ones are extra.",
    answer,
    choices: buildChoices(answer, 10, 99, random),
    tens,
    ones
  });
}

function generateSkipCountPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const step = [2, 5, 10][randomInt(random, 0, 2)];
  const start = step * randomInt(random, 1, 8);
  const missingPosition = randomInt(random, 1, 3);
  const values = [start, start + step, start + step * 2, start + step * 3];
  const answer = values[missingPosition];
  values[missingPosition] = -1;
  const question = values.map((value) => value < 0 ? "?" : String(value)).join(", ");
  return basePrompt({
    id: "skip-count-" + promptIndex + "-" + step + "-" + answer,
    path,
    settings,
    operation: "skipCount",
    inputMode: "choice",
    question,
    hint: "The jump stays the same each time.",
    answer,
    choices: buildChoices(answer, step, start + step * 5, random),
    step
  });
}

function generateGroupsPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const groups = randomInt(random, 2, 5);
  const size = randomInt(random, 2, 6);
  const answer = groups * size;
  return basePrompt({
    id: "groups-" + promptIndex + "-" + groups + "-" + size,
    path,
    settings,
    operation: "groups",
    inputMode: "choice",
    question: String(groups) + " groups of " + String(size) + " = ?",
    hint: "Count the same-size groups.",
    answer,
    choices: buildChoices(answer, 2, 30, random),
    left: groups,
    right: size,
    visualGroups: Array.from({ length: groups }, () => size)
  });
}

function generateMultiplicationPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const left = randomInt(random, 1, 12);
  const right = randomInt(random, 1, 12);
  const answer = left * right;
  return basePrompt({
    id: "multiply-" + promptIndex + "-" + left + "-" + right,
    path,
    settings,
    operation: "multiply",
    inputMode: "keypad",
    question: String(left) + " x " + String(right) + " = ?",
    hint: "Think equal groups or skip counting.",
    answer,
    choices: buildChoices(answer, 1, 144, random),
    left,
    right
  });
}

function generateDivisionPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const right = randomInt(random, 2, 12);
  const answer = randomInt(random, 1, 12);
  const left = right * answer;
  const missingFactor = random.next() > 0.5;
  return basePrompt({
    id: "divide-" + promptIndex + "-" + left + "-" + right,
    path,
    settings,
    operation: "divide",
    inputMode: "keypad",
    question: missingFactor
      ? String(right) + " x ? = " + String(left)
      : String(left) + " / " + String(right) + " = ?",
    hint: "Use the multiplication fact family.",
    answer,
    choices: buildChoices(answer, 1, 12, random),
    left,
    right
  });
}

function generateArrayPrompt({ path, settings, promptIndex, random }: PromptRequest): MathPrompt {
  const rows = randomInt(random, 2, 6);
  const columns = randomInt(random, 2, 6);
  const answer = rows * columns;
  return basePrompt({
    id: "arrays-" + promptIndex + "-" + rows + "-" + columns,
    path,
    settings,
    operation: "arrays",
    inputMode: "choice",
    question: String(rows) + " rows of " + String(columns) + " = ?",
    hint: "Rows times columns gives the total.",
    answer,
    choices: buildChoices(answer, 4, 36, random),
    left: rows,
    right: columns,
    visualArray: { rows, columns }
  });
}

function generateFractionPrompt({ path, settings, random }: PromptRequest): MathPrompt {
  const mode = pickMode(settings.fractionModes, random, allFractionModes);
  if (mode === "match") {
    return generateFractionMatchPrompt(path, settings, random);
  }
  if (mode === "compare") {
    return generateFractionComparePrompt(path, settings, random);
  }
  if (mode === "equivalent") {
    return generateFractionEquivalentPrompt(path, settings, random);
  }
  if (mode === "addSubtract") {
    return generateFractionOperationPrompt(path, settings, random);
  }
  return generateFractionNamePrompt(path, settings, random);
}

function generateFractionNamePrompt(path: PathId, settings: MathSettings, random: RandomSource): MathPrompt {
  const denominator = randomChoice([2, 3, 4, 5, 6, 8, 10], random);
  const numerator = randomInt(random, 1, denominator - 1);
  return basePrompt({
    id: "fraction-name-" + numerator + "-" + denominator,
    path,
    settings,
    operation: "fraction",
    inputMode: "choice",
    question: "How many colored parts?",
    hint: "The colored parts are the top number. All equal parts make the bottom number.",
    audioInstructionId: "how-many-colored-parts",
    answer: numerator,
    choices: buildChoices(numerator, 1, denominator, random),
    left: numerator,
    right: denominator,
    denominator,
    mode: "name",
    visualPart: part("fraction", numerator, denominator, fractionLabel(numerator, denominator))
  });
}

function generateFractionMatchPrompt(path: PathId, settings: MathSettings, random: RandomSource): MathPrompt {
  const denominator = randomChoice([2, 3, 4, 5, 6, 8, 10], random);
  const numerator = randomInt(random, 1, denominator - 1);
  const answer = fractionLabel(numerator, denominator);
  const choices = buildFractionChoices(numerator, denominator, random);
  return basePrompt({
    id: "fraction-match-" + numerator + "-" + denominator,
    path,
    settings,
    operation: "fraction",
    inputMode: "choice",
    question: "Which fraction matches the colored parts?",
    hint: "The top number counts colored parts. The bottom number counts all equal parts.",
    audioInstructionId: "which-fraction-matches",
    answer,
    choices,
    left: numerator,
    right: denominator,
    denominator,
    mode: "match",
    visualPart: part("fraction", numerator, denominator, answer)
  });
}

function generateFractionComparePrompt(path: PathId, settings: MathSettings, random: RandomSource): MathPrompt {
  const denominator = randomChoice([3, 4, 5, 6, 8, 10], random);
  const left = randomInt(random, 1, denominator - 1);
  let right = randomInt(random, 1, denominator - 1);
  if (right === left) {
    right = right === denominator - 1 ? right - 1 : right + 1;
  }
  const answer = left > right ? "left" : "right";
  return basePrompt({
    id: "fraction-compare-" + denominator + "-" + left + "-" + right,
    path,
    settings,
    operation: "fraction",
    inputMode: "choice",
    question: "Which fraction is more?",
    hint: "The bottom numbers match, so compare the colored parts.",
    audioInstructionId: "which-fraction-is-more",
    answer,
    choices: ["left", "right"],
    left,
    right,
    denominator,
    mode: "compare",
    visualCompare: {
      left: part("fraction", left, denominator, fractionLabel(left, denominator)),
      right: part("fraction", right, denominator, fractionLabel(right, denominator))
    }
  });
}

function generateFractionEquivalentPrompt(path: PathId, settings: MathSettings, random: RandomSource): MathPrompt {
  const pair = randomChoice(equivalentFractionPairs, random);
  const same = random.next() > 0.35;
  const right = same ? pair[1] : makeDifferentFraction(pair[1], random);
  return basePrompt({
    id: "fraction-equivalent-" + pair[0].colored + "-" + pair[0].total + "-" + right.colored + "-" + right.total,
    path,
    settings,
    operation: "fraction",
    inputMode: "choice",
    question: "Do these show the same amount?",
    hint: "Look at the length of the colored amount, not just the number of pieces.",
    audioInstructionId: "same-amount",
    answer: same ? "same" : "different",
    choices: ["same", "different"],
    mode: "equivalent",
    visualEquivalent: {
      models: [
        part("fraction", pair[0].colored, pair[0].total, fractionLabel(pair[0].colored, pair[0].total)),
        part("fraction", right.colored, right.total, fractionLabel(right.colored, right.total))
      ]
    }
  });
}

function generateFractionOperationPrompt(path: PathId, settings: MathSettings, random: RandomSource): MathPrompt {
  const denominator = randomChoice([3, 4, 5, 6, 8, 10], random);
  const subtract = random.next() > 0.5;
  const left = randomInt(random, 1, denominator - 1);
  const right = subtract ? randomInt(random, 1, left) : randomInt(random, 1, denominator - left);
  const answerNumerator = subtract ? left - right : left + right;
  const answer = fractionLabel(answerNumerator, denominator);
  return basePrompt({
    id: "fraction-op-" + denominator + "-" + left + (subtract ? "-minus-" : "-plus-") + right,
    path,
    settings,
    operation: "fraction",
    inputMode: "choice",
    question: fractionLabel(left, denominator) + " " + (subtract ? "-" : "+") + " " + fractionLabel(right, denominator) + " = ?",
    hint: "The bottom number stays the same. Combine or remove the colored parts.",
    answer,
    choices: buildFractionChoices(answerNumerator, denominator, random),
    left,
    right,
    denominator,
    mode: "addSubtract",
    visualOperation: {
      left: part("fraction", left, denominator, fractionLabel(left, denominator)),
      right: part("fraction", right, denominator, fractionLabel(right, denominator)),
      result: part("fraction", answerNumerator, denominator, answer),
      operator: subtract ? "-" : "+"
    }
  });
}

function generateDecimalPrompt({ path, settings, random }: PromptRequest): MathPrompt {
  const mode = pickMode(settings.decimalModes, random, allDecimalModes);
  const total = settings.decimalPlace === "hundredths" ? 100 : 10;
  if (mode === "match") {
    return generateDecimalMatchPrompt(path, settings, random, total);
  }
  if (mode === "compare") {
    return generateDecimalComparePrompt(path, settings, random, total);
  }
  if (mode === "equivalent") {
    return generateDecimalEquivalentPrompt(path, settings, random);
  }
  if (mode === "addSubtract") {
    return generateDecimalOperationPrompt(path, settings, random, total);
  }
  return generateDecimalNamePrompt(path, settings, random, total);
}

function generateDecimalNamePrompt(path: PathId, settings: MathSettings, random: RandomSource, total: number): MathPrompt {
  const colored = randomInt(random, 1, total - 1);
  const unit = total === 100 ? "hundredths" : "tenths";
  return basePrompt({
    id: "decimal-name-" + total + "-" + colored,
    path,
    settings,
    operation: "decimal",
    inputMode: "choice",
    question: "How many colored " + unit + "?",
    hint: total === 100 ? "Hundredths split one whole into 100 equal parts." : "Tenths split one whole into 10 equal parts.",
    audioInstructionId: total === 100 ? "how-many-colored-hundredths" : "how-many-colored-tenths",
    answer: colored,
    choices: buildChoices(colored, 1, total === 100 ? 99 : 9, random),
    left: colored,
    right: total,
    mode: "name",
    decimalPlace: settings.decimalPlace,
    visualPart: part("decimal", colored, total, decimalLabel(colored, total))
  });
}

function generateDecimalMatchPrompt(path: PathId, settings: MathSettings, random: RandomSource, total: number): MathPrompt {
  const colored = randomInt(random, 1, total - 1);
  const answer = decimalLabel(colored, total);
  return basePrompt({
    id: "decimal-match-" + total + "-" + colored,
    path,
    settings,
    operation: "decimal",
    inputMode: "choice",
    question: "Which decimal matches the colored parts?",
    hint: total === 100 ? "Hundredths use two digits after the decimal point." : "Tenths use the first digit after the decimal point.",
    audioInstructionId: "which-decimal-matches",
    answer,
    choices: buildDecimalChoices(colored, total, random),
    left: colored,
    right: total,
    mode: "match",
    decimalPlace: settings.decimalPlace,
    visualPart: part("decimal", colored, total, answer)
  });
}

function generateDecimalComparePrompt(path: PathId, settings: MathSettings, random: RandomSource, total: number): MathPrompt {
  const left = randomInt(random, 1, total - 1);
  let right = randomInt(random, 1, total - 1);
  if (right === left) {
    right = right === total - 1 ? right - 1 : right + 1;
  }
  return basePrompt({
    id: "decimal-compare-" + total + "-" + left + "-" + right,
    path,
    settings,
    operation: "decimal",
    inputMode: "choice",
    question: "Which decimal is more?",
    hint: "Compare how much of the whole is colored.",
    audioInstructionId: "which-decimal-is-more",
    answer: left > right ? "left" : "right",
    choices: ["left", "right"],
    left,
    right,
    mode: "compare",
    decimalPlace: settings.decimalPlace,
    visualCompare: {
      left: part("decimal", left, total, decimalLabel(left, total)),
      right: part("decimal", right, total, decimalLabel(right, total))
    }
  });
}

function generateDecimalEquivalentPrompt(path: PathId, settings: MathSettings, random: RandomSource): MathPrompt {
  const tenths = randomInt(random, 1, 9);
  const same = random.next() > 0.35;
  const hundredths = same ? tenths * 10 : clampInteger(tenths * 10 + randomChoice([-20, -10, 10, 20], random), 50, 1, 99);
  return basePrompt({
    id: "decimal-equivalent-" + tenths + "-" + hundredths,
    path,
    settings,
    operation: "decimal",
    inputMode: "choice",
    question: "Do these show the same amount?",
    hint: "0." + String(tenths) + " is the same as 0." + String(tenths) + "0 because 1 tenth equals 10 hundredths.",
    audioInstructionId: "same-amount",
    answer: same ? "same" : "different",
    choices: ["same", "different"],
    mode: "equivalent",
    decimalPlace: settings.decimalPlace,
    visualEquivalent: {
      models: [
        part("decimal", tenths, 10, decimalLabel(tenths, 10)),
        part("decimal", hundredths, 100, decimalLabel(hundredths, 100))
      ]
    }
  });
}

function generateDecimalOperationPrompt(path: PathId, settings: MathSettings, random: RandomSource, total: number): MathPrompt {
  const subtract = random.next() > 0.5;
  const max = total === 100 ? 90 : 9;
  const left = randomInt(random, 1, subtract ? max : max - 1);
  const right = subtract ? randomInt(random, 1, left) : randomInt(random, 1, max - left);
  const answerParts = subtract ? left - right : left + right;
  const answer = decimalLabel(answerParts, total);
  return basePrompt({
    id: "decimal-op-" + total + "-" + left + (subtract ? "-minus-" : "-plus-") + right,
    path,
    settings,
    operation: "decimal",
    inputMode: "choice",
    question: decimalLabel(left, total) + " " + (subtract ? "-" : "+") + " " + decimalLabel(right, total) + " = ?",
    hint: total === 100 ? "Add or subtract hundredths, then write two decimal places." : "Add or subtract tenths, then write one decimal place.",
    answer,
    choices: buildDecimalChoices(answerParts, total, random),
    left,
    right,
    mode: "addSubtract",
    decimalPlace: settings.decimalPlace,
    visualOperation: {
      left: part("decimal", left, total, decimalLabel(left, total)),
      right: part("decimal", right, total, decimalLabel(right, total)),
      result: part("decimal", answerParts, total, answer),
      operator: subtract ? "-" : "+"
    }
  });
}

function basePrompt(args: {
  id: string;
  path: PathId;
  settings: MathSettings;
  operation: Operation;
  inputMode: InputMode;
  question: string;
  hint: string;
  audioInstructionId?: string;
  answer: AnswerValue;
  choices: AnswerValue[];
  visualCount?: number;
  visualGroups?: number[];
  visualArray?: { rows: number; columns: number };
  visualFraction?: { colored: number; total: number };
  visualPart?: PartModel;
  visualCompare?: { left: PartModel; right: PartModel };
  visualEquivalent?: { models: [PartModel, PartModel] };
  visualOperation?: { left: PartModel; right: PartModel; result: PartModel; operator: "+" | "-" };
  left?: number;
  right?: number;
  tens?: number;
  ones?: number;
  step?: number;
  denominator?: number;
  mode?: FractionMode | DecimalMode;
  decimalPlace?: DecimalPlace;
}): MathPrompt {
  return {
    id: args.id,
    path: args.path,
    gradeLane: args.settings.gradeLane,
    operation: args.operation,
    inputMode: args.inputMode,
    question: args.question,
    audioInstructionId: args.audioInstructionId,
    hint: args.hint,
    visualCount: args.visualCount,
    visualGroups: args.visualGroups,
    visualArray: args.visualArray,
    visualFraction: args.visualFraction,
    visualPart: args.visualPart,
    visualCompare: args.visualCompare,
    visualEquivalent: args.visualEquivalent,
    visualOperation: args.visualOperation,
    acceptedAnswers: [args.answer],
    choices: args.choices,
    metadata: {
      left: args.left,
      right: args.right,
      answer: args.answer,
      helped: false,
      tens: args.tens,
      ones: args.ones,
      step: args.step,
      denominator: args.denominator,
      mode: args.mode,
      decimalPlace: args.decimalPlace
    }
  };
}

function resolveOperation(path: PathId, settings: MathSettings, random: RandomSource): Operation {
  const direct = operationForPath(path);
  if (direct) {
    return direct;
  }
  const operations = operationsForGrade(settings);
  return operations[randomInt(random, 0, operations.length - 1)] ?? defaultOperationsForGrades(settings.gradeLanes)[0] ?? "add";
}

function operationsForGrade(settings: MathSettings): Operation[] {
  const allowed = allowedOperationsForGrades(settings.gradeLanes, settings.enableFractions, settings.enableDecimals);
  return uniqueOperations(settings.enabledOperations).filter((operation) => allowed.includes(operation));
}

function normalizeGrade(value: unknown): GradeLane {
  return value === "kindergarten" || value === "grade2" || value === "grade3" || value === "grade4" ? value : "grade1";
}

function normalizeGradeLanes(value: unknown, legacyGradeLane: unknown): GradeLane[] {
  const selected = Array.isArray(value)
    ? [...new Set(value.map(normalizeGrade))]
    : [normalizeGrade(legacyGradeLane)];
  return selected.length > 0 ? selected.sort(compareGradeLanes) : ["grade1"];
}

function primaryGradeLane(gradeLanes: GradeLane[]): GradeLane {
  const sorted = [...gradeLanes].sort(compareGradeLanes);
  return sorted[sorted.length - 1] ?? "grade1";
}

function compareGradeLanes(left: GradeLane, right: GradeLane): number {
  return gradeOrder(left) - gradeOrder(right);
}

function gradeOrder(gradeLane: GradeLane): number {
  return ["kindergarten", "grade1", "grade2", "grade3", "grade4"].indexOf(gradeLane);
}

function allowedOperationsForGrades(gradeLanes: GradeLane[], enableFractions: boolean, enableDecimals: boolean): Operation[] {
  return uniqueOperations(gradeLanes.flatMap((gradeLane) => allowedOperationsForGrade(gradeLane, enableFractions, enableDecimals)));
}

function allowedOperationsForGrade(gradeLane: GradeLane, enableFractions: boolean, enableDecimals: boolean): Operation[] {
  if (gradeLane === "kindergarten") {
    return ["count", "add", "subtract"];
  }
  if (gradeLane === "grade1") {
    return ["add", "subtract"];
  }
  if (gradeLane === "grade2") {
    return ["add", "subtract", "placeValue", "skipCount", "groups"];
  }
  if (gradeLane === "grade3") {
    return ["multiply", "divide", "arrays"];
  }
  const operations: Operation[] = [];
  if (enableFractions) {
    operations.push("fraction");
  }
  if (enableDecimals) {
    operations.push("decimal");
  }
  return operations;
}

function defaultOperationsForGrades(gradeLanes: GradeLane[]): Operation[] {
  return uniqueOperations(gradeLanes.flatMap(defaultOperationsForGrade));
}

function defaultOperationsForGrade(gradeLane: GradeLane): Operation[] {
  if (gradeLane === "kindergarten") {
    return ["count", "add", "subtract"];
  }
  if (gradeLane === "grade1") {
    return ["add", "subtract"];
  }
  if (gradeLane === "grade2") {
    return ["add", "subtract", "placeValue", "skipCount", "groups"];
  }
  if (gradeLane === "grade3") {
    return ["multiply", "divide", "arrays"];
  }
  return ["fraction", "decimal"];
}

function gradeLaneForOperation(operation: Operation, settings: MathSettings): GradeLane {
  const selected = settings.gradeLanes.length > 0 ? settings.gradeLanes : [settings.gradeLane];
  const candidates = selected.filter((gradeLane) => allowedOperationsForGrade(gradeLane, settings.enableFractions, settings.enableDecimals).includes(operation));
  return primaryGradeLane(candidates.length > 0 ? candidates : selected);
}

function fallbackPaths(gradeLane: GradeLane): PathId[] {
  if (gradeLane === "kindergarten") {
    return ["count"];
  }
  if (gradeLane === "grade3") {
    return ["times"];
  }
  if (gradeLane === "grade4") {
    return ["fractions", "decimals"];
  }
  return ["add"];
}

function operationForPath(path: PathId): Operation | null {
  if (path === "placeValue") {
    return "placeValue";
  }
  if (path === "skipCount") {
    return "skipCount";
  }
  if (path === "times") {
    return "multiply";
  }
  if (path === "fractions") {
    return "fraction";
  }
  if (path === "decimals") {
    return "decimal";
  }
  if (path === "mix") {
    return null;
  }
  return path;
}

function pathForOperation(operation: Operation): PathId | null {
  if (operation === "placeValue") {
    return "placeValue";
  }
  if (operation === "skipCount") {
    return "skipCount";
  }
  if (operation === "multiply") {
    return "times";
  }
  if (operation === "fraction") {
    return "fractions";
  }
  if (operation === "decimal") {
    return "decimals";
  }
  return operation;
}

function uniqueOperations(values: readonly Operation[]): Operation[] {
  const allowed: Operation[] = ["count", "add", "subtract", "placeValue", "skipCount", "groups", "multiply", "divide", "arrays", "fraction", "decimal"];
  return [...new Set(values.filter((value): value is Operation => allowed.includes(value)))];
}

const allFractionModes: FractionMode[] = ["name", "match", "compare", "equivalent", "addSubtract"];
const allDecimalModes: DecimalMode[] = ["name", "match", "compare", "equivalent", "addSubtract"];

const equivalentFractionPairs: Array<[PartModel, PartModel]> = [
  [part("fraction", 1, 2), part("fraction", 2, 4)],
  [part("fraction", 1, 2), part("fraction", 3, 6)],
  [part("fraction", 1, 2), part("fraction", 4, 8)],
  [part("fraction", 1, 3), part("fraction", 2, 6)],
  [part("fraction", 2, 3), part("fraction", 4, 6)],
  [part("fraction", 1, 5), part("fraction", 2, 10)]
];

function normalizeModes<T extends string>(value: unknown, fallback: T[], allowed: T[]): T[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const selected = [...new Set(value.filter((item): item is T => allowed.includes(item as T)))];
  return selected.length > 0 ? selected : fallback;
}

function pickMode<T extends string>(modes: T[], random: RandomSource, fallback: T[]): T {
  const active = modes.length > 0 ? modes : fallback;
  return active[randomInt(random, 0, active.length - 1)];
}

function defaultMaxAddend(gradeLane: GradeLane): number {
  if (gradeLane === "kindergarten") {
    return 5;
  }
  if (gradeLane === "grade1") {
    return 10;
  }
  return 99;
}

function defaultMaxAnswer(gradeLane: GradeLane): number {
  if (gradeLane === "kindergarten") {
    return 10;
  }
  if (gradeLane === "grade1") {
    return 20;
  }
  return 100;
}

function minimumMaxAnswerFor(gradeLanes: GradeLane[], enabledOperations: Operation[]): number {
  const needsTwoDigitAddSubtract = gradeLanes.includes("grade2")
    && enabledOperations.some((operation) => operation === "add" || operation === "subtract");
  return needsTwoDigitAddSubtract ? 20 : 5;
}

function boundedAddends(random: RandomSource, maxAddend: number, maxAnswer: number): [number, number] {
  const left = randomInt(random, 0, maxAddend);
  const right = randomInt(random, 0, Math.min(maxAddend, Math.max(0, maxAnswer - left)));
  return [left, right];
}

function boundedSubtraction(random: RandomSource, maxAnswer: number): [number, number] {
  const left = randomInt(random, 1, maxAnswer);
  const right = randomInt(random, 0, left);
  return [left, right];
}

function twoDigitNoRegroupingAddends(random: RandomSource, maxAnswer: number): [number, number] {
  const cappedMaxAnswer = Math.max(20, Math.min(maxAnswer, 99));
  const tensTotal = randomInt(random, 2, Math.max(2, Math.min(9, Math.floor(cappedMaxAnswer / 10))));
  const leftTens = randomInt(random, 1, tensTotal - 1);
  const rightTens = tensTotal - leftTens;
  const maxOnesTotal = Math.min(9, cappedMaxAnswer - tensTotal * 10);
  const onesTotal = randomInt(random, 0, maxOnesTotal);
  const leftOnes = randomInt(random, 0, onesTotal);
  const rightOnes = onesTotal - leftOnes;
  return [leftTens * 10 + leftOnes, rightTens * 10 + rightOnes];
}

function twoDigitNoRegroupingSubtraction(random: RandomSource, maxAnswer: number): [number, number] {
  const left = randomInt(random, 20, Math.min(maxAnswer, 99));
  const leftTens = Math.floor(left / 10);
  const leftOnes = left % 10;
  const rightTens = randomInt(random, 0, Math.max(0, leftTens - 1));
  const rightOnes = randomInt(random, 0, leftOnes);
  return [left, rightTens * 10 + rightOnes];
}

function buildFractionChoices(numerator: number, denominator: number, random: RandomSource): string[] {
  const choices = new Set<string>([fractionLabel(numerator, denominator)]);
  for (const candidate of [
    fractionLabel(Math.min(denominator, numerator + 1), denominator),
    fractionLabel(Math.max(1, numerator - 1), denominator),
    fractionLabel(numerator, Math.max(2, denominator - 1)),
    fractionLabel(numerator, denominator + 1)
  ]) {
    choices.add(candidate);
    if (choices.size >= 4) {
      break;
    }
  }
  while (choices.size < 4) {
    const nextDenominator = randomChoice([2, 3, 4, 5, 6, 8, 10], random);
    choices.add(fractionLabel(randomInt(random, 1, nextDenominator - 1), nextDenominator));
  }
  return shuffle([...choices], random);
}

function buildDecimalChoices(colored: number, total: number, random: RandomSource): string[] {
  const choices = new Set<string>([decimalLabel(colored, total)]);
  const nearby = [colored + 1, colored - 1, colored + (total === 100 ? 10 : 2), colored - (total === 100 ? 10 : 2)];
  for (const value of nearby) {
    if (value >= 0 && value < total) {
      choices.add(decimalLabel(value, total));
    }
    if (choices.size >= 4) {
      break;
    }
  }
  while (choices.size < 4) {
    choices.add(decimalLabel(randomInt(random, 0, total - 1), total));
  }
  return shuffle([...choices], random);
}

function makeDifferentFraction(model: PartModel, random: RandomSource): PartModel {
  const shift = random.next() > 0.5 ? 1 : -1;
  const colored = Math.min(model.total - 1, Math.max(1, model.colored + shift));
  return part("fraction", colored, model.total);
}

function part(kind: PartModelKind, colored: number, total: number, label?: string): PartModel {
  return { kind, colored, total, label };
}

function fractionLabel(numerator: number, denominator: number): string {
  return String(numerator) + "/" + String(denominator);
}

function decimalLabel(colored: number, total: number): string {
  if (total === 100) {
    return (colored / 100).toFixed(2);
  }
  return (colored / 10).toFixed(1);
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function randomInt(random: RandomSource, min: number, max: number): number {
  return Math.floor(random.next() * (max - min + 1)) + min;
}

function randomChoice<T>(values: T[], random: RandomSource): T {
  return values[randomInt(random, 0, values.length - 1)];
}

function shuffle<T>(values: T[], random: RandomSource): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    const current = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = current;
  }
  return values;
}
