import { describe, expect, it } from "vitest";
import { garmentWordsFrom } from "./garmentWords";
import { TEMPLATES, composePrompt, defaultRules, type Selections } from "./promptTemplates";

/**
 * The frozen prompts, held still.
 *
 * "Frozen" has meant a badge and a promise. This makes it a check: with the
 * default selections and the words that were read for 300021 on the day the
 * v2 prompts were approved, each live template must compose to exactly the
 * text in its snapshot. Change a block on purpose and the snapshot is
 * updated with `vitest -u` as part of the new version; change one by
 * accident and this fails.
 */

const DESIGN_300021 = {
  code: "SAR-KAL-COT-0021",
  name: "Kalamkari cotton saree",
  productType: "Saree",
  fibreType: "Cotton",
  craftTechnique: "Kalamkari",
  colour: "Beige",
  motif: "Flowers",
  palluMotif: "Peacock",
  borderMotif: null,
  borderHeight: "Khadi (2-3 Inch)",
  blouseStyle: "Self",
  blouseMotif: null,
  audienceType: "Women",
};

const WORDS_300021 = {
  bodyColour: "deep blue",
  bodyDesc: "deep blue ground with white and cream birds, flowers and climbing vines in a dense all-over repeat",
  palluColour: "cream",
  palluMotif: "peacock",
  palluDesc: "cream ground with two large facing peacocks, a blue vine band above and a scalloped bell-motif edge below",
  palluTopDesc: "the blue vine band section",
  palluEndDesc: "The scalloped bell-motif edge",
  borderColour: "orange",
  borderDesc: "orange and gold zari border",
  blouseColour: "cream",
  blouseDesc: "cream ground with blue sparrows and vines",
};

const DEFAULTS: Selections = {
  modelType: "woman",
  modelSource: "generated",
  age: "mid-20s",
  background: "courtyard",
  attachMode: "sheet",
  rules: defaultRules(),
};

const FILES = ["body", "pallu", "border", "blouse"].map((slot) => ({ slot, file: `300021-${slot}.png` }));

describe("frozen prompts", () => {
  const words = garmentWordsFrom(DESIGN_300021, WORDS_300021);

  for (const template of TEMPLATES.filter((t) => t.live)) {
    it(`${template.id} ${template.frozen ? `v${template.frozen.version}` : "draft"} composes to its recorded text`, () => {
      expect(composePrompt(template, words, DEFAULTS, FILES)).toMatchSnapshot();
    });
  }

  it("every block appears once, in order", () => {
    const prompt = composePrompt(TEMPLATES[0]!, words, DEFAULTS, FILES);
    const order = ["REFERENCE:", "TASK:", "HOUSE RULES:", "GARMENT:", "PLACEMENT MAP", "POSE:", "SCENE:", "OUTPUT:"];
    const positions = order.map((label) => prompt.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("leaves no unfilled tokens", () => {
    for (const template of TEMPLATES.filter((t) => t.live)) {
      expect(composePrompt(template, words, DEFAULTS, FILES)).not.toMatch(/\{[A-Za-z_]+\}/);
    }
  });
});
