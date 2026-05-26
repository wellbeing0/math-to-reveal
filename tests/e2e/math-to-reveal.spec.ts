import { expect, test, type Page } from "@playwright/test";

const saveKey = "math-to-reveal-save-v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

async function answerCurrentPrompt(page: Page, correct = true): Promise<number> {
  const question = (await page.locator(".question").textContent()) ?? "";
  const missingFactor = question.match(/(\d+)\s*x\s*\?\s*=\s*(\d+)/);
  const match = question.match(/(\d+)\s*([+\-x/])\s*(\d+)/);
  const groups = question.match(/(\d+) groups of (\d+)/);
  const rows = question.match(/(\d+) rows of (\d+)/);
  const placeValue = question.match(/(\d+) tens and (\d+) ones|(\d+)\s*\+\s*(\d+)\s*=/);
  const tenths = question.match(/0\.(\d+) is how many tenths/);
  const fraction = question.match(/(\d+)\/(\d+): how many colored parts/);
  const fractionOperation = question.match(/(\d+)\/(\d+)\s*([+-])\s*(\d+)\/(\d+)\s*=/);
  const decimalOperation = question.match(/(0\.\d+)\s*([+-])\s*(0\.\d+)\s*=/);
  let answer: number | string = 0;
  if (fractionOperation) {
    const left = Number(fractionOperation[1]);
    const denominator = Number(fractionOperation[2]);
    const right = Number(fractionOperation[4]);
    const numerator = fractionOperation[3] === "+" ? left + right : left - right;
    answer = String(numerator) + "/" + String(denominator);
  } else if (decimalOperation) {
    const left = Number(decimalOperation[1]);
    const right = Number(decimalOperation[3]);
    const places = decimalOperation[1].split(".")[1]?.length ?? 1;
    answer = (decimalOperation[2] === "+" ? left + right : left - right).toFixed(places);
  } else if (missingFactor) {
    answer = Number(missingFactor[2]) / Number(missingFactor[1]);
  } else if (match?.[1] && match[2] && match[3]) {
    const left = Number(match[1]);
    const right = Number(match[3]);
    if (match[2] === "+") {
      answer = left + right;
    } else if (match[2] === "-") {
      answer = left - right;
    } else if (match[2] === "x") {
      answer = left * right;
    } else {
      answer = left / right;
    }
  } else if (groups) {
    answer = Number(groups[1]) * Number(groups[2]);
  } else if (rows) {
    answer = Number(rows[1]) * Number(rows[2]);
  } else if (placeValue?.[1] && placeValue[2]) {
    answer = Number(placeValue[1]) * 10 + Number(placeValue[2]);
  } else if (placeValue?.[3] && placeValue[4]) {
    answer = Number(placeValue[3]) + Number(placeValue[4]);
  } else if (tenths) {
    answer = Number(tenths[1]);
  } else if (fraction) {
    answer = Number(fraction[1]);
  } else if (/How many colored/.test(question)) {
    answer = await page.locator(".part-model").first().locator(".part-cell.is-colored").count();
  } else if (/Which fraction matches|Which decimal matches/.test(question)) {
    answer = ((await page.locator(".part-model .part-label").first().textContent()) ?? "").trim();
  } else if (/Which .* is more/.test(question)) {
    const models = page.locator(".part-compare .part-model");
    const leftColored = await models.nth(0).locator(".part-cell.is-colored").count();
    const leftTotal = await models.nth(0).locator(".part-cell").count();
    const rightColored = await models.nth(1).locator(".part-cell.is-colored").count();
    const rightTotal = await models.nth(1).locator(".part-cell").count();
    answer = leftColored / leftTotal > rightColored / rightTotal ? "A" : "B";
  } else if (/Do these show the same amount/.test(question)) {
    const models = page.locator(".part-equivalent .part-model");
    const leftColored = await models.nth(0).locator(".part-cell.is-colored").count();
    const leftTotal = await models.nth(0).locator(".part-cell").count();
    const rightColored = await models.nth(1).locator(".part-cell.is-colored").count();
    const rightTotal = await models.nth(1).locator(".part-cell").count();
    answer = leftColored / leftTotal === rightColored / rightTotal ? "Same" : "Different";
  } else {
    answer = await page.locator(".count-gem").count();
  }

  if (await page.locator(".keypad-panel").count()) {
    const numericAnswer = Number(answer);
    const submitted = correct ? numericAnswer : numericAnswer + 1;
    for (const digit of String(submitted)) {
      await page.getByRole("button", { name: "Digit " + digit }).tap();
    }
    await page.getByRole("button", { name: "Check" }).tap();
    return numericAnswer;
  }

  if (correct) {
    await page.getByRole("button", { name: "Answer " + String(answer) }).tap();
    return Number(answer);
  }

  const choices = (await page.locator(".answer-choice").allTextContents()).map((choice) => choice.trim());
  const wrong = choices.find((choice) => choice !== String(answer));
  if (wrong === undefined) {
    throw new Error("No wrong choice available");
  }
  await page.getByRole("button", { name: "Answer " + String(wrong) }).tap();
  return Number(answer);
}

async function setShortSession(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, JSON.stringify({
      version: 2,
      completedPrompts: 0,
      completedSessions: 0,
      revealedPieces: 0,
      bestStreak: 0,
      settings: {
        gradeLane: "grade1",
        enabledOperations: ["add", "subtract"],
        maxAddend: 10,
        maxAnswer: 20,
        sessionLength: 3,
        reducedMotion: false,
        allowRegrouping: false,
        enableFractions: false,
        enableDecimals: false
      }
    }));
  }, saveKey);
}

async function setGradeSession(page: Page, gradeLane: "grade2" | "grade3" | "grade4", enabledOperations: string[], extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(({ key, grade, operations, extraSettings }) => {
    window.localStorage.setItem(key, JSON.stringify({
      version: 4,
      completedPrompts: 0,
      completedSessions: 0,
      revealedPieces: 0,
      bestStreak: 0,
      settings: {
        gradeLane: grade,
        enabledOperations: operations,
        maxAddend: 99,
        maxAnswer: 100,
        sessionLength: 3,
        reducedMotion: false,
        allowRegrouping: false,
        enableFractions: operations.includes("fraction"),
        enableDecimals: operations.includes("decimal"),
        decimalPlace: "tenths",
        fractionModes: ["name", "match", "compare"],
        decimalModes: ["name", "match", "compare"],
        ...extraSettings
      }
    }));
  }, { key: saveKey, grade: gradeLane, operations: enabledOperations, extraSettings: extra });
}

test("child can complete a short addition session and reveal video pieces", async ({ page }) => {
  await setShortSession(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Math to Reveal" })).toBeVisible();
  await expect(page.locator(".grade-badge")).toHaveText("1st");
  await expect(page.getByText("Choose a path")).toBeVisible();
  await page.getByRole("button", { name: /Add/ }).tap();

  await expect(page.getByText("Solved 0 of 3")).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    await answerCurrentPrompt(page);
  }

  await expect(page.getByText("Session complete")).toBeVisible();
  await expect(page.getByText("3 correct")).toBeVisible();
  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "3 of 10 video pieces revealed");
  await expect(page.locator(".reward-media")).toHaveAttribute("src", /pexels-kitten-01-12596743\.mp4/);
  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), saveKey);
  expect(stored.completedPrompts).toBe(3);
  expect(stored.completedSessions).toBe(1);
});

test("wrong answers nudge without advancing progress, then retry succeeds", async ({ page }) => {
  await setShortSession(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Subtract/ }).tap();

  await expect(page.getByText("Solved 0 of 3")).toBeVisible();
  await answerCurrentPrompt(page, false);
  await expect(page.locator(".answer-choice.is-wrong")).toHaveCount(1);
  await expect(page.getByText("Solved 0 of 3")).toBeVisible();
  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "0 of 10 video pieces revealed");

  await answerCurrentPrompt(page);
  await expect(page.getByText("Solved 1 of 3")).toBeVisible();
  await expect(page.locator(".confetti-burst")).toBeVisible();
  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "1 of 10 video pieces revealed");
});

test("child can leave a path before finishing and choose another path", async ({ page }) => {
  await setShortSession(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Add/ }).tap();
  await expect(page.getByText("Solved 0 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Choose path" }).tap();
  await expect(page.getByText("Choose a path")).toBeVisible();

  await page.getByRole("button", { name: /Subtract/ }).tap();
  await expect(page.getByText("Solved 0 of 3")).toBeVisible();
  await expect(page.getByText("Subtract")).toBeVisible();
});

test("unfinished path progress is restored until reset", async ({ page }) => {
  await setShortSession(page);
  await page.goto("/");

  await page.getByRole("button", { name: /Add/ }).tap();
  await answerCurrentPrompt(page);
  await expect(page.getByText("Solved 1 of 3")).toBeVisible();

  await page.getByRole("button", { name: "Choose path" }).tap();
  await page.getByRole("button", { name: /Subtract/ }).tap();
  await page.getByRole("button", { name: "Choose path" }).tap();
  await page.getByRole("button", { name: /Add/ }).tap();
  await expect(page.getByText("Solved 1 of 3")).toBeVisible();

  await page.getByRole("button", { name: "Choose path" }).tap();
  await page.getByRole("button", { name: "Open adult settings" }).tap();
  page.once("dialog", async (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset math progress" }).tap();
  await page.getByRole("button", { name: /Add/ }).tap();
  await expect(page.getByText("Solved 0 of 3")).toBeVisible();
});

test("completing a path preserves saved progress for the same path in another grade", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, JSON.stringify({
      version: 5,
      completedPrompts: 0,
      completedSessions: 0,
      revealedPieces: 0,
      bestStreak: 0,
      settings: {
        gradeLane: "grade2",
        gradeLanes: ["grade1", "grade2"],
        enabledOperations: ["add"],
        maxAddend: 99,
        maxAnswer: 100,
        sessionLength: 3,
        reducedMotion: false,
        allowRegrouping: false,
        enableFractions: false,
        enableDecimals: false,
        decimalPlace: "tenths",
        fractionModes: ["name", "match", "compare"],
        decimalModes: ["name", "match", "compare"]
      },
      pathProgress: {
        "grade1:add": {
          path: "add",
          gradeLane: "grade1",
          promptIndex: 2,
          seed: 111,
          correct: 2,
          mistakes: 0,
          streak: 2,
          answeredPromptIds: ["add-0-1-2"]
        },
        "grade2:add": {
          path: "add",
          gradeLane: "grade2",
          promptIndex: 2,
          seed: 222,
          correct: 2,
          mistakes: 0,
          streak: 2,
          answeredPromptIds: ["add-0-20-20", "add-1-21-20"]
        }
      }
    }));
  }, saveKey);

  await page.goto("/");
  await page.getByRole("button", { name: /Add/ }).tap();
  await answerCurrentPrompt(page);
  await expect(page.getByText("Session complete")).toBeVisible();
  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), saveKey);
  expect(stored.pathProgress["grade1:add"]?.correct).toBe(2);
  expect(stored.pathProgress["grade2:add"]).toBeUndefined();
});

test("reward media continues the public sample video after a full reveal", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, JSON.stringify({
      version: 2,
      completedPrompts: 10,
      completedSessions: 1,
      revealedPieces: 10,
      bestStreak: 5,
      settings: {
        gradeLane: "grade1",
        enabledOperations: ["add", "subtract"],
        maxAddend: 10,
        maxAnswer: 20,
        sessionLength: 3,
        reducedMotion: false,
        allowRegrouping: false,
        enableFractions: false,
        enableDecimals: false
      }
    }));
  }, saveKey);

  await page.goto("/");
  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "10 of 10 video pieces revealed");
  await expect(page.locator(".reward-media")).toHaveAttribute("src", /pexels-kitten-01-12596743\.mp4/);

  await page.getByRole("button", { name: /Add/ }).tap();
  await answerCurrentPrompt(page);

  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "1 of 10 video pieces revealed");
  await expect(page.locator(".reward-media")).toHaveAttribute("src", /pexels-kitten-01-12596743\.mp4/);
});

test("adult settings stay separated and can switch to kindergarten counting", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Grade lane")).toHaveCount(0);
  await page.getByRole("button", { name: "Open adult settings" }).tap();
  await expect(page.getByRole("region", { name: "Adult settings" })).toBeVisible();
  await page.getByLabel("Kindergarten").check();
  await page.getByLabel("First grade").uncheck();
  await page.getByLabel("Session length").fill("4");
  await page.getByRole("button", { name: "Close" }).tap();

  await expect(page.getByText("Kindergarten practice")).toBeVisible();
  await expect(page.getByText("Practice choices")).toBeVisible();
  await page.getByLabel("Addition").click();
  await expect(page.getByRole("button", { name: /Add/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Count/ }).tap();
  await expect(page.getByText("How many gems?")).toBeVisible();
  await expect(page.locator(".count-gem").first()).toBeVisible();
});

test("adult settings can combine grade lanes across boundaries", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open adult settings" }).tap();
  await page.getByLabel("Second grade").check();
  await page.getByLabel("Fourth grade").check();
  await page.getByRole("button", { name: "Close" }).tap();

  await expect(page.getByText("Mixed practice")).toBeVisible();
  await expect(page.locator(".grade-badge")).toHaveText("1st, 2nd, 4th");
  await expect(page.getByRole("button", { name: /Add/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Place Value/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fractions/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Decimals/ })).toBeVisible();
  await page.getByRole("button", { name: /Fractions/ }).tap();
  await expect(page.locator(".grade-badge")).toHaveText("4th");

  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), saveKey);
  expect(stored.settings.gradeLanes).toEqual(["grade1", "grade2", "grade4"]);
});

test("second grade lane uses keypad for two-digit addition and choices for place value", async ({ page }) => {
  await setGradeSession(page, "grade2", ["add", "subtract", "placeValue", "skipCount", "groups"]);
  await page.goto("/");

  await expect(page.getByText("Second grade practice")).toBeVisible();
  await expect(page.getByRole("button", { name: /Place Value/ })).toBeVisible();
  await page.getByRole("button", { name: /Add/ }).tap();
  await expect(page.locator(".keypad-panel")).toBeVisible();
  await answerCurrentPrompt(page);
  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "1 of 10 video pieces revealed");
});

test("confetti does not replay while entering the next keypad answer", async ({ page }) => {
  await setGradeSession(page, "grade2", ["add"]);
  await page.goto("/");

  await page.getByRole("button", { name: /Add/ }).tap();
  await answerCurrentPrompt(page);
  await expect(page.locator(".confetti-burst")).toBeVisible();
  await expect(page.getByText("Solved 1 of 3")).toBeVisible();

  await page.waitForTimeout(1400);
  await expect(page.locator(".confetti-burst")).toHaveCount(0);
  await page.getByRole("button", { name: "Digit 1" }).tap();
  await expect(page.locator(".confetti-burst")).toHaveCount(0);
});

test("keypad gives calm visible retry feedback on a wrong checked answer", async ({ page }) => {
  await setGradeSession(page, "grade2", ["add"]);
  await page.goto("/");

  await page.getByRole("button", { name: /Add/ }).tap();
  await answerCurrentPrompt(page, false);
  await expect(page.locator(".keypad-panel")).toHaveClass(/is-wrong/);
  await expect(page.getByText("Add tens, then ones.")).toBeVisible();

  await page.getByRole("button", { name: "Digit 1" }).tap();
  await expect(page.locator(".keypad-panel")).not.toHaveClass(/is-wrong/);
});

test("third grade lane includes division and arrays", async ({ page }) => {
  await setGradeSession(page, "grade3", ["multiply", "divide", "arrays"]);
  await page.goto("/");

  await expect(page.getByText("Third grade practice")).toBeVisible();
  await expect(page.getByRole("button", { name: /Divide/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Arrays/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fractions/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Decimals/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Divide/ }).tap();
  await expect(page.locator(".keypad-panel")).toBeVisible();
  await answerCurrentPrompt(page);
  await expect(page.locator(".reveal-board")).toHaveAttribute("aria-label", "1 of 10 video pieces revealed");
});

test("fourth grade has visual fraction and decimal paths with child tenths and hundredths choice", async ({ page }) => {
  await setGradeSession(page, "grade4", ["fraction", "decimal"], {
    sessionLength: 4,
    fractionModes: ["name", "match", "compare", "equivalent", "addSubtract"],
    decimalModes: ["name"],
    decimalPlace: "hundredths"
  });
  await page.goto("/");

  await expect(page.getByText("Fourth grade practice")).toBeVisible();
  await expect(page.getByRole("button", { name: /Fractions/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Decimals/ })).toBeVisible();
  await expect(page.getByLabel("Hundredths")).toBeChecked();

  await page.getByRole("button", { name: /Decimals/ }).tap();
  await expect(page.locator(".part-model").first()).toBeVisible();
  await expect(page.locator(".hundredths-model").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Repeat instruction" })).toBeVisible();
  await answerCurrentPrompt(page);
  await expect(page.getByText("Solved 1 of 4")).toBeVisible();

  await page.getByRole("button", { name: "Choose path" }).tap();
  await page.getByLabel("Tenths").check();
  await page.getByRole("button", { name: /Decimals/ }).tap();
  await expect(page.locator(".hundredths-model")).toHaveCount(0);
  await expect(page.locator(".part-model").first()).toBeVisible();
});

test("instruction audio button falls back to browser speech without static assets", async ({ page }) => {
  await setGradeSession(page, "grade4", ["decimal"], {
    sessionLength: 3,
    decimalModes: ["equivalent"],
    decimalPlace: "tenths"
  });
  await page.goto("/");

  await page.getByRole("button", { name: /Decimals/ }).tap();
  const requests: string[] = [];
  await page.route("**/audio/math/instructions/**/*.wav", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "audio/wav", body: "" });
  });
  await page.getByRole("button", { name: "Repeat instruction" }).tap();
  await page.waitForTimeout(300);
  expect(requests).toHaveLength(0);
});

test("fourth grade add and subtract modes stay visual and answerable", async ({ page }) => {
  await setGradeSession(page, "grade4", ["fraction", "decimal"], {
    sessionLength: 3,
    fractionModes: ["addSubtract"],
    decimalModes: ["addSubtract"],
    decimalPlace: "tenths"
  });
  await page.goto("/");

  await page.getByRole("button", { name: /Fractions/ }).tap();
  await expect(page.locator(".part-operation")).toBeVisible();
  await expect(page.locator(".answer-slot")).toBeVisible();
  await answerCurrentPrompt(page);
  await expect(page.getByText("Solved 1 of 3")).toBeVisible();

  await page.getByRole("button", { name: "Choose path" }).tap();
  await page.getByRole("button", { name: /Decimals/ }).tap();
  await expect(page.locator(".part-operation")).toBeVisible();
  await answerCurrentPrompt(page);
  await expect(page.getByText("Solved 1 of 3")).toBeVisible();
});

test("reduced motion setting applies a static gameplay mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open adult settings" }).tap();
  await page.getByLabel("Reduce motion").check();
  await expect(page.locator("body")).toHaveClass(/reduced-motion/);
});

test("phone layout keeps play controls before the reward panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "Phone metric check only runs in phone project.");
  await page.goto("/");
  await page.getByRole("button", { name: /Add/ }).tap();

  const prompt = await page.locator(".prompt-panel").boundingBox();
  const answers = await page.locator(".answer-grid").boundingBox();
  const reward = await page.locator(".reward-panel").boundingBox();
  expect(prompt).not.toBeNull();
  expect(answers).not.toBeNull();
  expect(reward).not.toBeNull();
  expect((answers?.y ?? 0)).toBeGreaterThan((prompt?.y ?? 0) + (prompt?.height ?? 0) - 1);
  expect((reward?.y ?? 0)).toBeGreaterThan((answers?.y ?? 0) + (answers?.height ?? 0) - 1);
});
