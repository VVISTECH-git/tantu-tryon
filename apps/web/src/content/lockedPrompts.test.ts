import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { garmentWordsFrom } from "./garmentWords";
import { TEMPLATES, composePrompt, defaultRules, promptVersion } from "./promptTemplates";

/*
  Poses that passed are locked word for word. If this fails, a change meant
  for another pose (or a shared block) reached a locked prompt: undo it, or,
  if the change to the locked pose is intended and agreed, make a new locked
  version and update the golden file deliberately.
*/
const words = garmentWordsFrom(undefined as never, {
  bodyColour: "dark brown",
  bodyDesc: "test ground with test motifs",
  borderColour: "mustard",
  borderDesc: "test border",
} as never);
const selections = { modelType: "woman", modelSource: "generated", age: "late 20s", background: "courtyard", attachMode: "sheet", rules: defaultRules() } as never;
const plan = { pallu: "same" as const, border: "from-body" as const, blouse: "complementary" as const, worn: true };

describe("locked prompts", () => {
  it("C1P1 is exactly the locked v4.1 one-fabric prompt", () => {
    const p1 = TEMPLATES.find((t) => t.id === "P1")!;
    const golden = readFileSync(join(__dirname, "__golden__", "C1P1-v41-locked.txt"), "utf8").replace(/\r/g, "");
    expect(composePrompt(p1, words, selections, [{ slot: "body", file: "b.png" }], plan)).toBe(golden);
    expect(promptVersion(p1, plan)).toBe("v4.1-one-fabric-LOCKED");
  });

  it("C1P1 v4.1 describes one fabric and never says pallu", () => {
    const p1 = TEMPLATES.find((t) => t.id === "P1")!;
    const text = composePrompt(p1, words, selections, [{ slot: "body", file: "b.png" }], plan);
    expect(text).toContain("a single length of one fabric");
    expect(text).not.toMatch(/pallu/i);
    expect(text).not.toMatch(/\{[A-Za-z_]+\}| {2}|\.\./);
  });
});
