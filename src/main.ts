import "./styles.css";
import {
  createSeededRandom,
  eligiblePaths,
  generatePrompt,
  normalizeSettings,
  validateAnswer,
  type AnswerValue,
  type MathPrompt,
  type MathSettings,
  type GradeLane,
  type Operation,
  type PartModel,
  type PathId
} from "./mathEngine";
import { cancelInstructionAudio, playInstructionAudio } from "./instructionAudio";
import { REWARD_MEDIA, type RewardMedia } from "./rewardMedia";
import { DEFAULT_SAVE, canUseStorage, getLastLoadSaveStatus, loadSave, pathProgressKeyFor, saveGame, type MathSave, type PathProgress, type SaveLoadStatus } from "./save";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

const appRoot = app;

const REVEAL_PIECES = 10;
const CORRECT_FEEDBACK = ["Nice math.", "You found it.", "That works.", "Good thinking.", "Path cleared."];
const NUDGE_FEEDBACK = ["Try that one again.", "Look closely and try again.", "Almost. Count it one more time.", "Check the numbers again."];
const GRADE_CHOICES: Array<[GradeLane, string]> = [
  ["kindergarten", "Kindergarten"],
  ["grade1", "First grade"],
  ["grade2", "Second grade"],
  ["grade3", "Third grade"],
  ["grade4", "Fourth grade"]
];

type Screen = "launcher" | "play" | "summary";

interface SessionState {
  path: PathId;
  promptIndex: number;
  seed: number;
  currentPrompt: MathPrompt;
  correct: number;
  mistakes: number;
  streak: number;
  keypadValue: string;
  answeredPromptIds: string[];
}

let persistenceWarning = !canUseStorage(window.localStorage);
let save: MathSave = loadSave(window.localStorage);
let saveLoadStatus: SaveLoadStatus = getLastLoadSaveStatus();
let screen: Screen = "launcher";
let settingsOpen = false;
let feedback = "Pick a path to start.";
let selectedWrong: AnswerValue | null = null;
let session: SessionState | null = null;
let lastRewardPiece = -1;
let celebrating = false;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelInstructionAudio();
  }
});

render();

function render(): void {
  document.body.classList.toggle("settings-open", settingsOpen);
  document.body.classList.toggle("reduced-motion", save.settings.reducedMotion);
  appRoot.innerHTML = "";
  appRoot.append(createShell());
}

function createShell(): HTMLElement {
  const shell = el("main", "app-shell");
  const topbar = el("header", "topbar");
  const title = el("div", "title-block");
  title.append(el("p", "eyebrow", "Early math game"));
  const heading = el("h1", "title-row");
  heading.append(document.createTextNode("Math to Reveal"), el("span", "grade-badge", currentGradeBadge()));
  title.append(heading);
  title.append(el("p", "lede", "Solve one problem at a time and uncover the video."));

  const status = el("section", "status-strip");
  status.append(stat(String(save.completedPrompts), "problems"));
  status.append(stat(String(save.completedSessions), "sessions"));
  status.append(stat(String(save.bestStreak), "best streak"));

  const demoLink = document.createElement("a");
  demoLink.className = "demo-link";
  demoLink.href = "./rewards/math-to-reveal-oss-demo.mp4";
  demoLink.textContent = "Demo video";
  demoLink.setAttribute("aria-label", "Play demo video");

  const settingsButton = buttonEl("Settings", "settings-button");
  settingsButton.setAttribute("aria-label", "Open adult settings");
  settingsButton.addEventListener("click", () => {
    settingsOpen = true;
    render();
  });
  status.append(demoLink);
  status.append(settingsButton);
  topbar.append(title, status);

  const layout = el("div", "game-layout");
  const play = el("section", "play-panel");
  if (screen === "play" && session) {
    play.append(createPlayView(session));
  } else if (screen === "summary" && session) {
    play.append(createSummaryView(session));
  } else {
    play.append(createLauncher());
  }

  layout.append(play, createRewardPanel());
  shell.append(topbar);
  if (persistenceWarning) {
    shell.append(el("p", "storage-warning", "Progress is available for this visit, but this browser is not allowing saved progress."));
  } else if (saveLoadStatus === "corrupt-recovered") {
    shell.append(el("p", "storage-warning", "Saved progress could not be read, so it was preserved as a broken backup and a fresh save was started."));
  }
  shell.append(layout);
  if (settingsOpen) {
    shell.append(createSettingsSheet());
  }
  return shell;
}

function createLauncher(): HTMLElement {
  const wrapper = el("article", "launcher-card");
  wrapper.append(el("h2", "", "Choose a path"));
  wrapper.append(createChildPracticeChoices());
  wrapper.append(el("p", "small-copy", gradeLaneCopy(save.settings)));

  const grid = el("div", "path-grid");
  for (const path of eligiblePaths(save.settings)) {
    const card = buttonEl("", "path-card");
    card.addEventListener("click", () => startSession(path));
    card.append(el("span", "path-icon", pathIcon(path)));
    card.append(el("strong", "", pathLabel(path)));
    card.append(el("span", "", pathCue(path)));
    grid.append(card);
  }
  wrapper.append(grid);
  return wrapper;
}

function createPlayView(current: SessionState): HTMLElement {
  const prompt = current.currentPrompt;
  const wrapper = el("article", "practice-card");
  const progress = el("div", "session-progress");
  progress.append(el("span", "", "Solved " + String(current.correct) + " of " + String(save.settings.sessionLength)));
  const bar = el("div", "progress-bar");
  bar.append(el("span", ""));
  bar.style.setProperty("--progress", String(current.correct / save.settings.sessionLength));
  const choosePath = buttonEl("Choose path", "secondary-action choose-path-action");
  choosePath.addEventListener("click", returnToLauncher);
  progress.append(bar);
  progress.append(choosePath);

  const promptPanel = el("section", "prompt-panel");
  promptPanel.append(el("p", "path-label", pathLabel(current.path)));
  const questionRow = el("div", "question-row");
  questionRow.append(el("div", "question", prompt.question));
  const repeatInstruction = buttonEl("▶", "instruction-audio-button");
  repeatInstruction.setAttribute("aria-label", "Repeat instruction");
  repeatInstruction.title = "Repeat instruction";
  repeatInstruction.addEventListener("click", () => {
    void playInstructionAudio(prompt.question, prompt.audioInstructionId);
  });
  questionRow.append(repeatInstruction);
  promptPanel.append(questionRow);
  if (prompt.visualCount) {
    promptPanel.append(createGemGrid(prompt.visualCount));
  }
  if (prompt.visualGroups) {
    promptPanel.append(createGroupGrid(prompt.visualGroups));
  }
  if (prompt.visualArray) {
    promptPanel.append(createArrayGrid(prompt.visualArray.rows, prompt.visualArray.columns));
  }
  if (prompt.visualFraction) {
    promptPanel.append(createFractionVisual(prompt.visualFraction.colored, prompt.visualFraction.total));
  }
  if (prompt.visualPart) {
    promptPanel.append(createPartVisual(prompt.visualPart));
  }
  if (prompt.visualCompare) {
    promptPanel.append(createCompareVisual(prompt.visualCompare.left, prompt.visualCompare.right));
  }
  if (prompt.visualEquivalent) {
    promptPanel.append(createEquivalentVisual(prompt.visualEquivalent.models));
  }
  if (prompt.visualOperation) {
    promptPanel.append(createOperationVisual(prompt.visualOperation.left, prompt.visualOperation.right, prompt.visualOperation.result, prompt.visualOperation.operator));
  }

  const answers = prompt.inputMode === "keypad" ? createKeypad(current) : createChoiceGrid(prompt);

  const feedbackPanel = el("section", "feedback-panel");
  feedbackPanel.setAttribute("aria-live", "polite");
  feedbackPanel.setAttribute("aria-atomic", "true");
  feedbackPanel.append(el("p", "", feedback));

  appendConfettiOnce(wrapper);
  wrapper.append(progress, promptPanel, answers, feedbackPanel);
  return wrapper;
}

function createSummaryView(current: SessionState): HTMLElement {
  const wrapper = el("article", "summary-card");
  appendConfettiOnce(wrapper);
  wrapper.append(el("p", "eyebrow", "Session complete"));
  wrapper.append(el("h2", "", "Video pieces revealed"));
  wrapper.append(el("p", "summary-score", String(current.correct) + " correct - " + String(current.mistakes) + " retries"));
  const actions = el("div", "summary-actions");
  const replay = buttonEl("Replay path", "primary-action");
  replay.addEventListener("click", () => startSession(current.path));
  const another = buttonEl("Choose path", "secondary-action");
  another.addEventListener("click", () => {
    screen = "launcher";
    feedback = "Pick a path to start.";
    render();
  });
  const keepGoing = buttonEl("Keep going", "secondary-action");
  keepGoing.addEventListener("click", () => startSession("mix"));
  actions.append(replay, another, keepGoing);
  wrapper.append(actions);
  return wrapper;
}

function createRewardPanel(): HTMLElement {
  const reward = getActiveReward(save.revealedPieces);
  const panel = el("aside", "reward-panel");
  panel.append(el("p", "eyebrow", "Reveal reward"));
  panel.append(el("h2", "", reward.media.title));
  const board = el("div", lastRewardPiece >= 0 ? "reveal-board just-revealed" : "reveal-board");
  board.setAttribute("aria-label", String(reward.visiblePieces) + " of " + String(REVEAL_PIECES) + " video pieces revealed");
  board.append(createRewardMedia(reward.media, reward.visiblePieces === REVEAL_PIECES));
  for (let index = 0; index < REVEAL_PIECES; index += 1) {
    const cover = el("span", "cover-piece");
    cover.classList.toggle("is-hidden", index < reward.visiblePieces);
    cover.classList.toggle("is-new", index === lastRewardPiece);
    board.append(cover);
  }
  const remaining = Math.max(0, REVEAL_PIECES - reward.visiblePieces);
  panel.append(board);
  panel.append(createRewardAttribution(reward.media));
  panel.append(el("p", "reward-note", remaining === 0 ? "Video complete. Keep playing to reveal the next one." : String(remaining) + " pieces left."));
  return panel;
}

function createRewardAttribution(media: RewardMedia): HTMLElement {
  const attribution = el("p", "reward-attribution");
  attribution.append(document.createTextNode("Video by " + media.artist + " - " + media.license));
  return attribution;
}

function createRewardMedia(media: RewardMedia, fullyRevealed: boolean): HTMLElement {
  if (media.type === "video") {
    const video = document.createElement("video");
    video.className = "reward-media";
    video.src = media.src;
    if (media.poster) {
      video.poster = media.poster;
    }
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = fullyRevealed;
    video.preload = fullyRevealed ? "auto" : "metadata";
    video.setAttribute("aria-label", media.title);
    return video;
  }

  const image = document.createElement("img");
  image.className = "reward-media";
  image.src = media.src;
  image.alt = media.title;
  return image;
}

function getActiveReward(totalRevealedPieces: number): { media: RewardMedia; visiblePieces: number } {
  const safePieces = Math.max(0, totalRevealedPieces);
  const mediaIndex = safePieces === 0 ? 0 : Math.floor((safePieces - 1) / REVEAL_PIECES) % REWARD_MEDIA.length;
  const visiblePieces = safePieces === 0 ? 0 : ((safePieces - 1) % REVEAL_PIECES) + 1;
  return {
    media: REWARD_MEDIA[mediaIndex],
    visiblePieces
  };
}

function createSettingsSheet(): HTMLElement {
  const overlay = el("div", "settings-overlay");
  const sheet = el("section", "settings-sheet");
  sheet.setAttribute("aria-label", "Adult settings");
  const header = el("div", "settings-header");
  header.append(el("div", "", ""));
  header.firstElementChild?.append(el("p", "eyebrow", "Adult tools"), el("h2", "", "Math settings"));
  const close = buttonEl("Close", "secondary-action");
  close.addEventListener("pointerdown", closeSettings);
  close.addEventListener("click", closeSettings);
  header.append(close);

  const gradeControls = el("fieldset", "settings-group");
  gradeControls.append(el("legend", "", "Grade lanes"));
  for (const [gradeLane, labelText] of GRADE_CHOICES) {
    const label = el("label", "check-control");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = save.settings.gradeLanes.includes(gradeLane);
    input.addEventListener("change", () => updateGradeLane(gradeLane, input.checked));
    label.append(input, el("span", "", labelText));
    gradeControls.append(label);
  }

  const ops = el("fieldset", "settings-group");
  ops.append(el("legend", "", "Operations"));
  for (const operation of allowedOperationsForSettings(save.settings)) {
    const label = el("label", "check-control");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = save.settings.enabledOperations.includes(operation);
    input.addEventListener("change", () => {
      const next = input.checked
        ? [...save.settings.enabledOperations, operation]
        : save.settings.enabledOperations.filter((item) => item !== operation);
      updateSettings({ enabledOperations: next });
    });
    label.append(input, el("span", "", operationLabel(operation)));
    ops.append(label);
  }

  const length = numberControl("Session length", save.settings.sessionLength, 3, 10);
  length.input.addEventListener("change", () => updateSettings({ sessionLength: Number(length.input.value) }));
  const maxAnswer = numberControl("Highest answer", save.settings.maxAnswer, 5, save.settings.gradeLane === "grade1" ? 20 : 200);
  maxAnswer.input.addEventListener("change", () => updateSettings({ maxAnswer: Number(maxAnswer.input.value) }));
  const maxAddend = numberControl("Highest addend", save.settings.maxAddend, 3, save.settings.gradeLane === "grade1" ? 12 : 99);
  maxAddend.input.addEventListener("change", () => updateSettings({ maxAddend: Number(maxAddend.input.value) }));

  const regrouping = checkControl("Allow regrouping", save.settings.allowRegrouping, (checked) => updateSettings({ allowRegrouping: checked }));
  const fractions = checkControl("Fractions", save.settings.enableFractions, (checked) => updateSettings({
    enableFractions: checked,
    enabledOperations: checked ? [...save.settings.enabledOperations, "fraction"] : save.settings.enabledOperations.filter((item) => item !== "fraction")
  }), !hasGrade("grade4"));
  const decimals = checkControl("Decimals", save.settings.enableDecimals, (checked) => updateSettings({
    enableDecimals: checked,
    enabledOperations: checked ? [...save.settings.enabledOperations, "decimal"] : save.settings.enabledOperations.filter((item) => item !== "decimal")
  }), !hasGrade("grade4"));
  const decimalPlace = selectControl("Decimal child choice", save.settings.decimalPlace, [
    ["tenths", "Tenths"],
    ["hundredths", "Hundredths"]
  ]);
  decimalPlace.input.addEventListener("change", () => updateSettings({ decimalPlace: decimalPlace.input.value as MathSettings["decimalPlace"] }));
  const fractionModes = createModeChecks("Fraction modes", [
    ["name", "Name colored parts"],
    ["match", "Match fraction"],
    ["compare", "Compare"],
    ["equivalent", "Equivalent"],
    ["addSubtract", "Add/subtract"]
  ], save.settings.fractionModes, (modes) => updateSettings({ fractionModes: modes as MathSettings["fractionModes"] }));
  const decimalModes = createModeChecks("Decimal modes", [
    ["name", "Name colored parts"],
    ["match", "Match decimal"],
    ["compare", "Compare"],
    ["equivalent", "Equivalent"],
    ["addSubtract", "Add/subtract"]
  ], save.settings.decimalModes, (modes) => updateSettings({ decimalModes: modes as MathSettings["decimalModes"] }));
  const motion = checkControl("Reduce motion", save.settings.reducedMotion, (checked) => updateSettings({ reducedMotion: checked }));

  const reset = buttonEl("Reset math progress", "danger-action");
  reset.addEventListener("click", () => {
    if (window.confirm("Reset Math to Reveal progress?")) {
      save = { ...DEFAULT_SAVE, settings: save.settings };
      persistSave();
      screen = "launcher";
      session = null;
      feedback = "Progress reset.";
      settingsOpen = false;
      render();
    }
  });

  sheet.append(header, gradeControls, ops, length.label, maxAnswer.label, maxAddend.label);
  if (hasGrade("grade2") || hasGrade("grade3")) {
    sheet.append(regrouping);
  }
  sheet.append(fractions, decimals);
  if (hasGrade("grade4")) {
    sheet.append(decimalPlace.label, fractionModes, decimalModes);
  }
  sheet.append(motion, reset);
  overlay.append(sheet);
  return overlay;
}

function closeSettings(): void {
  settingsOpen = false;
  render();
}

function returnToLauncher(): void {
  session = null;
  selectedWrong = null;
  celebrating = false;
  screen = "launcher";
  feedback = "Pick a path to start.";
  render();
}

function startSession(path: PathId): void {
  const savedProgress = getSavedPathProgress(path);
  const seed = savedProgress?.seed ?? Math.floor(Math.random() * 0x100000000);
  const promptIndex = Math.min(savedProgress?.promptIndex ?? 0, Math.max(0, save.settings.sessionLength - 1));
  const firstPrompt = generatePrompt({
    path,
    settings: save.settings,
    promptIndex,
    random: createSeededRandom(seed + promptIndex * 97),
    recentPromptIds: savedProgress?.answeredPromptIds ?? []
  });
  session = {
    path,
    promptIndex,
    seed,
    currentPrompt: firstPrompt,
    correct: Math.min(savedProgress?.correct ?? 0, save.settings.sessionLength),
    mistakes: savedProgress?.mistakes ?? 0,
    streak: savedProgress?.streak ?? 0,
    keypadValue: "",
    answeredPromptIds: savedProgress?.answeredPromptIds ?? []
  };
  selectedWrong = null;
  celebrating = false;
  lastRewardPiece = -1;
  feedback = "Solve the first problem.";
  screen = "play";
  persistCurrentPathProgress();
  render();
}

function answerPrompt(answer: AnswerValue): void {
  if (!session) {
    return;
  }
  if (!validateAnswer(session.currentPrompt, answer)) {
    selectedWrong = answer;
    session.keypadValue = "";
    celebrating = false;
    session.mistakes += 1;
    session.streak = 0;
    feedback = session.currentPrompt.hint || NUDGE_FEEDBACK[session.mistakes % NUDGE_FEEDBACK.length];
    render();
    return;
  }

  selectedWrong = null;
  session.keypadValue = "";
  celebrating = true;
  session.correct += 1;
  session.streak += 1;
  session.answeredPromptIds.push(session.currentPrompt.id);
  const revealedPieces = save.revealedPieces + 1;
  lastRewardPiece = (revealedPieces - 1) % REVEAL_PIECES;
  save = {
    ...save,
    completedPrompts: save.completedPrompts + 1,
    revealedPieces,
    bestStreak: Math.max(save.bestStreak, session.streak)
  };
  feedback = CORRECT_FEEDBACK[(save.completedPrompts + session.streak) % CORRECT_FEEDBACK.length];

  if (session.promptIndex + 1 >= save.settings.sessionLength) {
    save = {
      ...save,
      completedSessions: save.completedSessions + 1,
      pathProgress: removeSavedPathProgress(save.pathProgress, session)
    };
    persistSave();
    screen = "summary";
    feedback = "Session complete.";
    render();
    return;
  }

  session.promptIndex += 1;
  session.currentPrompt = generatePrompt({
    path: session.path,
    settings: save.settings,
    promptIndex: session.promptIndex,
    random: createSeededRandom(session.seed + session.promptIndex * 97),
    recentPromptIds: session.answeredPromptIds
  });
  save = {
    ...save,
    pathProgress: {
      ...save.pathProgress,
      [pathProgressKey(session.path, session.currentPrompt.gradeLane)]: toPathProgress(session, session.currentPrompt.gradeLane)
    }
  };
  persistSave();
  render();
}

function submitKeypadAnswer(): void {
  if (!session || session.keypadValue.length === 0) {
    return;
  }
  answerPrompt(Number(session.keypadValue));
}

function updateSettings(next: Partial<MathSettings>): void {
  save = {
    ...save,
    settings: normalizeSettings({ ...save.settings, ...next })
  };
  persistSave();
  session = null;
  screen = "launcher";
  feedback = "Settings updated.";
  render();
}

function updateGradeLane(gradeLane: GradeLane, enabled: boolean): void {
  const current = save.settings.gradeLanes;
  const next = enabled ? [...current, gradeLane] : current.filter((item) => item !== gradeLane);
  if (next.length === 0) {
    return;
  }
  updateSettings({
    gradeLanes: next,
    enabledOperations: enabled ? uniqueOperations([...save.settings.enabledOperations, ...operationsForGrade(gradeLane)]) : save.settings.enabledOperations
  });
}

function getSavedPathProgress(path: PathId): PathProgress | null {
  const progress = save.pathProgress[pathProgressKey(path, gradeLaneForPath(path))];
  if (!progress || progress.correct >= save.settings.sessionLength) {
    return fallbackSavedPathProgress(path);
  }
  return progress;
}

function persistCurrentPathProgress(): void {
  if (!session || session.correct >= save.settings.sessionLength) {
    return;
  }
  save = {
    ...save,
    pathProgress: {
      ...save.pathProgress,
      [pathProgressKey(session.path, session.currentPrompt.gradeLane)]: toPathProgress(session, session.currentPrompt.gradeLane)
    }
  };
  persistSave();
}

function toPathProgress(current: SessionState, gradeLane: MathSettings["gradeLane"]): PathProgress {
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

function removeSavedPathProgress(progress: MathSave["pathProgress"], current: SessionState): MathSave["pathProgress"] {
  const next = { ...progress };
  delete next[pathProgressKey(current.path, current.currentPrompt.gradeLane)];
  return next;
}

function pathProgressKey(path: PathId, gradeLane: MathSettings["gradeLane"]): string {
  return pathProgressKeyFor(path, save.settings, gradeLane);
}

function fallbackSavedPathProgress(path: PathId): PathProgress | null {
  const candidates = Object.values(save.pathProgress)
    .filter((progress) => progress.path === path && progress.correct < save.settings.sessionLength)
    .sort((a, b) => b.correct - a.correct || b.promptIndex - a.promptIndex);
  return candidates[0] ?? null;
}

function persistSave(): void {
  if (!saveGame(window.localStorage, save)) {
    persistenceWarning = true;
  }
  if (saveLoadStatus === "corrupt-recovered") {
    saveLoadStatus = "ok";
  }
}

function updateChildOperation(operation: Operation, enabled: boolean): void {
  const current = save.settings.enabledOperations;
  const next = enabled ? [...current, operation] : current.filter((item) => item !== operation);
  if (next.length === 0) {
    return;
  }
  updateSettings({ enabledOperations: next });
}

function createChildPracticeChoices(): HTMLElement {
  const panel = el("section", "child-settings-panel");
  panel.append(el("h3", "", "Practice choices"));
  const choices = el("div", "operation-chip-grid");
  for (const operation of allowedOperationsForSettings(save.settings)) {
    const label = el("label", "operation-chip");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = save.settings.enabledOperations.includes(operation);
    input.addEventListener("change", () => updateChildOperation(operation, input.checked));
    label.append(input, el("span", "", operationLabel(operation)));
    choices.append(label);
  }
  panel.append(choices);
  if (hasGrade("grade4") && save.settings.enabledOperations.includes("decimal")) {
    const decimalChoices = el("div", "decimal-choice-row");
    decimalChoices.append(el("span", "", "Decimals"));
    for (const option of [["tenths", "Tenths"], ["hundredths", "Hundredths"]] as const) {
      const label = el("label", "operation-chip");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "decimal-place";
      input.checked = save.settings.decimalPlace === option[0];
      input.addEventListener("change", () => updateSettings({ decimalPlace: option[0] }));
      label.append(input, el("span", "", option[1]));
      decimalChoices.append(label);
    }
    panel.append(decimalChoices);
  }
  return panel;
}

function createConfetti(): HTMLElement {
  const confetti = el("div", "confetti-burst");
  confetti.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 18; index += 1) {
    const piece = el("span", "confetti-piece");
    piece.style.setProperty("--x", String((index % 9) - 4));
    piece.style.setProperty("--delay", String((index % 6) * 45) + "ms");
    piece.style.setProperty("--color", ["#f8d96f", "#2c7a61", "#df7f48", "#4b86b4", "#8c2f39", "#7aa95c"][index % 6]);
    confetti.append(piece);
  }
  return confetti;
}

function appendConfettiOnce(parent: HTMLElement): void {
  if (!celebrating) {
    return;
  }
  const confetti = createConfetti();
  parent.append(confetti);
  window.setTimeout(() => confetti.remove(), 1300);
  celebrating = false;
}

function createGemGrid(count: number): HTMLElement {
  const grid = el("div", "gem-grid");
  for (let index = 0; index < count; index += 1) {
    grid.append(el("span", "count-gem"));
  }
  return grid;
}

function createGroupGrid(groups: number[]): HTMLElement {
  const wrapper = el("div", "group-grid");
  groups.forEach((count, groupIndex) => {
    const group = el("div", "visual-group");
    group.setAttribute("aria-label", "Group " + String(groupIndex + 1) + " has " + String(count));
    for (let index = 0; index < count; index += 1) {
      group.append(el("span", "mini-counter"));
    }
    wrapper.append(group);
  });
  return wrapper;
}

function createArrayGrid(rows: number, columns: number): HTMLElement {
  const grid = el("div", "array-grid");
  grid.style.setProperty("--columns", String(columns));
  grid.setAttribute("aria-label", String(rows) + " rows and " + String(columns) + " columns");
  for (let index = 0; index < rows * columns; index += 1) {
    grid.append(el("span", "mini-counter"));
  }
  return grid;
}

function createChoiceGrid(prompt: MathPrompt): HTMLElement {
  const choices = el("div", "answer-grid");
  for (const choice of prompt.choices) {
    const answer = buttonEl(choiceLabel(choice), "answer-choice");
    answer.setAttribute("aria-label", "Answer " + choiceLabel(choice));
    answer.classList.toggle("is-wrong", selectedWrong === choice);
    answer.addEventListener("click", () => answerPrompt(choice));
    choices.append(answer);
  }
  return choices;
}

function createKeypad(current: SessionState): HTMLElement {
  const wrapper = el("div", selectedWrong === null ? "keypad-panel" : "keypad-panel is-wrong");
  const display = el("output", "keypad-display", current.keypadValue || " ");
  display.setAttribute("aria-label", "Current answer");
  const keys = el("div", "keypad-grid");
  for (const key of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"]) {
    const button = buttonEl(key === "back" ? "<-" : key === "clear" ? "Clear" : key, key === "clear" ? "keypad-key keypad-clear" : "keypad-key");
    button.setAttribute("aria-label", key === "back" ? "Backspace" : key === "clear" ? "Clear answer" : "Digit " + key);
    button.addEventListener("click", () => updateKeypad(key));
    keys.append(button);
  }
  const submit = buttonEl("Check", "primary-action keypad-submit");
  submit.disabled = current.keypadValue.length === 0;
  submit.addEventListener("click", submitKeypadAnswer);
  wrapper.append(display, keys, submit);
  return wrapper;
}

function updateKeypad(key: string): void {
  if (!session) {
    return;
  }
  if (key === "clear") {
    session.keypadValue = "";
  } else if (key === "back") {
    session.keypadValue = session.keypadValue.slice(0, -1);
  } else if (session.keypadValue.length < 3) {
    session.keypadValue += key;
  }
  selectedWrong = null;
  render();
}

function createFractionVisual(colored: number, total: number): HTMLElement {
  const wrapper = el("div", "fraction-visual");
  wrapper.setAttribute("aria-label", String(colored) + " colored parts out of " + String(total));
  for (let index = 0; index < total; index += 1) {
    const part = el("span", index < colored ? "fraction-part is-colored" : "fraction-part");
    wrapper.append(part);
  }
  return wrapper;
}

function createPartVisual(model: PartModel): HTMLElement {
  const wrapper = el("div", model.total === 100 ? "part-model hundredths-model" : "part-model");
  wrapper.setAttribute("aria-label", partAria(model));
  if (model.label) {
    wrapper.append(el("span", "part-label", model.label));
  }
  const grid = el("div", model.kind === "decimal" ? "part-grid decimal-grid" : "part-grid fraction-grid");
  grid.style.setProperty("--parts", String(model.total));
  grid.style.setProperty("--columns", String(model.total === 100 ? 10 : model.total));
  for (let index = 0; index < model.total; index += 1) {
    grid.append(el("span", index < model.colored ? "part-cell is-colored" : "part-cell"));
  }
  wrapper.append(grid);
  return wrapper;
}

function createCompareVisual(left: PartModel, right: PartModel): HTMLElement {
  const wrapper = el("div", "part-compare");
  wrapper.append(createPartVisual({ ...left, label: "A: " + (left.label ?? "") }));
  wrapper.append(createPartVisual({ ...right, label: "B: " + (right.label ?? "") }));
  return wrapper;
}

function createEquivalentVisual(models: [PartModel, PartModel]): HTMLElement {
  const wrapper = el("div", "part-equivalent");
  wrapper.append(createPartVisual(models[0]));
  wrapper.append(createPartVisual(models[1]));
  return wrapper;
}

function createOperationVisual(left: PartModel, right: PartModel, result: PartModel, operator: "+" | "-"): HTMLElement {
  const wrapper = el("div", "part-operation");
  wrapper.append(createPartVisual(left));
  wrapper.append(el("span", "operator-mark", operator));
  wrapper.append(createPartVisual(right));
  wrapper.append(el("span", "operator-mark", "="));
  const answerSlot = el("div", result.total === 100 ? "part-model hundredths-model answer-slot" : "part-model answer-slot");
  answerSlot.setAttribute("aria-label", "Choose the result");
  answerSlot.append(el("span", "part-label", "?"));
  wrapper.append(answerSlot);
  return wrapper;
}

function partAria(model: PartModel): string {
  const unit = model.total === 100 ? "hundred" : model.total === 10 ? "ten" : String(model.total);
  return String(model.colored) + " colored parts out of " + unit + " equal parts";
}

function allowedOperationsForSettings(settings: MathSettings): Operation[] {
  return uniqueOperations(settings.gradeLanes.flatMap(operationsForGrade));
}

function operationsForGrade(gradeLane: GradeLane): Operation[] {
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

function uniqueOperations(values: readonly Operation[]): Operation[] {
  return [...new Set(values)];
}

function hasGrade(gradeLane: GradeLane): boolean {
  return save.settings.gradeLanes.includes(gradeLane);
}

function gradeLaneForPath(path: PathId): GradeLane {
  if (path === "count") {
    return "kindergarten";
  }
  if (path === "placeValue" || path === "skipCount" || path === "groups") {
    return "grade2";
  }
  if (path === "times" || path === "divide" || path === "arrays") {
    return "grade3";
  }
  if (path === "fractions" || path === "decimals") {
    return "grade4";
  }
  if (path === "add" || path === "subtract") {
    const arithmeticGrades = save.settings.gradeLanes.filter((gradeLane) => ["kindergarten", "grade1", "grade2"].includes(gradeLane));
    return arithmeticGrades[arithmeticGrades.length - 1] ?? save.settings.gradeLane;
  }
  return save.settings.gradeLane;
}

function operationLabel(operation: Operation): string {
  if (operation === "count") {
    return "Counting";
  }
  if (operation === "add") {
    return "Addition";
  }
  if (operation === "subtract") {
    return "Subtraction";
  }
  if (operation === "placeValue") {
    return "Place value";
  }
  if (operation === "skipCount") {
    return "Skip counting";
  }
  if (operation === "groups") {
    return "Equal groups";
  }
  if (operation === "multiply") {
    return "Times facts";
  }
  if (operation === "divide") {
    return "Division";
  }
  if (operation === "arrays") {
    return "Arrays";
  }
  if (operation === "fraction") {
    return "Fractions";
  }
  return "Decimals";
}

function pathLabel(path: PathId): string {
  if (path === "count") {
    return "Count";
  }
  if (path === "add") {
    return "Add";
  }
  if (path === "subtract") {
    return "Subtract";
  }
  if (path === "placeValue") {
    return "Place Value";
  }
  if (path === "skipCount") {
    return "Skip Count";
  }
  if (path === "groups") {
    return "Groups";
  }
  if (path === "times") {
    return "Times";
  }
  if (path === "divide") {
    return "Divide";
  }
  if (path === "arrays") {
    return "Arrays";
  }
  if (path === "fractions") {
    return "Fractions";
  }
  if (path === "decimals") {
    return "Decimals";
  }
  return "Mix";
}

function pathCue(path: PathId): string {
  if (path === "count") {
    return "Tap how many";
  }
  if (path === "add") {
    return "Put numbers together";
  }
  if (path === "subtract") {
    return "Find what is left";
  }
  if (path === "placeValue") {
    return "Tens and ones";
  }
  if (path === "skipCount") {
    return "Find the pattern";
  }
  if (path === "groups") {
    return "Equal groups";
  }
  if (path === "times") {
    return "Facts to 12";
  }
  if (path === "divide") {
    return "Missing factors";
  }
  if (path === "arrays") {
    return "Rows and columns";
  }
  if (path === "fractions") {
    return "Parts of a whole";
  }
  if (path === "decimals") {
    return "Tenths and hundredths";
  }
  return "A little of each";
}

function pathIcon(path: PathId): string {
  if (path === "count") {
    return "123";
  }
  if (path === "add") {
    return "+";
  }
  if (path === "subtract") {
    return "-";
  }
  if (path === "placeValue") {
    return "10";
  }
  if (path === "skipCount") {
    return ">>";
  }
  if (path === "groups") {
    return "oo";
  }
  if (path === "times") {
    return "x";
  }
  if (path === "divide") {
    return "/";
  }
  if (path === "arrays") {
    return "[]";
  }
  if (path === "fractions") {
    return "1/2";
  }
  if (path === "decimals") {
    return ".1";
  }
  return "?";
}

function gradeLaneCopy(settings: MathSettings): string {
  if (settings.gradeLanes.length > 1) {
    return "Mixed practice: choose paths from " + settings.gradeLanes.map(gradeLabel).join(", ") + ".";
  }
  if (settings.gradeLane === "kindergarten") {
    return "Kindergarten practice: count, add, and subtract with small numbers.";
  }
  if (settings.gradeLane === "grade1") {
    return "First grade practice: add and subtract up to 20.";
  }
  if (settings.gradeLane === "grade2") {
    return "Second grade practice: two-digit math, place value, skip counting, and groups.";
  }
  if (settings.gradeLane === "grade3") {
    return "Third grade practice: times, division, and arrays.";
  }
  return "Fourth grade practice: fractions and decimals with visual models.";
}

function gradeLabel(gradeLane: GradeLane): string {
  return GRADE_CHOICES.find(([value]) => value === gradeLane)?.[1] ?? "First grade";
}

function currentGradeBadge(): string {
  if ((screen === "play" || screen === "summary") && session) {
    return gradeShortLabel(session.currentPrompt.gradeLane);
  }
  return save.settings.gradeLanes.map(gradeShortLabel).join(", ");
}

function gradeShortLabel(gradeLane: GradeLane): string {
  if (gradeLane === "kindergarten") {
    return "K";
  }
  if (gradeLane === "grade1") {
    return "1st";
  }
  if (gradeLane === "grade2") {
    return "2nd";
  }
  if (gradeLane === "grade3") {
    return "3rd";
  }
  return "4th";
}

function stat(value: string, label: string): HTMLElement {
  const item = el("div", "stat");
  item.append(el("strong", "", value), el("span", "", label));
  return item;
}

function selectControl(labelText: string, value: string, options: Array<[string, string]>): { label: HTMLLabelElement; input: HTMLSelectElement } {
  const label = el("label", "text-control");
  const input = document.createElement("select");
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    input.append(option);
  }
  label.append(el("span", "", labelText), input);
  return { label, input };
}

function numberControl(labelText: string, value: number, min: number, max: number): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = el("label", "text-control");
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  label.append(el("span", "", labelText), input);
  return { label, input };
}

function createModeChecks<T extends string>(legend: string, options: Array<[T, string]>, selected: T[], onChange: (selected: T[]) => void): HTMLElement {
  const group = el("fieldset", "settings-group");
  group.append(el("legend", "", legend));
  for (const [value, labelText] of options) {
    const label = el("label", "check-control");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.includes(value);
    input.addEventListener("change", () => {
      const next = input.checked
        ? [...selected, value]
        : selected.filter((item) => item !== value);
      if (next.length > 0) {
        onChange(next);
      } else {
        input.checked = true;
      }
    });
    label.append(input, el("span", "", labelText));
    group.append(label);
  }
  return group;
}

function checkControl(labelText: string, checked: boolean, onChange: (checked: boolean) => void, disabled = false): HTMLLabelElement {
  const label = el("label", "check-control");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.disabled = disabled;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input, el("span", "", labelText));
  return label;
}

function choiceLabel(choice: AnswerValue): string {
  if (choice === "left") {
    return "A";
  }
  if (choice === "right") {
    return "B";
  }
  if (choice === "same") {
    return "Same";
  }
  if (choice === "different") {
    return "Different";
  }
  return String(choice);
}

function buttonEl(text: string, className: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  return button;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}
