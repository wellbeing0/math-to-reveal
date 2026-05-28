import {
  createSeededRandom,
  generatePrompt,
  validateAnswer,
  type AnswerValue,
  type MathPrompt,
  type MathSettings,
  type PathId
} from "./mathEngine";
import { pathProgressKeyFor, type MathSave, type PathProgress } from "./save";

export interface SessionState {
  path: PathId;
  promptIndex: number;
  seed: number;
  currentPrompt: MathPrompt;
  correct: number;
  mistakes: number;
  streak: number;
  promptAttempts: number;
  helpUsed: boolean;
  keypadValue: string;
  answeredPromptIds: string[];
}

export interface SessionStartRequest {
  path: PathId;
  settings: MathSettings;
  savedProgress: PathProgress | null;
  seed: number;
}

export interface CorrectAnswerResult {
  kind: "correct";
  session: SessionState;
  revealedPieces: number;
  completedPrompts: number;
  bestStreak: number;
  lastRewardPiece: number;
  feedback: string;
  completedSession: boolean;
  completionQuality: CompletionQuality;
  helpAvailable: boolean;
  helpUsed: boolean;
  supportNudge: string;
  supportContext: SupportContext;
}

export interface IncorrectAnswerResult {
  kind: "incorrect";
  session: SessionState;
  selectedWrong: AnswerValue;
  feedback: string;
  attempts: number;
  helpAvailable: boolean;
  helpUsed: boolean;
  supportNudge: string;
  supportContext: SupportContext;
}

export type AnswerResult = CorrectAnswerResult | IncorrectAnswerResult;
export type CompletionQuality = "clean" | "helped";

export interface SupportContext {
  gradeLane: MathPrompt["gradeLane"];
  operation: MathPrompt["operation"];
  path: MathPrompt["path"];
  promptFamily: string;
  conceptKey: string;
  skillTag: string;
}

export function createSessionState({ path, settings, savedProgress, seed }: SessionStartRequest): SessionState {
  const promptIndex = Math.min(savedProgress?.promptIndex ?? 0, Math.max(0, settings.sessionLength - 1));
  const answeredPromptIds = savedProgress?.answeredPromptIds ?? [];
  const firstPrompt = generatePrompt({
    path,
    settings,
    promptIndex,
    random: createSeededRandom(seed + promptIndex * 97),
    recentPromptIds: answeredPromptIds
  });

  return {
    path,
    promptIndex,
    seed,
    currentPrompt: firstPrompt,
    correct: Math.min(savedProgress?.correct ?? 0, settings.sessionLength),
    mistakes: savedProgress?.mistakes ?? 0,
    streak: savedProgress?.streak ?? 0,
    promptAttempts: 0,
    helpUsed: false,
    keypadValue: "",
    answeredPromptIds
  };
}

export function evaluateAnswer(args: {
  session: SessionState;
  answer: AnswerValue;
  settings: MathSettings;
  completedPrompts: number;
  revealedPieces: number;
  bestStreak: number;
  revealPieces: number;
  correctFeedback: readonly string[];
  nudgeFeedback: readonly string[];
}): AnswerResult {
  const { session, answer, settings } = args;
  const supportContext = supportContextForPrompt(session.currentPrompt);
  const supportNudge = supportNudgeForPrompt(session.currentPrompt);
  const helpAvailable = supportNudge.length > 0;
  if (!validateAnswer(session.currentPrompt, answer)) {
    const attempts = session.promptAttempts + 1;
    const mistakes = session.mistakes + 1;
    return {
      kind: "incorrect",
      selectedWrong: answer,
      attempts,
      feedback: feedbackForAttempt(attempts, session.currentPrompt.hint, supportNudge, args.nudgeFeedback),
      helpAvailable,
      helpUsed: session.helpUsed,
      supportNudge,
      supportContext,
      session: {
        ...session,
        keypadValue: "",
        mistakes,
        streak: 0,
        promptAttempts: attempts
      }
    };
  }

  const completionQuality: CompletionQuality = session.promptAttempts > settings.attemptsToReward ? "helped" : "clean";
  const cleanCompletion = completionQuality === "clean";
  const completedPrompts = cleanCompletion ? args.completedPrompts + 1 : args.completedPrompts;
  const revealedPieces = cleanCompletion ? args.revealedPieces + 1 : args.revealedPieces;
  const answeredPromptIds = [...session.answeredPromptIds, session.currentPrompt.id];
  const correct = session.correct + 1;
  const streak = cleanCompletion ? session.streak + 1 : 0;
  const completedSession = session.promptIndex + 1 >= settings.sessionLength;
  const baseSession: SessionState = {
    ...session,
    correct,
    streak,
    promptAttempts: 0,
    helpUsed: false,
    keypadValue: "",
    answeredPromptIds
  };
  const nextSession = completedSession ? baseSession : advanceSession(baseSession, settings);

  return {
    kind: "correct",
    session: nextSession,
    revealedPieces,
    completedPrompts,
    bestStreak: cleanCompletion ? Math.max(args.bestStreak, streak) : args.bestStreak,
    lastRewardPiece: cleanCompletion ? (revealedPieces - 1) % args.revealPieces : -1,
    feedback: cleanCompletion
      ? args.correctFeedback[(completedPrompts + streak) % args.correctFeedback.length] || "Nice math."
      : "Let's keep moving. We'll try that kind again later.",
    completedSession,
    completionQuality,
    helpAvailable,
    helpUsed: session.helpUsed,
    supportNudge,
    supportContext
  };
}

export function advanceSession(session: SessionState, settings: MathSettings): SessionState {
  const promptIndex = session.promptIndex + 1;
  return {
    ...session,
    promptIndex,
    promptAttempts: 0,
    helpUsed: false,
    currentPrompt: generatePrompt({
      path: session.path,
      settings,
      promptIndex,
      random: createSeededRandom(session.seed + promptIndex * 97),
      recentPromptIds: session.answeredPromptIds
    })
  };
}

export function markHelpUsed(session: SessionState): SessionState {
  return {
    ...session,
    helpUsed: true
  };
}

export function toPathProgress(current: SessionState, gradeLane: MathSettings["gradeLane"]): PathProgress {
  return {
    path: current.path,
    gradeLane,
    promptIndex: current.promptIndex,
    seed: current.seed,
    correct: current.correct,
    mistakes: current.mistakes,
    streak: current.streak,
    answeredPromptIds: current.answeredPromptIds
  };
}

function feedbackForAttempt(attempts: number, promptHint: string, supportNudge: string, nudgeFeedback: readonly string[]): string {
  if (attempts <= 1) {
    return promptHint || nudgeFeedback[(attempts - 1) % nudgeFeedback.length] || "Try another way.";
  }
  return supportNudge || promptHint || "Let's think it through. Ask for help if you want.";
}

function supportNudgeForPrompt(prompt: MathPrompt): string {
  if (prompt.operation === "placeValue") {
    return "Pause and count the tens first.";
  }
  if (prompt.operation === "skipCount") {
    return "Look at the counting pattern.";
  }
  if (prompt.operation === "groups" || prompt.operation === "arrays" || prompt.operation === "multiply" || prompt.operation === "divide") {
    return "Look at the groups before you choose.";
  }
  if (prompt.operation === "fraction") {
    return "Count the colored parts and the total parts.";
  }
  if (prompt.operation === "decimal") {
    return "Count the colored tenths or hundredths.";
  }
  if (prompt.operation === "add" || prompt.operation === "subtract") {
    return prompt.inputMode === "keypad" ? "Pause and check the ones place." : "Pause and check the numbers.";
  }
  return "Count each item slowly.";
}

function supportContextForPrompt(prompt: MathPrompt): SupportContext {
  return {
    gradeLane: prompt.gradeLane,
    operation: prompt.operation,
    path: prompt.path,
    promptFamily: prompt.metadata.mode ?? prompt.operation,
    conceptKey: [
      prompt.gradeLane,
      prompt.operation,
      prompt.metadata.mode ?? prompt.path,
      prompt.metadata.decimalPlace ?? ""
    ].filter(Boolean).join(":"),
    skillTag: prompt.operation + ":" + prompt.path
  };
}

export function pathProgressKey(path: PathId, settings: MathSettings, gradeLane: MathSettings["gradeLane"]): string {
  return pathProgressKeyFor(path, settings, gradeLane);
}

export function removeSavedPathProgress(progress: MathSave["pathProgress"], current: SessionState, settings: MathSettings): MathSave["pathProgress"] {
  const next = { ...progress };
  delete next[pathProgressKey(current.path, settings, current.currentPrompt.gradeLane)];
  return next;
}

export function bestSavedPathProgress(progress: MathSave["pathProgress"], path: PathId, sessionLength: number): PathProgress | null {
  const candidates = Object.values(progress)
    .filter((item) => item.path === path && item.correct < sessionLength)
    .sort((a, b) => b.correct - a.correct || b.promptIndex - a.promptIndex);
  return candidates[0] ?? null;
}
