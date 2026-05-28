import { type PartModel } from "../mathEngine";

export function createGemGrid(count: number): HTMLElement {
  const grid = el("div", "gem-grid");
  for (let index = 0; index < count; index += 1) {
    grid.append(el("span", "count-gem"));
  }
  return grid;
}

export function createGroupGrid(groups: number[]): HTMLElement {
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

export function createArrayGrid(rows: number, columns: number): HTMLElement {
  const grid = el("div", "array-grid");
  grid.style.setProperty("--columns", String(columns));
  grid.setAttribute("aria-label", String(rows) + " rows and " + String(columns) + " columns");
  for (let index = 0; index < rows * columns; index += 1) {
    grid.append(el("span", "mini-counter"));
  }
  return grid;
}

export function createFractionVisual(colored: number, total: number): HTMLElement {
  const wrapper = el("div", "fraction-visual");
  wrapper.setAttribute("aria-label", String(colored) + " colored parts out of " + String(total));
  for (let index = 0; index < total; index += 1) {
    const part = el("span", index < colored ? "fraction-part is-colored" : "fraction-part");
    wrapper.append(part);
  }
  return wrapper;
}

export function createPartVisual(model: PartModel): HTMLElement {
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

export function createCompareVisual(left: PartModel, right: PartModel): HTMLElement {
  const wrapper = el("div", "part-compare");
  wrapper.append(createPartVisual({ ...left, label: "A: " + (left.label ?? "") }));
  wrapper.append(createPartVisual({ ...right, label: "B: " + (right.label ?? "") }));
  return wrapper;
}

export function createEquivalentVisual(models: [PartModel, PartModel]): HTMLElement {
  const wrapper = el("div", "part-equivalent");
  wrapper.append(createPartVisual(models[0]));
  wrapper.append(createPartVisual(models[1]));
  return wrapper;
}

export function createOperationVisual(left: PartModel, right: PartModel, result: PartModel, operator: "+" | "-"): HTMLElement {
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
