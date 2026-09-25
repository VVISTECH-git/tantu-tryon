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

describe("one print (only the body photographed)", () => {
  const plan = { pallu: "same", border: "from-body", blouse: "complementary" } as const;
  const files = [{ slot: "body", file: "g-body.png" }];
  const cases = {
    described: garmentWordsFrom(null, { bodyColour: "teal green", bodyDesc: "teal green ground with lotus flowers and birds", borderColour: "red", borderDesc: "red border with gold zari stripes" }),
    unread: garmentWordsFrom(null, {}),
  };
  for (const [name, words] of Object.entries(cases)) {
    for (const template of TEMPLATES) {
      it(`${template.id} with ${name} words never sets the body against a pallu`, () => {
        const text = composePrompt(template, words, DEFAULTS, files, plan);
        expect(text).toContain("There is no separate pallu design");
        expect(text).toContain("one print from end to end");
        expect(text).not.toMatch(/different fabrics|BODY-print|PALLU-print|never [a-z -]*-patterned|no pallu motif/);
        expect(text).not.toMatch(/ {2}|\.\./);
        expect(text).toMatch(/BLOUSE: plain/);
        expect(text).toContain("sheet of 1 labelled photograph of ONE");
        expect(text).toContain("border is the band along both long edges of the BODY photograph");
        expect(text).toContain("Anything around the fabric in the photograph, such as a wall");
        expect(text).not.toContain("BORDER panel");
      });
    }
  }
});
