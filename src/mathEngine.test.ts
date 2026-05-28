import { describe, expect, it } from "vitest";
import { validateInstructionAudioManifest } from "./instructionAudio";
import { buildChoices, createSeededRandom, eligiblePaths, generatePrompt, normalizeSettings, validateAnswer } from "./mathEngine";
import { getActiveReward, hideRewardMediaId, REVEAL_PIECES, restoreRewardMediaId, visibleRewardMedia } from "./rewardProgress";
import { REWARD_MEDIA } from "./rewardMedia";
import { normalizeHiddenRewardMediaIds, normalizeRewardThemeId, REWARD_THEMES, rewardThemeById } from "./rewardThemes";
import { DEFAULT_SAVE, canUseStorage, getLastLoadSaveStatus, loadSave, pathProgressKeyFor, resetSave, saveGame } from "./save";
import { bestSavedPathProgress, createSessionState, evaluateAnswer, markHelpUsed, pathProgressKey, removeSavedPathProgress, toPathProgress } from "./sessionFlow";
import { TEACHING_AIDS, teachingAidForPrompt, teachingAidStepMedia } from "./teachingAids";
import { teachingAidStepAudioSrc, validateTeachingAidAudioManifest } from "./teachingAidAudio";
import teachingManifestData from "./teachingAidAudioManifest.json";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  get length(): number {
    throw new Error("storage blocked");
  }
  clear(): void {
    throw new Error("storage blocked");
  }
  getItem(): string | null {
    throw new Error("storage blocked");
  }
  key(): string | null {
    throw new Error("storage blocked");
  }
  removeItem(): void {
    throw new Error("storage blocked");
  }
  setItem(): void {
    throw new Error("storage blocked");
  }
}

describe("Math to Reveal engine", () => {
  it("generates deterministic addition prompts within first-grade bounds", () => {
    const settings = normalizeSettings({ gradeLane: "grade1", maxAddend: 10, maxAnswer: 20 });
    const first = generatePrompt({ path: "add", settings, promptIndex: 0, random: createSeededRandom(12) });
    const second = generatePrompt({ path: "add", settings, promptIndex: 0, random: createSeededRandom(12) });

    expect(first).toEqual(second);
    expect(first.operation).toBe("add");
    expect(first.metadata.answer).toBe((first.metadata.left ?? 0) + (first.metadata.right ?? 0));
    expect(first.metadata.answer).toBeLessThanOrEqual(20);
    expect(validateAnswer(first, first.metadata.answer)).toBe(true);
  });

  it("keeps instruction audio manifest valid", () => {
    expect(validateInstructionAudioManifest()).toEqual([]);
    expect(validateTeachingAidAudioManifest()).toEqual([]);
    const manifest = teachingManifestData as { entries: Array<{ id: string; text: string; src: string }> };
    for (const aid of TEACHING_AIDS) {
      for (const step of aid.steps) {
        const src = teachingAidStepAudioSrc(aid, step);
        if (manifest.entries.length === 0) {
          expect(src).toBeNull();
        } else {
          expect(src).toMatch(/^\/audio\/math\/teaching\/.+\.wav$/);
        }
      }
    }
  });

  it("generates subtraction prompts without negative answers", () => {
    const settings = normalizeSettings({ gradeLane: "grade1", maxAnswer: 20 });
    for (let seed = 1; seed <= 20; seed += 1) {
      const prompt = generatePrompt({ path: "subtract", settings, promptIndex: seed, random: createSeededRandom(seed) });
      expect(prompt.operation).toBe("subtract");
      expect(prompt.metadata.answer).toBeGreaterThanOrEqual(0);
      expect(prompt.metadata.answer).toBe((prompt.metadata.left ?? 0) - (prompt.metadata.right ?? 0));
    }
  });

  it("keeps kindergarten paths visual and bounded", () => {
    const settings = normalizeSettings({ gradeLane: "kindergarten", maxAnswer: 10, enabledOperations: ["count", "add"] });
    expect(eligiblePaths(settings)).toEqual(["count", "add", "mix"]);
    const prompt = generatePrompt({ path: "count", settings, promptIndex: 0, random: createSeededRandom(4) });
    expect(prompt.visualCount).toBeGreaterThanOrEqual(1);
    expect(prompt.visualCount).toBeLessThanOrEqual(10);
    expect(prompt.choices).toContain(prompt.metadata.answer);
  });

  it("builds unique multiple-choice distractors around the answer", () => {
    const choices = buildChoices(7, 0, 20, createSeededRandom(3));
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices).toContain(7);
    expect(choices).toHaveLength(4);
  });

  it("normalizes settings and persists versioned local progress", () => {
    const storage = new MemoryStorage();
    expect(loadSave(storage)).toEqual(DEFAULT_SAVE);

    const save = {
      ...DEFAULT_SAVE,
      completedPrompts: 3,
      completedSessions: 1,
      revealedPieces: 3,
      bestStreak: 2,
      settings: normalizeSettings({ gradeLane: "kindergarten", enabledOperations: ["count"], sessionLength: 4 })
    };
    saveGame(storage, save);

    expect(loadSave(storage).settings.gradeLane).toBe("kindergarten");
    expect(loadSave(storage).settings.gradeLanes).toEqual(["kindergarten"]);
    expect(loadSave(storage).completedPrompts).toBe(3);
    expect(loadSave(storage).pathProgress).toEqual({});
    expect(resetSave(storage, save.settings).completedPrompts).toBe(0);
    expect(loadSave(storage).settings.enabledOperations).toEqual(["count"]);
    expect(loadSave(storage).settings.attemptsToReward).toBe(2);
    expect(normalizeSettings({ attemptsToReward: -1 }).attemptsToReward).toBe(0);
    expect(normalizeSettings({ attemptsToReward: 99 }).attemptsToReward).toBe(3);
    expect(normalizeSettings({ seenTeachingAidIds: ["addition-within-20", "bad", "addition-within-20"] }).seenTeachingAidIds).toEqual(["addition-within-20"]);
    expect(normalizeSettings({ hiddenTeachingAidIds: ["fraction-parts", "bad"] }).hiddenTeachingAidIds).toEqual(["fraction-parts"]);
  });

  it("normalizes reward themes for local and GIPHY-backed rewards", () => {
    expect(normalizeSettings({ rewardTheme: "dinosaurs" }).rewardTheme).toBe("dinosaurs");
    expect(normalizeSettings({ rewardTheme: "starWars" }).rewardTheme).toBe("starWars");
    expect(normalizeSettings({ hiddenRewardMediaIds: ["giphy-a", "bad", "giphy-a"] }).hiddenRewardMediaIds).toEqual(["giphy-a"]);
    expect(normalizeSettings({ rewardTheme: "bad" as never }).rewardTheme).toBe("kittens");
    expect(rewardThemeById("dinosaurs").label).toBe("Dinosaurs");
    expect(normalizeRewardThemeId("bad")).toBe("kittens");
    expect(REWARD_THEMES.find((theme) => theme.id === "dinosaurs")?.giphyIds).toHaveLength(10);
    expect(REWARD_THEMES.find((theme) => theme.id === "dinosaurStickers")?.giphyKind).toBe("sticker");
    expect(REWARD_THEMES.find((theme) => theme.id === "starWars")?.giphyIds).toHaveLength(10);
    expect(REWARD_THEMES.find((theme) => theme.id === "monsterTrucks")?.giphyIds).toHaveLength(10);
    expect(REWARD_THEMES.find((theme) => theme.id === "constructionEquipment")?.giphyIds).toHaveLength(10);
    expect(REWARD_THEMES.find((theme) => theme.id === "bugs")?.giphyIds).toHaveLength(10);
    expect(normalizeHiddenRewardMediaIds(["giphy-a", "nope", "giphy-a", "giphy-b"])).toEqual(["giphy-a", "giphy-b"]);
  });

  it("handles corrupted and partial localStorage saves", () => {
    const corrupted = new MemoryStorage();
    corrupted.setItem("math-to-reveal-save-v1", "not-json");
    expect(loadSave(corrupted)).toEqual(DEFAULT_SAVE);
    expect(getLastLoadSaveStatus()).toBe("corrupt-recovered");
    expect(corrupted.getItem("math-to-reveal-save-v1")).toBeNull();
    expect(Array.from({ length: corrupted.length }, (_, index) => corrupted.key(index)).some((key) => key?.startsWith("math-to-reveal-save-v1-broken-"))).toBe(true);

    const partial = new MemoryStorage();
    partial.setItem("math-to-reveal-save-v1", JSON.stringify({
      completedPrompts: "4",
      revealedPieces: 2,
      settings: {
        gradeLane: "grade2",
        enabledOperations: ["add"],
        maxAnswer: 5
      },
      pathProgress: {
        broken: { path: "unknown", gradeLane: "grade9" }
      }
    }));

    const loaded = loadSave(partial);
    expect(loaded.completedPrompts).toBe(4);
    expect(loaded.revealedPieces).toBe(2);
    expect(loaded.settings.gradeLane).toBe("grade2");
    expect(loaded.settings.maxAnswer).toBe(20);
    expect(loaded.pathProgress).toEqual({});
  });

  it("keeps gameplay usable when browser storage throws", () => {
    const storage = new ThrowingStorage();

    expect(canUseStorage(storage)).toBe(false);
    expect(loadSave(storage)).toEqual(DEFAULT_SAVE);
    expect(getLastLoadSaveStatus()).toBe("storage-unavailable");
    expect(saveGame(storage, { ...DEFAULT_SAVE, completedPrompts: 1 })).toBe(false);
    expect(resetSave(storage, DEFAULT_SAVE.settings)).toEqual(DEFAULT_SAVE);
  });

  it("uses a stable progress key for mixed sessions across prompt grades", () => {
    const settings = normalizeSettings({
      gradeLanes: ["grade1", "grade2", "grade4"],
      enabledOperations: ["add", "placeValue", "fraction"],
      decimalPlace: "tenths"
    });

    expect(pathProgressKeyFor("mix", settings, "grade1")).toBe(pathProgressKeyFor("mix", settings, "grade4"));
    expect(pathProgressKeyFor("mix", settings, "grade2")).toContain("grade1+grade2+grade4");
    expect(pathProgressKeyFor("add", settings, "grade1")).not.toBe(pathProgressKeyFor("add", settings, "grade2"));
  });

  it("adds grade 2 paths and keypad prompts without regrouping by default", () => {
    const settings = normalizeSettings({ gradeLane: "grade2" });
    expect(eligiblePaths(settings)).toEqual(["add", "subtract", "placeValue", "skipCount", "groups", "mix"]);

    for (let seed = 1; seed <= 20; seed += 1) {
      const prompt = generatePrompt({ path: "add", settings, promptIndex: seed, random: createSeededRandom(seed) });
      const left = prompt.metadata.left ?? 0;
      const right = prompt.metadata.right ?? 0;
      expect(prompt.inputMode).toBe("keypad");
      expect((left % 10) + (right % 10)).toBeLessThanOrEqual(9);
      expect(prompt.metadata.answer).toBe(left + right);
    }
  });

  it("raises invalid grade 2 max-answer settings before generating two-digit prompts", () => {
    const settings = normalizeSettings({ gradeLane: "grade2", maxAnswer: 5, maxAddend: 3 });

    expect(settings.maxAnswer).toBe(20);
    for (let seed = 1; seed <= 20; seed += 1) {
      const addition = generatePrompt({ path: "add", settings, promptIndex: seed, random: createSeededRandom(seed) });
      const subtraction = generatePrompt({ path: "subtract", settings, promptIndex: seed, random: createSeededRandom(seed + 100) });
      expect(addition.metadata.answer).toBeLessThanOrEqual(settings.maxAnswer);
      expect(subtraction.metadata.left).toBeLessThanOrEqual(settings.maxAnswer);
      expect(subtraction.metadata.answer).toBeLessThanOrEqual(settings.maxAnswer);
    }
  });

  it("keeps grade 3 focused on multiplication, division, and arrays", () => {
    const defaultGrade3 = normalizeSettings({ gradeLane: "grade3" });
    expect(eligiblePaths(defaultGrade3)).toEqual(["times", "divide", "arrays", "mix"]);

    const division = generatePrompt({ path: "divide", settings: defaultGrade3, promptIndex: 0, random: createSeededRandom(7) });
    expect(division.operation).toBe("divide");
    expect(division.inputMode).toBe("keypad");
    expect(validateAnswer(division, division.metadata.answer)).toBe(true);
  });

  it("adds grade 4 fraction and decimal visual models with varied answer types", () => {
    const settings = normalizeSettings({
      gradeLane: "grade4",
      enabledOperations: ["fraction", "decimal"],
      fractionModes: ["match", "compare", "equivalent", "addSubtract"],
      decimalModes: ["match", "compare", "equivalent", "addSubtract"],
      decimalPlace: "hundredths"
    });
    expect(eligiblePaths(settings)).toEqual(["fractions", "decimals", "mix"]);
    expect(settings.enableFractions).toBe(true);
    expect(settings.enableDecimals).toBe(true);

    const prompts = Array.from({ length: 8 }, (_, index) => generatePrompt({
      path: index % 2 === 0 ? "fractions" : "decimals",
      settings,
      promptIndex: index,
      random: createSeededRandom(20 + index)
    }));

    expect(prompts.some((prompt) => prompt.visualPart || prompt.visualCompare || prompt.visualEquivalent || prompt.visualOperation)).toBe(true);
    expect(prompts.every((prompt) => validateAnswer(prompt, prompt.metadata.answer))).toBe(true);
    expect(prompts.some((prompt) => typeof prompt.metadata.answer === "string")).toBe(true);
    expect(prompts.some((prompt) => prompt.operation === "decimal" && prompt.metadata.decimalPlace === "hundredths")).toBe(true);
    expect(prompts.some((prompt) => prompt.audioInstructionId)).toBe(true);
  });

  it("keeps generated part models internally valid across fractions and decimals", () => {
    const settings = normalizeSettings({
      gradeLane: "grade4",
      enabledOperations: ["fraction", "decimal"],
      fractionModes: ["name", "match", "compare", "equivalent", "addSubtract"],
      decimalModes: ["name", "match", "compare", "equivalent", "addSubtract"],
      decimalPlace: "tenths"
    });

    for (let seed = 1; seed <= 200; seed += 1) {
      const prompt = generatePrompt({
        path: seed % 2 === 0 ? "fractions" : "decimals",
        settings,
        promptIndex: seed,
        random: createSeededRandom(seed)
      });
      expect(validateAnswer(prompt, prompt.metadata.answer)).toBe(true);
      for (const part of partModels(prompt)) {
        expect(part.colored).toBeGreaterThanOrEqual(0);
        expect(part.colored).toBeLessThanOrEqual(part.total);
        expect(part.total).toBeGreaterThan(0);
      }
      if (prompt.operation === "decimal" && prompt.metadata.mode === "addSubtract") {
        expect(prompt.visualOperation).toBeDefined();
        expect(prompt.visualOperation?.result.colored ?? 0).toBeLessThan(prompt.visualOperation?.result.total ?? 0);
      }
    }
  });

  it("combines selected grade lanes into one child path set", () => {
    const settings = normalizeSettings({ gradeLanes: ["grade1", "grade2", "grade4"] });

    expect(settings.gradeLane).toBe("grade4");
    expect(settings.gradeLanes).toEqual(["grade1", "grade2", "grade4"]);
    expect(eligiblePaths(settings)).toEqual(["add", "subtract", "placeValue", "skipCount", "groups", "fractions", "decimals", "mix"]);

    const grade2Add = generatePrompt({ path: "add", settings, promptIndex: 0, random: createSeededRandom(11) });
    expect(grade2Add.gradeLane).toBe("grade2");
    expect(grade2Add.inputMode).toBe("keypad");

    const fraction = generatePrompt({ path: "fractions", settings, promptIndex: 1, random: createSeededRandom(12) });
    expect(fraction.gradeLane).toBe("grade4");
  });

  it("avoids repeating exact grade 4 fraction and decimal prompts while choices remain", () => {
    const settings = normalizeSettings({
      gradeLane: "grade4",
      enabledOperations: ["decimal"],
      decimalModes: ["name"],
      decimalPlace: "tenths"
    });
    const first = generatePrompt({ path: "decimals", settings, promptIndex: 0, random: createSeededRandom(9) });
    const second = generatePrompt({
      path: "decimals",
      settings,
      promptIndex: 1,
      random: createSeededRandom(9),
      recentPromptIds: [first.id]
    });

    expect(second.id).not.toBe(first.id);
  });

  it("migrates current saved progress while adding new conservative settings", () => {
    const storage = new MemoryStorage();
    storage.setItem("math-to-reveal-save-v1", JSON.stringify({
      version: 1,
      completedPrompts: 11,
      completedSessions: 2,
      revealedPieces: 7,
      bestStreak: 4,
      settings: {
        gradeLane: "grade1",
        enabledOperations: ["add", "subtract"],
        maxAddend: 10,
        maxAnswer: 20,
        sessionLength: 5,
        reducedMotion: false
      }
    }));

    const migrated = loadSave(storage);
    expect(migrated.version).toBe(5);
    expect(migrated.completedPrompts).toBe(11);
    expect(migrated.revealedPieces).toBe(7);
    expect(migrated.pathProgress).toEqual({});
    expect(migrated.settings.enableFractions).toBe(false);
    expect(migrated.settings.enableDecimals).toBe(false);
    expect(migrated.settings.allowRegrouping).toBe(false);
    expect(migrated.settings.gradeLanes).toEqual(["grade1"]);
  });

  it("normalizes unfinished path progress and clears it on reset", () => {
    const storage = new MemoryStorage();
    const save = {
      ...DEFAULT_SAVE,
      pathProgress: {
        "grade1:add": {
          path: "add" as const,
          gradeLane: "grade1" as const,
          promptIndex: 2,
          seed: 123,
          correct: 2,
          mistakes: 1,
          streak: 2,
          answeredPromptIds: ["add-0-1-1"]
        }
      }
    };
    saveGame(storage, save);

    expect(loadSave(storage).pathProgress["grade1:add"]?.correct).toBe(2);
    expect(loadSave(storage).pathProgress["grade1:add"]?.answeredPromptIds).toEqual(["add-0-1-1"]);
    resetSave(storage, save.settings);
    expect(loadSave(storage).pathProgress).toEqual({});
  });

  it("computes answer outcomes and session advancement without DOM state", () => {
    const settings = normalizeSettings({ gradeLane: "grade1", enabledOperations: ["add"], sessionLength: 3 });
    const session = createSessionState({ path: "add", settings, savedProgress: null, seed: 22 });
    const wrong = evaluateAnswer({
      session,
      answer: -1,
      settings,
      completedPrompts: 4,
      revealedPieces: 2,
      bestStreak: 1,
      revealPieces: REVEAL_PIECES,
      correctFeedback: ["Correct"],
      nudgeFeedback: ["Try again"]
    });

    expect(wrong.kind).toBe("incorrect");
    expect(wrong.session.mistakes).toBe(1);
    expect(wrong.session.streak).toBe(0);
    expect(wrong.session.promptAttempts).toBe(1);
    expect(wrong.session.keypadValue).toBe("");
    expect(wrong.helpAvailable).toBe(true);
    expect(wrong.supportContext.operation).toBe("add");

    const correct = evaluateAnswer({
      session,
      answer: session.currentPrompt.metadata.answer,
      settings,
      completedPrompts: 4,
      revealedPieces: 2,
      bestStreak: 1,
      revealPieces: REVEAL_PIECES,
      correctFeedback: ["Correct"],
      nudgeFeedback: ["Try again"]
    });

    expect(correct.kind).toBe("correct");
    if (correct.kind !== "correct") {
      throw new Error("expected correct answer result");
    }
    expect(correct.completedPrompts).toBe(5);
    expect(correct.revealedPieces).toBe(3);
    expect(correct.lastRewardPiece).toBe(2);
    expect(correct.completionQuality).toBe("clean");
    expect(correct.bestStreak).toBe(1);
    expect(correct.completedSession).toBe(false);
    expect(correct.session.promptIndex).toBe(1);
    expect(correct.session.promptAttempts).toBe(0);
    expect(correct.session.answeredPromptIds).toContain(session.currentPrompt.id);
  });

  it("marks repeated-miss completions helped without reward or mastery credit", () => {
    const settings = normalizeSettings({ gradeLane: "grade1", enabledOperations: ["add"], attemptsToReward: 1 });
    const session = createSessionState({ path: "add", settings, savedProgress: null, seed: 42 });
    const firstMiss = evaluateAnswer({
      session,
      answer: -1,
      settings,
      completedPrompts: 7,
      revealedPieces: 4,
      bestStreak: 3,
      revealPieces: REVEAL_PIECES,
      correctFeedback: ["Correct"],
      nudgeFeedback: ["Try another way."]
    });
    expect(firstMiss.kind).toBe("incorrect");
    if (firstMiss.kind !== "incorrect") {
      throw new Error("expected first miss");
    }
    const secondMiss = evaluateAnswer({
      session: firstMiss.session,
      answer: -2,
      settings,
      completedPrompts: 7,
      revealedPieces: 4,
      bestStreak: 3,
      revealPieces: REVEAL_PIECES,
      correctFeedback: ["Correct"],
      nudgeFeedback: ["Try another way."]
    });
    expect(secondMiss.kind).toBe("incorrect");
    if (secondMiss.kind !== "incorrect") {
      throw new Error("expected second miss");
    }
    expect(secondMiss.attempts).toBe(2);
    expect(secondMiss.feedback).toBe("Pause and check the numbers.");

    const helped = evaluateAnswer({
      session: secondMiss.session,
      answer: session.currentPrompt.metadata.answer,
      settings,
      completedPrompts: 7,
      revealedPieces: 4,
      bestStreak: 3,
      revealPieces: REVEAL_PIECES,
      correctFeedback: ["Correct"],
      nudgeFeedback: ["Try another way."]
    });

    expect(helped.kind).toBe("correct");
    if (helped.kind !== "correct") {
      throw new Error("expected helped completion");
    }
    expect(helped.completionQuality).toBe("helped");
    expect(helped.completedPrompts).toBe(7);
    expect(helped.revealedPieces).toBe(4);
    expect(helped.bestStreak).toBe(3);
    expect(helped.lastRewardPiece).toBe(-1);
    expect(helped.session.streak).toBe(0);
    expect(helped.session.promptIndex).toBe(1);
  });

  it("applies attempts-to-reward thresholds across the four-choice range", () => {
    for (const attemptsToReward of [0, 1, 2, 3]) {
      for (const misses of [0, 1, 2, 3]) {
        const settings = normalizeSettings({ gradeLane: "grade1", enabledOperations: ["add"], attemptsToReward });
        let session = createSessionState({ path: "add", settings, savedProgress: null, seed: 100 + attemptsToReward * 10 + misses });
        for (let index = 0; index < misses; index += 1) {
          const miss = evaluateAnswer({
            session,
            answer: -1 - index,
            settings,
            completedPrompts: 0,
            revealedPieces: 0,
            bestStreak: 0,
            revealPieces: REVEAL_PIECES,
            correctFeedback: ["Correct"],
            nudgeFeedback: ["Try another way."]
          });
          if (miss.kind !== "incorrect") {
            throw new Error("expected miss");
          }
          session = miss.session;
        }
        const result = evaluateAnswer({
          session,
          answer: session.currentPrompt.metadata.answer,
          settings,
          completedPrompts: 0,
          revealedPieces: 0,
          bestStreak: 0,
          revealPieces: REVEAL_PIECES,
          correctFeedback: ["Correct"],
          nudgeFeedback: ["Try another way."]
        });
        if (result.kind !== "correct") {
          throw new Error("expected correct");
        }
        const clean = misses <= attemptsToReward;
        expect(result.completionQuality, `AtoR ${attemptsToReward}, misses ${misses}`).toBe(clean ? "clean" : "helped");
        expect(result.completedPrompts).toBe(clean ? 1 : 0);
        expect(result.revealedPieces).toBe(clean ? 1 : 0);
      }
    }
  });

  it("looks up local teaching aids and suppresses hidden aids", () => {
    expect(TEACHING_AIDS.map((aid) => aid.id)).toContain("counting-small-groups");

    const addSettings = normalizeSettings({ gradeLane: "grade1", enabledOperations: ["add"] });
    const addPrompt = generatePrompt({ path: "add", settings: addSettings, promptIndex: 0, random: createSeededRandom(18) });
    expect(teachingAidForPrompt(addPrompt, addSettings)?.id).toBe("addition-within-20");
    expect(teachingAidForPrompt(addPrompt, normalizeSettings({ ...addSettings, hiddenTeachingAidIds: ["addition-within-20"] }))).toBeNull();

    const fractionSettings = normalizeSettings({ gradeLane: "grade4", enabledOperations: ["fraction"], fractionModes: ["name"] });
    const fractionPrompt = generatePrompt({ path: "fractions", settings: fractionSettings, promptIndex: 0, random: createSeededRandom(19) });
    expect(teachingAidForPrompt(fractionPrompt, fractionSettings)?.id).toBe("fraction-parts");

    const decimalSettings = normalizeSettings({ gradeLane: "grade4", enabledOperations: ["decimal"], decimalModes: ["name"] });
    const decimalPrompt = generatePrompt({ path: "decimals", settings: decimalSettings, promptIndex: 0, random: createSeededRandom(20) });
    expect(teachingAidForPrompt(decimalPrompt, decimalSettings)?.id).toBe("decimal-place-value");
  });

  it("keeps every teaching-aid step paired with a local graphic", () => {
    for (const aid of TEACHING_AIDS) {
      for (const step of aid.steps) {
        expect(step.media?.length, aid.id + " " + step.kind).toBeGreaterThan(0);
        const graphic = step.media?.find((media) => media.kind === "image");
        expect(graphic?.src, aid.id + " " + step.kind).toMatch(/^data:image\/svg\+xml,/);
        expect(graphic?.alt, aid.id + " " + step.kind).toBeTruthy();
        const previewGraphic = teachingAidStepMedia(aid, step, null, true).find((media) => media.kind === "image");
        expect(previewGraphic?.alt, aid.id + " " + step.kind).toMatch(/^Example:/);
        expect(previewGraphic?.caption, aid.id + " " + step.kind).toMatch(/Example picture/);
      }
    }
  });

  it("renders prompt-aware teaching-aid graphics for active math prompts", () => {
    const addSettings = normalizeSettings({ gradeLane: "grade1", enabledOperations: ["add"] });
    const addPrompt = {
      ...generatePrompt({ path: "add", settings: addSettings, promptIndex: 0, random: createSeededRandom(18) }),
      question: "7 + 0 = ?",
      metadata: {
        ...generatePrompt({ path: "add", settings: addSettings, promptIndex: 0, random: createSeededRandom(18) }).metadata,
        left: 7,
        right: 0,
        answer: 7
      }
    };
    const addAid = TEACHING_AIDS.find((aid) => aid.id === "addition-within-20");
    const addCheck = addAid?.steps.find((step) => step.kind === "check");
    expect(addCheck?.prompts.join(" ")).toContain("add zero");
    const addSvg = decodeDataSvg(teachingAidStepMedia(addAid!, addCheck!, addPrompt)[0].src);
    expect(addSvg).toContain("Adding zero keeps");
    expect(addSvg).not.toMatch(/bigger than both/i);

    const skipSettings = normalizeSettings({ gradeLane: "grade2", enabledOperations: ["skipCount"] });
    const skipPrompt = {
      ...generatePrompt({ path: "skipCount", settings: skipSettings, promptIndex: 0, random: createSeededRandom(4) }),
      question: "6, 8, ?, 12",
      metadata: {
        ...generatePrompt({ path: "skipCount", settings: skipSettings, promptIndex: 0, random: createSeededRandom(4) }).metadata,
        step: 2,
        answer: 10
      }
    };
    const skipAid = TEACHING_AIDS.find((aid) => aid.id === "skip-count-patterns");
    const skipSvg = decodeDataSvg(teachingAidStepMedia(skipAid!, skipAid!.steps[0], skipPrompt)[0].src);
    expect(skipSvg).toContain("+2");
    expect(skipSvg).not.toContain("+5");

    const divideSettings = normalizeSettings({ gradeLane: "grade3", enabledOperations: ["divide"] });
    const dividePrompt = generatePrompt({ path: "divide", settings: divideSettings, promptIndex: 0, random: createSeededRandom(7) });
    const groupsAid = TEACHING_AIDS.find((aid) => aid.id === "groups-arrays");
    const divideSvg = decodeDataSvg(teachingAidStepMedia(groupsAid!, groupsAid!.steps[0], dividePrompt)[0].src);
    expect(divideSvg).toMatch(/Share into equal groups|Use the fact family/);

    const tenthsSettings = normalizeSettings({ gradeLane: "grade4", enabledOperations: ["decimal"], decimalModes: ["name"], decimalPlace: "tenths" });
    const tenthsPrompt = generatePrompt({ path: "decimals", settings: tenthsSettings, promptIndex: 0, random: createSeededRandom(20) });
    const decimalAid = TEACHING_AIDS.find((aid) => aid.id === "decimal-place-value");
    const tenthsSvg = decodeDataSvg(teachingAidStepMedia(decimalAid!, decimalAid!.steps[2], tenthsPrompt)[0].src);
    expect(tenthsSvg).toContain("tenths");
    expect(tenthsSvg).not.toContain("hundredths");

    const fractionSettings = normalizeSettings({ gradeLane: "grade4", enabledOperations: ["fraction"], fractionModes: ["equivalent"] });
    const fractionPrompt = generatePrompt({ path: "fractions", settings: fractionSettings, promptIndex: 0, random: createSeededRandom(12) });
    const fractionAid = TEACHING_AIDS.find((aid) => aid.id === "fraction-parts");
    const fractionSvg = decodeDataSvg(teachingAidStepMedia(fractionAid!, fractionAid!.steps[1], fractionPrompt)[0].src);
    expect(fractionSvg).toContain("Compare the amount");
  });

  it("keeps teaching-aid wording focused on learning quality", () => {
    const banned = [/bigger than both/i, /word shape/i, /high score/i, /score penalty/i, /punishment/i];
    for (const aid of TEACHING_AIDS) {
      for (const step of aid.steps) {
        const text = [
          aid.title,
          aid.buttonLabel,
          ...step.prompts,
          ...(step.media ?? []).flatMap((media) => [media.alt ?? "", media.caption ?? ""])
        ].join(" ");
        for (const phrase of banned) {
          expect(text, aid.id + " " + step.kind).not.toMatch(phrase);
        }
      }
    }
  });

  it("keeps teaching-aid completions eligible for reward and mastery credit", () => {
    const settings = normalizeSettings({ gradeLane: "grade1", enabledOperations: ["add"], attemptsToReward: 3 });
    const session = markHelpUsed(createSessionState({ path: "add", settings, savedProgress: null, seed: 55 }));
    const result = evaluateAnswer({
      session,
      answer: session.currentPrompt.metadata.answer,
      settings,
      completedPrompts: 2,
      revealedPieces: 2,
      bestStreak: 2,
      revealPieces: REVEAL_PIECES,
      correctFeedback: ["Correct"],
      nudgeFeedback: ["Try again"]
    });

    expect(result.kind).toBe("correct");
    if (result.kind !== "correct") {
      throw new Error("expected correct");
    }
    expect(result.helpUsed).toBe(true);
    expect(result.completionQuality).toBe("clean");
    expect(result.completedPrompts).toBe(3);
    expect(result.revealedPieces).toBe(3);
    expect(result.bestStreak).toBe(2);
    expect(result.lastRewardPiece).toBe(2);
    expect(result.session.helpUsed).toBe(false);
  });

  it("keeps session progress save keys and cleanup testable without rendering", () => {
    const settings = normalizeSettings({ gradeLanes: ["grade1", "grade2"], enabledOperations: ["add"], sessionLength: 5 });
    const session = createSessionState({ path: "add", settings, savedProgress: null, seed: 33 });
    const progress = toPathProgress(session, session.currentPrompt.gradeLane);
    const key = pathProgressKey(session.path, settings, session.currentPrompt.gradeLane);
    const save = {
      ...DEFAULT_SAVE,
      settings,
      pathProgress: {
        [key]: progress,
        old: { ...progress, promptIndex: 1, correct: 1 }
      }
    };

    expect(bestSavedPathProgress(save.pathProgress, "add", settings.sessionLength)?.seed).toBe(33);
    expect(removeSavedPathProgress(save.pathProgress, session, settings)[key]).toBeUndefined();
  });

  it("computes reward reveal progress and hidden media filtering outside views", () => {
    const settings = normalizeSettings({ rewardTheme: "dinosaurs", hiddenRewardMediaIds: ["giphy-hidden"] });
    const media = [
      { ...REWARD_MEDIA[0], id: "giphy-visible", license: "Powered by GIPHY" },
      { ...REWARD_MEDIA[1], id: "giphy-hidden", license: "Powered by GIPHY" }
    ];

    expect(getActiveReward(0, REWARD_MEDIA).visiblePieces).toBe(0);
    expect(getActiveReward(REVEAL_PIECES + 1, REWARD_MEDIA).visiblePieces).toBe(1);
    expect(visibleRewardMedia(settings, media).map((item) => item.id)).toEqual(["giphy-visible"]);
    expect(hideRewardMediaId(settings, "giphy-visible").hiddenRewardMediaIds).toContain("giphy-visible");
    expect(restoreRewardMediaId(settings, "giphy-hidden").hiddenRewardMediaIds).toEqual([]);
  });
});

function partModels(prompt: ReturnType<typeof generatePrompt>) {
  const parts = [];
  if (prompt.visualPart) {
    parts.push(prompt.visualPart);
  }
  if (prompt.visualCompare) {
    parts.push(prompt.visualCompare.left, prompt.visualCompare.right);
  }
  if (prompt.visualEquivalent) {
    parts.push(...prompt.visualEquivalent.models);
  }
  if (prompt.visualOperation) {
    parts.push(prompt.visualOperation.left, prompt.visualOperation.right, prompt.visualOperation.result);
  }
  return parts;
}

function decodeDataSvg(src: string): string {
  expect(src).toMatch(/^data:image\/svg\+xml,/);
  return decodeURIComponent(src.replace(/^data:image\/svg\+xml,/, ""));
}
