import { describe, expect, it } from "vitest";
import type { Garment, GarmentPartRow, PartQuality } from "@/db";
import { isReady, missingSlots, sheetSlots } from "./garments";

/**
 * The rod-shot rules, without a database: which shots make a garment ready,
 * and which four go on the sheet.
 */

const ok: PartQuality = { status: "ok", reasons: [], metrics: { sharpness: 40, brightness: 120, dark: 0, bright: 0, width: 1500, height: 2000 } };
const block: PartQuality = { ...ok, status: "block", reasons: [{ code: "blur", level: "block", message: "Blurred." }] };

function part(slot: string, quality: PartQuality | undefined = ok): GarmentPartRow {
  return { slot, key: `k/${slot}`, url: `/u/${slot}`, width: 1500, height: 2000, rotate: 0, ...(quality ? { quality } : {}) };
}

function garment(parts: GarmentPartRow[], answers: Garment["answers"] = {}): Garment {
  return {
    id: "g1",
    accountId: "a1",
    source: "upload",
    garmentType: "saree",
    family: "unstitched",
    productCode: null,
    title: "Saree",
    description: null,
    design: null,
    words: {},
    answers,
    parts,
    sheetKey: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe("readiness", () => {
  it("needs body and pallu", () => {
    expect(missingSlots(garment([part("body")]))).toEqual(["pallu"]);
    expect(isReady(garment([part("body"), part("pallu")]))).toBe(true);
  });

  it("treats a blocked required shot as missing", () => {
    const g = garment([part("body"), part("pallu", block)]);
    expect(missingSlots(g)).toEqual(["pallu"]);
    expect(isReady(g)).toBe(false);
  });

  it("accepts one flat photo of the whole saree (the older path)", () => {
    expect(isReady(garment([part("saree", undefined)]))).toBe(true);
  });

  it("does not need quality on SLK photographs", () => {
    expect(isReady(garment([part("body", undefined), part("pallu", undefined)]))).toBe(true);
  });
});

describe("sheet cells", () => {
  it("leads with body, pallu, border and fills the fourth by priority", () => {
    const all = ["body", "pallu", "border", "blouse", "body_motif", "pallu_motif", "whole"].map((s) => part(s));
    expect(sheetSlots(garment(all))).toEqual(["body", "pallu", "border", "blouse"]);
  });

  it("skips the blouse cell when the blouse is the body fabric", () => {
    const all = ["body", "pallu", "border", "blouse", "body_motif", "pallu_motif", "whole"].map((s) => part(s));
    expect(sheetSlots(garment(all, { blouseSameAsBody: true }))).toEqual(["body", "pallu", "border", "pallu_motif"]);
  });

  it("frees a missing border's cell to the same list", () => {
    const parts = ["body", "pallu", "body_motif", "whole"].map((s) => part(s));
    expect(sheetSlots(garment(parts))).toEqual(["body", "pallu", "body_motif", "whole"]);
  });

  it("keeps a blocked optional photograph off the sheet", () => {
    const parts = [part("body"), part("pallu"), part("border", block), part("whole")];
    expect(sheetSlots(garment(parts))).toEqual(["body", "pallu", "whole"]);
  });

  it("never exceeds four cells", () => {
    const all = ["body", "pallu", "border", "blouse", "body_motif", "pallu_motif", "whole"].map((s) => part(s));
    expect(sheetSlots(garment(all)).length).toBe(4);
  });

  it("one flat photo stands alone", () => {
    expect(sheetSlots(garment([part("saree"), part("body")]))).toEqual(["saree"]);
  });
});
