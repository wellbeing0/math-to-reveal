import { describe, expect, it } from "vitest";
import { validateInstructionAudioManifest } from "./instructionAudio";
import { buildChoices, createSeededRandom, eligiblePaths, generatePrompt, normalizeSettings, validateAnswer } from "./mathEngine";
import { DEFAULT_SAVE, loadSave, resetSave, saveGame } from "./save";

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
});
