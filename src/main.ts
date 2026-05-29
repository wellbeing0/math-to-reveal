import "./styles.css";
import {
  eligiblePaths,
  normalizeSettings,
  type AnswerValue,
  type MathPrompt,
  type MathSettings,
  type PartModel,
  type GradeLane,
  type Operation,
  type PathId
} from "./mathEngine";
import { allowedOperationsForSettings, operationsForGradeLane, uniqueOperations } from "./mathSettings";
import { cancelInstructionAudio } from "./instructionAudio";
import { REWARD_MEDIA, type RewardMedia } from "./rewardMedia";
import { getActiveReward as getRewardForProgress, hideRewardMediaId, isGiphyMedia, isHiddenRewardMediaId as isHiddenRewardMediaIdForSettings, restoreRewardMediaId, REVEAL_PIECES, visibleRewardMedia } from "./rewardProgress";
import { loadGiphyRewardMedia, normalizeRewardThemeId, REWARD_THEMES, rewardThemeById, type RewardThemeId } from "./rewardThemes";
import { DEFAULT_SAVE, canUseStorage, getLastLoadSaveStatus, loadSave, saveGame, type MathSave, type PathProgress, type SaveLoadStatus } from "./save";
import { bestSavedPathProgress, createSessionState, evaluateAnswer, markHelpUsed, pathProgressKey as sessionPathProgressKey, removeSavedPathProgress, toPathProgress, type SessionState } from "./sessionFlow";
import { teachingAidForContext, teachingAidForPrompt, teachingAidStepMedia, TEACHING_AIDS, type TeachingAid, type TeachingAidMedia } from "./teachingAids";
import { playTeachingAidStepAudio } from "./teachingAidAudio";
import { createArrayGrid, createCompareVisual, createEquivalentVisual, createFractionVisual, createGemGrid, createGroupGrid, createOperationVisual, createPartVisual } from "./views/mathVisuals";
import { commandIconSvg, type CommandIcon } from "../shared/commandIcons";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

const appRoot = app;

const CORRECT_FEEDBACK = ["Nice math.", "You found it.", "That works.", "Good thinking.", "Path cleared."];
const NUDGE_FEEDBACK = ["Try that one again.", "Look closely and try again.", "Almost. Count it one more time.", "Check the numbers again."];
const WORKBENCH_HANDOFF_BASE_URL = workbenchHandoffBaseUrl();
const GRADE_CHOICES: Array<[GradeLane, string]> = [
  ["kindergarten", "Kindergarten"],
  ["grade1", "First grade"],
  ["grade2", "Second grade"],
  ["grade3", "Third grade"],
  ["grade4", "Fourth grade"]
];

type Screen = "launcher" | "play" | "summary";
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
let themedRewardMedia: RewardMedia[] = [];
let rewardThemeStatus = "";
let viewedRewardMediaId: string | null = null;
let rewardMediaMessage = "";
let activeTeachingAid: { aid: TeachingAid; stepIndex: number; preview: boolean } | null = null;
let teachingAidMessage = "";

restoreHandoffReturn();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelInstructionAudio();
  }
});

render();
void loadSelectedRewardTheme();

function render(): void {
  const settingsSheetScrollTop = document.querySelector<HTMLElement>(".settings-sheet")?.scrollTop ?? 0;
  document.body.classList.toggle("settings-open", settingsOpen);
  document.body.classList.toggle("reduced-motion", save.settings.reducedMotion);
  appRoot.innerHTML = "";
  appRoot.append(createShell());
  if (settingsOpen) {
    const settingsSheet = document.querySelector<HTMLElement>(".settings-sheet");
    if (settingsSheet) {
      settingsSheet.scrollTop = settingsSheetScrollTop;
    }
  }
}

function createShell(): HTMLElement {
  const shell = el("main", "app-shell");
  const topbar = el("header", "topbar");
  const title = el("div", "title-block");
  title.append(el("p", "eyebrow", "Early math game"));
  const heading = el("h1", "title-row");
  heading.append(document.createTextNode("Math Rewards"), el("span", "grade-badge", currentGradeBadge()));
  title.append(heading);
  title.append(el("p", "lede", "Solve one problem at a time and uncover the video."));

  const status = el("section", "status-strip");
  status.append(stat(String(save.completedPrompts), "problems"));
  status.append(stat(String(save.completedSessions), "sessions"));
  status.append(stat(String(save.bestStreak), "best streak"));

  const demoLink = document.createElement("a");
  demoLink.className = "demo-link math-command";
  demoLink.href = "./rewards/math-rewards-oss-demo.mp4";
  demoLink.append(commandLabel("video", "Demo"));
  demoLink.setAttribute("aria-label", "Play demo video");

  const settingsButton = commandButton("Settings", "settings-button", "settings");
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
  if (activeTeachingAid) {
    shell.append(createTeachingAidPanel(activeTeachingAid.aid, activeTeachingAid.stepIndex, activeTeachingAid.preview));
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
  const workbenchUrl = current.path === "mix" ? null : workbenchHandoffUrlForPrompt(prompt, current.path);
  const teachingAid = workbenchUrl ? null : teachingAidForPrompt(prompt, save.settings);
  const wrapper = el("article", "practice-card");
  const progress = el("div", "session-progress");
  progress.append(el("span", "", "Solved " + String(current.correct) + " of " + String(save.settings.sessionLength)));
  const bar = el("div", "progress-bar");
  bar.append(el("span", ""));
  bar.style.setProperty("--progress", String(current.correct / save.settings.sessionLength));
  const choosePath = commandButton("Path", "secondary-action choose-path-action", "path", "Choose path");
  choosePath.addEventListener("click", returnToLauncher);
  progress.append(bar);
  progress.append(choosePath);

  const promptPanel = el("section", "prompt-panel");
  promptPanel.append(el("p", "path-label", pathLabel(current.path)));
  const questionRow = el("div", "question-row");
  questionRow.append(el("div", "question", prompt.question));
  const questionActions = el("div", "question-actions");
  if (teachingAid) {
    const helpButton = commandButton(current.promptAttempts >= 2 ? "Clue" : "Think", "secondary-action help-action", "brain", teachingAid.buttonLabel);
    helpButton.classList.toggle("is-suggested", current.promptAttempts >= 2);
    helpButton.addEventListener("click", () => openTeachingAid(teachingAid, 0));
    questionActions.append(helpButton);
  }
  if (workbenchUrl) {
    const workbenchLink = el("a", "secondary-action help-action workbench-action math-command");
    workbenchLink.href = workbenchUrl;
    workbenchLink.setAttribute("aria-label", "Open workbench model for this prompt");
    workbenchLink.append(commandLabel("workbench", "Workbench"));
    questionActions.append(workbenchLink);
  }
  if (questionActions.childElementCount > 0) {
    setCommandCount(questionActions);
    questionRow.classList.add("has-actions");
    if (teachingAid) {
      questionRow.classList.add("has-help");
    }
    questionRow.append(questionActions);
  }
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
  if (teachingAid && current.promptAttempts >= 2) {
    const offer = commandButton("Clue", "secondary-action tiny-action", "brain", "Try a thinking step");
    offer.addEventListener("click", () => openTeachingAid(teachingAid, 0));
    feedbackPanel.append(offer);
  }

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
  const replay = commandButton("Replay", "primary-action", "reset", "Replay path");
  replay.addEventListener("click", () => startSession(current.path));
  const another = commandButton("Path", "secondary-action", "path", "Choose path");
  another.addEventListener("click", () => {
    screen = "launcher";
    feedback = "Pick a path to start.";
    render();
  });
  const keepGoing = commandButton("Keep going", "secondary-action", "next");
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
  if (rewardThemeStatus) {
    panel.append(el("p", "reward-attribution", rewardThemeStatus));
  }
  return panel;
}

function createRewardAttribution(media: RewardMedia): HTMLElement {
  const attribution = el("p", "reward-attribution");
  attribution.append(document.createTextNode((isGiphyMedia(media) ? "GIF by " : "Video by ") + media.artist + " - " + media.license));
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
  return getRewardForProgress(totalRevealedPieces, activeRewardMedia());
}

function createSettingsSheet(): HTMLElement {
  const overlay = el("div", "settings-overlay");
  const sheet = el("section", "settings-sheet");
  sheet.setAttribute("aria-label", "Adult settings");
  const header = el("div", "settings-header");
  header.append(el("div", "", ""));
  header.firstElementChild?.append(el("p", "eyebrow", "Adult tools"), el("h2", "", "Math settings"));
  const close = commandButton("Close", "secondary-action", "close");
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
  const attemptsToReward = stepperControl("Attempts to reward", save.settings.attemptsToReward, 0, 3, (value) => updateSettings({ attemptsToReward: value }));

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
  const rewardTheme = selectControl("Reward theme", save.settings.rewardTheme, REWARD_THEMES.map((theme) => [theme.id, theme.label]));
  rewardTheme.input.addEventListener("change", () => {
    const themeId = normalizeRewardThemeId(rewardTheme.input.value);
    rewardThemeStatus = "";
    updateSettings({ rewardTheme: themeId });
    void loadSelectedRewardTheme();
  });
  const motion = checkControl("Reduce motion", save.settings.reducedMotion, (checked) => updateSettings({ reducedMotion: checked }));

  const reset = commandButton("Reset math progress", "danger-action", "reset");
  reset.addEventListener("click", () => {
    if (window.confirm("Reset Math Rewards progress?")) {
      save = { ...DEFAULT_SAVE, settings: save.settings };
      persistSave();
      screen = "launcher";
      session = null;
      feedback = "Progress reset.";
      settingsOpen = false;
      render();
    }
  });

  sheet.append(header, gradeControls, ops, length.label, maxAnswer.label, maxAddend.label, attemptsToReward);
  if (hasGrade("grade2") || hasGrade("grade3")) {
    sheet.append(regrouping);
  }
  sheet.append(fractions, decimals);
  if (hasGrade("grade4")) {
    sheet.append(decimalPlace.label, fractionModes, decimalModes);
  }
  sheet.append(rewardTheme.label);
  sheet.append(el("p", "settings-note", rewardThemeById(save.settings.rewardTheme).provider === "giphy"
    ? "GIPHY rewards load live and show GIPHY attribution."
    : "Starter kitten rewards use the local curated media list."));
  sheet.append(createRewardMediaTools());
  sheet.append(createTeachingAidTools());
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
  activeTeachingAid = null;
  screen = "launcher";
  feedback = "Pick a path to start.";
  render();
}

function startSession(path: PathId): void {
  const savedProgress = getSavedPathProgress(path);
  const seed = savedProgress?.seed ?? Math.floor(Math.random() * 0x100000000);
  session = createSessionState({
    path,
    settings: save.settings,
    seed,
    savedProgress
  });
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
  const result = evaluateAnswer({
    session,
    answer,
    settings: save.settings,
    completedPrompts: save.completedPrompts,
    revealedPieces: save.revealedPieces,
    bestStreak: save.bestStreak,
    revealPieces: REVEAL_PIECES,
    correctFeedback: CORRECT_FEEDBACK,
    nudgeFeedback: NUDGE_FEEDBACK
  });

  session = result.session;
  if (result.kind === "incorrect") {
    selectedWrong = result.selectedWrong;
    celebrating = false;
    feedback = result.feedback;
    const aid = teachingAidForContext(result.supportContext, save.settings);
    if (aid && result.attempts >= 2) {
      feedback += " Want to try a thinking step?";
    }
    render();
    return;
  }

  selectedWrong = null;
  celebrating = result.completionQuality === "clean";
  lastRewardPiece = result.lastRewardPiece;
  save = {
    ...save,
    completedPrompts: result.completedPrompts,
    revealedPieces: result.revealedPieces,
    bestStreak: result.bestStreak
  };
  feedback = result.feedback;

  if (result.completedSession) {
    save = {
      ...save,
      completedSessions: save.completedSessions + 1,
      pathProgress: removeSavedPathProgress(save.pathProgress, session, save.settings)
    };
    persistSave();
    screen = "summary";
    feedback = "Session complete.";
    render();
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

function activeRewardMedia(): RewardMedia[] {
  return visibleRewardMedia(save.settings, themedRewardMedia);
}

function openTeachingAid(aid: TeachingAid, stepIndex: number): void {
  activeTeachingAid = { aid, stepIndex, preview: false };
  if (session) {
    session = markHelpUsed(session);
  }
  acknowledgeTeachingAid(aid.id, false);
  void playActiveTeachingAidAudio();
  render();
}

function previewTeachingAid(aid: TeachingAid): void {
  activeTeachingAid = { aid, stepIndex: 0, preview: true };
  void playActiveTeachingAidAudio();
  render();
}

function acknowledgeTeachingAid(id: string, rerender = true): void {
  if (!save.settings.seenTeachingAidIds.includes(id)) {
    save = {
      ...save,
      settings: {
        ...save.settings,
        seenTeachingAidIds: [...save.settings.seenTeachingAidIds, id]
      }
    };
    persistSave();
  }
  if (rerender) {
    render();
  }
}

function closeTeachingAid(): void {
  activeTeachingAid = null;
  cancelInstructionAudio();
  render();
}

function playActiveTeachingAidAudio(): Promise<"audio" | "fallback" | "silent"> {
  if (!activeTeachingAid) {
    return Promise.resolve("silent");
  }
  const step = activeTeachingAid.aid.steps[Math.max(0, Math.min(activeTeachingAid.stepIndex, activeTeachingAid.aid.steps.length - 1))];
  return playTeachingAidStepAudio(activeTeachingAid.aid, step);
}

function createTeachingAidPanel(aid: TeachingAid, stepIndex: number, preview: boolean): HTMLElement {
  const overlay = el("div", "teaching-aid-overlay");
  const panel = el("section", "teaching-aid-panel");
  panel.setAttribute("aria-label", aid.title);
  const step = aid.steps[Math.max(0, Math.min(stepIndex, aid.steps.length - 1))];
  panel.append(el("p", "eyebrow", preview ? "Teaching aid preview" : "Think step"));
  panel.append(el("h2", "", aid.title));
  panel.append(el("h3", "", step.title));
  const list = el("ul", "teaching-prompts");
  for (const prompt of step.prompts.slice(0, 2)) {
    list.append(el("li", "", prompt));
  }
  panel.append(list);
  if (aid.reviewQuestion && step.kind === "check") {
    panel.append(el("p", "settings-note", aid.reviewQuestion));
  }
  const activePrompt = preview ? null : session?.currentPrompt ?? null;
  const media = teachingAidStepMedia(aid, step, activePrompt, preview);
  if (media.length) {
    panel.append(createTeachingAidMedia(media));
  }
  const actions = el("div", "summary-actions");
  const close = commandButton(preview ? "Back to settings" : "Back to problem", "secondary-action", preview ? "settings" : "back");
  close.addEventListener("click", closeTeachingAid);
  actions.append(close);
  if (stepIndex + 1 < aid.steps.length) {
    const next = commandButton("Next step", "primary-action", "next");
    next.addEventListener("click", () => {
      activeTeachingAid = { aid, stepIndex: stepIndex + 1, preview };
      void playActiveTeachingAidAudio();
      render();
    });
    actions.append(next);
  }
  panel.append(actions);
  overlay.append(panel);
  return overlay;
}

function createTeachingAidMedia(mediaItems: TeachingAidMedia[]): HTMLElement {
  const wrapper = el("div", "teaching-aid-media");
  for (const media of mediaItems) {
    if (media.kind === "gif" || media.kind === "image") {
      const image = document.createElement("img");
      image.src = media.src;
      image.alt = media.alt ?? "";
      image.loading = "lazy";
      wrapper.append(image);
    } else if (media.kind === "video") {
      const video = document.createElement("video");
      video.src = media.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      wrapper.append(video);
    } else {
      const audio = document.createElement("audio");
      audio.src = media.src;
      audio.controls = true;
      wrapper.append(audio);
    }
    if (media.caption) {
      wrapper.append(el("p", "settings-note", media.caption));
    }
  }
  return wrapper;
}

async function loadSelectedRewardTheme(): Promise<void> {
  const themeId = normalizeRewardThemeId(save.settings.rewardTheme) as RewardThemeId;
  if (themeId === "kittens") {
    themedRewardMedia = [];
    rewardThemeStatus = "";
    return;
  }

  try {
    const loaded = await loadGiphyRewardMedia(themeId);
    themedRewardMedia = loaded;
    rewardThemeStatus = loaded.length > 0 ? "Powered by GIPHY" : "GIPHY key unavailable; showing kitten rewards.";
  } catch {
    themedRewardMedia = [];
    rewardThemeStatus = "GIPHY rewards could not load; showing kitten rewards.";
  }
  render();
}

function createRewardMediaTools(): HTMLElement {
  const section = el("section", "reward-media-tools");
  const theme = rewardThemeById(save.settings.rewardTheme);
  const isGiphyTheme = theme.provider === "giphy";
  const mediaList = isGiphyTheme ? themedRewardMedia : REWARD_MEDIA;
  const visibleCount = isGiphyTheme
    ? mediaList.filter((media) => !isHiddenRewardMediaId(media.id)).length
    : mediaList.length;
  const heading = el("div", "settings-subhead");
  heading.append(el("h3", "", isGiphyTheme ? "Reward GIFs" : "Reward videos"));
  heading.append(el("span", "settings-note", String(visibleCount) + " available"));
  section.append(heading);

  if (rewardMediaMessage) {
    section.append(el("p", "settings-note", rewardMediaMessage));
  }

  const viewed = mediaList.find((media) => media.id === viewedRewardMediaId);
  if (viewed) {
    section.append(createRewardMediaViewer(viewed));
  }

  if (mediaList.length === 0 && isGiphyTheme) {
    section.append(el("p", "settings-note", rewardThemeStatus || "GIPHY rewards have not loaded yet."));
    return section;
  }

  const list = el("div", "reward-media-list");
  for (const media of mediaList) {
    const hidden = isGiphyTheme && isHiddenRewardMediaId(media.id);
    const row = el("div", "reward-media-row");
    const preview = document.createElement("img");
    preview.src = rewardPreviewSrc(media);
    preview.alt = "";
    preview.loading = "lazy";
    const summary = el("span", "", media.title + " - " + mediaTypeLabel(media) + " - " + media.license + (hidden ? " - hidden" : ""));
    const view = commandButton("View", "secondary-action tiny-action", "video");
    view.addEventListener("click", () => {
      viewedRewardMediaId = media.id;
      rewardMediaMessage = "Viewing " + media.title + ".";
      render();
    });
    row.append(preview, summary, view);
    if (isGiphyTheme) {
      const hide = commandButton("Hide", "danger-action tiny-action", "hide");
      hide.disabled = hidden || visibleCount <= 1;
      hide.addEventListener("click", () => {
        if (!window.confirm("Hide " + media.title + " from this reward theme?")) {
          return;
        }
        if (visibleCount <= 1) {
          rewardMediaMessage = "Reward theme needs at least one visible item.";
          render();
          return;
        }
        hideRewardMedia(media.id);
        if (viewedRewardMediaId === media.id) {
          viewedRewardMediaId = null;
        }
        rewardMediaMessage = media.title + " hidden.";
        void sendRewardMediaReport("hide", media);
        render();
      });
      row.append(hide);
      if (hidden) {
        const restore = commandButton("Restore", "secondary-action tiny-action", "restore");
        restore.addEventListener("click", () => {
          restoreRewardMedia(media.id);
          rewardMediaMessage = media.title + " restored.";
          render();
        });
        row.append(restore);
      }
    }
    list.append(row);
  }
  section.append(list);

  if (isGiphyTheme) {
    const restoreAll = commandButton("Restore hidden GIFs", "secondary-action", "restore");
    restoreAll.disabled = save.settings.hiddenRewardMediaIds.length === 0;
    restoreAll.addEventListener("click", () => {
      save = {
        ...save,
        settings: {
          ...save.settings,
          hiddenRewardMediaIds: []
        }
      };
      persistSave();
      rewardMediaMessage = "Hidden GIPHY rewards restored.";
      render();
    });
    section.append(restoreAll);
    section.append(el("p", "settings-note", "GIPHY items are hidden on this device only; source IDs stay in the curated set."));
  }
  return section;
}

function createTeachingAidTools(): HTMLElement {
  const visibleCount = TEACHING_AIDS.filter((aid) => !isHiddenTeachingAidId(aid.id)).length;
  const section = el("section", "teaching-aid-tools");
  const heading = el("div", "settings-subhead");
  heading.append(el("h3", "", "Teaching aids"));
  heading.append(el("span", "settings-note", String(visibleCount) + " available"));
  section.append(heading);

  if (teachingAidMessage) {
    section.append(el("p", "settings-note", teachingAidMessage));
  }

  const list = el("div", "teaching-aid-list");
  for (const aid of TEACHING_AIDS) {
    const hidden = isHiddenTeachingAidId(aid.id);
    const row = el("div", "teaching-aid-row");
    const details = el("span", "teaching-aid-summary");
    details.append(
      el("strong", "", aid.title + (hidden ? " - hidden" : "")),
      el("span", "", aid.steps.map((step) => step.title).join(", "))
    );
    row.append(details);
    const view = commandButton("View", "secondary-action tiny-action", "video");
    view.addEventListener("click", () => previewTeachingAid(aid));
    row.append(view);
    if (hidden) {
      const restore = commandButton("Restore", "secondary-action tiny-action", "restore");
      restore.addEventListener("click", () => restoreTeachingAid(aid.id));
      row.append(restore);
    } else {
      const hide = commandButton("Hide", "danger-action tiny-action", "hide");
      hide.addEventListener("click", () => {
        if (!window.confirm("Hide " + aid.title + " teaching aid on this device?")) {
          return;
        }
        hideTeachingAid(aid);
      });
      row.append(hide);
    }
    list.append(row);
  }
  section.append(list);

  const restoreAll = commandButton("Restore hidden teaching aids", "secondary-action", "restore");
  restoreAll.disabled = save.settings.hiddenTeachingAidIds.length === 0;
  restoreAll.addEventListener("click", () => {
    save = {
      ...save,
      settings: {
        ...save.settings,
        hiddenTeachingAidIds: []
      }
    };
    persistSave();
    teachingAidMessage = "Hidden teaching aids restored.";
    render();
  });
  section.append(restoreAll);
  section.append(el("p", "settings-note", "Teaching aids are hidden on this device only; the authored catalog stays in the app."));
  return section;
}

function isHiddenTeachingAidId(id: string): boolean {
  return save.settings.hiddenTeachingAidIds.includes(id);
}

function hideTeachingAid(aid: TeachingAid): void {
  if (isHiddenTeachingAidId(aid.id)) {
    return;
  }
  save = {
    ...save,
    settings: {
      ...save.settings,
      hiddenTeachingAidIds: [...save.settings.hiddenTeachingAidIds, aid.id]
    }
  };
  if (activeTeachingAid?.aid.id === aid.id) {
    activeTeachingAid = null;
  }
  persistSave();
  teachingAidMessage = aid.title + " hidden.";
  void sendTeachingAidReport("hide", aid);
  render();
}

function restoreTeachingAid(id: string): void {
  const aid = TEACHING_AIDS.find((item) => item.id === id);
  save = {
    ...save,
    settings: {
      ...save.settings,
      hiddenTeachingAidIds: save.settings.hiddenTeachingAidIds.filter((item) => item !== id)
    }
  };
  persistSave();
  teachingAidMessage = (aid?.title ?? "Teaching aid") + " restored.";
  render();
}

async function sendTeachingAidReport(_action: "hide" | "delete", _aid: TeachingAid): Promise<void> {
  return Promise.resolve();
}

function createRewardMediaViewer(media: RewardMedia): HTMLElement {
  const viewer = el("section", "reward-media-viewer");
  let element: HTMLVideoElement | HTMLImageElement;
  if (media.type === "video") {
    const video = document.createElement("video");
    video.src = media.src;
    video.poster = media.poster ?? "";
    video.controls = !isGiphyMedia(media);
    video.autoplay = isGiphyMedia(media);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    element = video;
  } else {
    const image = document.createElement("img");
    image.src = media.src;
    image.alt = media.title;
    element = image;
  }
  const details = el("div", "reward-media-details");
  details.append(el("h4", "", media.title));
  details.append(el("p", "", mediaTypeLabel(media) + " - " + media.artist + " - " + media.license));
  const close = commandButton("Close", "secondary-action tiny-action", "close");
  close.addEventListener("click", () => {
    viewedRewardMediaId = null;
    rewardMediaMessage = "";
    render();
  });
  details.append(close);
  viewer.append(element, details);
  return viewer;
}

function rewardPreviewSrc(media: RewardMedia): string {
  return media.poster || media.src;
}

function mediaTypeLabel(media: RewardMedia): string {
  if (isGiphyMedia(media)) {
    return media.type === "video" ? "GIF" : "sticker";
  }
  return media.type === "video" ? "video" : "image";
}

function isHiddenRewardMediaId(id: string): boolean {
  return isHiddenRewardMediaIdForSettings(save.settings, id);
}

function hideRewardMedia(id: string): void {
  save = {
    ...save,
    settings: hideRewardMediaId(save.settings, id),
    revealedPieces: 0
  };
  persistSave();
}

function restoreRewardMedia(id: string): void {
  save = {
    ...save,
    settings: restoreRewardMediaId(save.settings, id),
    revealedPieces: 0
  };
  persistSave();
}

async function sendRewardMediaReport(_action: "hide" | "delete", _media: RewardMedia): Promise<void> {
  return Promise.resolve();
}

function updateGradeLane(gradeLane: GradeLane, enabled: boolean): void {
  const current = save.settings.gradeLanes;
  const next = enabled ? [...current, gradeLane] : current.filter((item) => item !== gradeLane);
  if (next.length === 0) {
    return;
  }
  updateSettings({
    gradeLanes: next,
    enabledOperations: enabled ? uniqueOperations([...save.settings.enabledOperations, ...operationsForGradeLane(gradeLane)]) : save.settings.enabledOperations
  });
}

function getSavedPathProgress(path: PathId): PathProgress | null {
  const progress = save.pathProgress[pathProgressKey(path, gradeLaneForPath(path))];
  if (!progress || progress.correct >= save.settings.sessionLength) {
    return bestSavedPathProgress(save.pathProgress, path, save.settings.sessionLength);
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

function pathProgressKey(path: PathId, gradeLane: MathSettings["gradeLane"]): string {
  return sessionPathProgressKey(path, save.settings, gradeLane);
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
  const submit = commandButton("Check", "primary-action keypad-submit", "check");
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

function workbenchHandoffBaseUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_WORKBENCH_HANDOFF_URL?: string } }).env;
  return env?.VITE_WORKBENCH_HANDOFF_URL?.trim() ?? "";
}

function workbenchHandoffUrlForPrompt(prompt: MathPrompt, path: PathId): string | null {
  if (!WORKBENCH_HANDOFF_BASE_URL) {
    return null;
  }
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(WORKBENCH_HANDOFF_BASE_URL, window.location.origin);
  url.searchParams.set("handoff", "1");
  url.searchParams.set("question", prompt.question);
  url.searchParams.set("returnTo", handoffReturnUrl(path));

  if (prompt.visualArray) {
    url.searchParams.set("mode", "multiply");
    url.searchParams.set("rows", String(prompt.visualArray.rows));
    url.searchParams.set("columns", String(prompt.visualArray.columns));
    return url.href;
  }

  if (prompt.visualGroups?.length) {
    const groupSize = prompt.visualGroups[0] ?? 0;
    const equalGroups = prompt.visualGroups.every((size) => size === groupSize);
    if (groupSize > 0 && equalGroups) {
      url.searchParams.set("mode", "multiply");
      url.searchParams.set("rows", String(prompt.visualGroups.length));
      url.searchParams.set("columns", String(groupSize));
      return url.href;
    }
  }

  if (prompt.operation === "multiply" && prompt.metadata.left && prompt.metadata.right) {
    url.searchParams.set("mode", "multiply");
    url.searchParams.set("rows", String(prompt.metadata.left));
    url.searchParams.set("columns", String(prompt.metadata.right));
    return url.href;
  }

  if (prompt.operation === "divide" && prompt.metadata.left && prompt.metadata.right) {
    url.searchParams.set("mode", "divide");
    url.searchParams.set("total", String(prompt.metadata.left));
    url.searchParams.set("groups", String(prompt.metadata.right));
    return url.href;
  }

  const compareModels = prompt.visualCompare
    ? [prompt.visualCompare.left, prompt.visualCompare.right]
    : prompt.visualEquivalent?.models ?? null;
  if (compareModels) {
    url.searchParams.set("mode", "compare");
    appendWorkbenchComparePart(url, "a", compareModels[0]);
    appendWorkbenchComparePart(url, "b", compareModels[1]);
    return url.href;
  }

  if (prompt.visualPart?.kind === "fraction") {
    url.searchParams.set("mode", "fraction");
    url.searchParams.set("numerator", String(prompt.visualPart.colored));
    url.searchParams.set("denominator", String(prompt.visualPart.total));
    return url.href;
  }

  if (prompt.visualPart?.kind === "decimal") {
    url.searchParams.set("mode", "decimal");
    url.searchParams.set("hundredths", String(partAsHundredths(prompt.visualPart)));
    return url.href;
  }

  return null;
}

function handoffReturnUrl(path: PathId): string {
  const url = new URL(window.location.href);
  url.searchParams.set("resumePath", path);
  return url.pathname + url.search + url.hash;
}

function restoreHandoffReturn(): void {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const resumePath = parsePathId(params.get("resumePath"));
  if (!resumePath) {
    return;
  }
  const savedProgress = getSavedPathProgress(resumePath);
  if (savedProgress) {
    session = createSessionState({
      path: resumePath,
      settings: save.settings,
      seed: savedProgress.seed,
      savedProgress
    });
    screen = "play";
    feedback = "Back from the workbench.";
  }
  params.delete("resumePath");
  const cleanSearch = params.toString();
  const nextUrl = window.location.pathname + (cleanSearch ? "?" + cleanSearch : "") + window.location.hash;
  window.history.replaceState(null, "", nextUrl);
}

function parsePathId(value: string | null): PathId | null {
  const paths: PathId[] = ["count", "add", "subtract", "placeValue", "skipCount", "groups", "times", "divide", "arrays", "fractions", "decimals", "mix"];
  return value && paths.includes(value as PathId) ? value as PathId : null;
}

function appendWorkbenchComparePart(url: URL, prefix: "a" | "b", part: PartModel): void {
  const label = part.label ?? partModelLabel(part);
  url.searchParams.set(prefix + "Kind", part.kind);
  url.searchParams.set(prefix + "Label", label);
  if (part.kind === "fraction") {
    url.searchParams.set(prefix + "Numerator", String(part.colored));
    url.searchParams.set(prefix + "Denominator", String(part.total));
    return;
  }
  url.searchParams.set(prefix + "Hundredths", String(partAsHundredths(part)));
}

function partAsHundredths(part: PartModel): number {
  if (part.total === 100) {
    return part.colored;
  }
  if (part.total === 10) {
    return part.colored * 10;
  }
  return Math.max(0, Math.min(100, Math.round((part.colored / part.total) * 100)));
}

function partModelLabel(part: PartModel): string {
  if (part.kind === "fraction") {
    return String(part.colored) + "/" + String(part.total);
  }
  if (part.total === 10) {
    return "0." + String(part.colored);
  }
  if (part.total === 100) {
    return "0." + String(part.colored).padStart(2, "0");
  }
  return (part.colored / part.total).toFixed(2);
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

function stepperControl(labelText: string, value: number, min: number, max: number, onChange: (value: number) => void): HTMLElement {
  const wrapper = el("div", "text-control");
  const label = el("span", "", labelText);
  const labelId = "control-" + labelText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  label.id = labelId;
  const controls = el("span", "stepper-control");
  const decrement = buttonEl("-", "stepper-button");
  decrement.setAttribute("aria-label", "Decrease " + labelText);
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  input.readOnly = true;
  input.setAttribute("aria-labelledby", labelId);
  const increment = buttonEl("+", "stepper-button");
  increment.setAttribute("aria-label", "Increase " + labelText);
  const update = (next: number) => {
    const bounded = Math.max(min, Math.min(max, next));
    if (bounded !== value) {
      onChange(bounded);
    }
  };
  decrement.disabled = value <= min;
  increment.disabled = value >= max;
  decrement.addEventListener("click", () => update(value - 1));
  increment.addEventListener("click", () => update(value + 1));
  controls.append(decrement, input, increment);
  wrapper.append(label, controls);
  return wrapper;
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

function commandButton(label: string, className: string, icon: CommandIcon, ariaLabel = label): HTMLButtonElement {
  const button = buttonEl("", className + " math-command");
  button.setAttribute("aria-label", ariaLabel);
  button.append(commandLabel(icon, label));
  return button;
}

function commandLabel(icon: CommandIcon, label: string): HTMLElement {
  const wrapper = el("span", "math-command-label");
  wrapper.append(commandIcon(icon), el("span", "math-command-text", label));
  return wrapper;
}

function commandIcon(icon: CommandIcon): HTMLElement {
  const span = el("span", "math-command-icon");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = commandIconSvg(icon);
  return span;
}

function setCommandCount(container: HTMLElement): void {
  container.style.setProperty("--math-command-count", String(container.children.length));
  container.classList.toggle("is-dense", container.children.length > 2);
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
