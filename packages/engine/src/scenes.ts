import type { Scene } from "./types";

/**
 * Backdrop and lighting, kept separate from pose so a whole catalogue can be
 * re-shot against a different wall without touching the pose library.
 */
export const SCENES: Scene[] = [
  {
    id: "courtyard",
    name: "Heritage courtyard",
    setting:
      "She is positioned in a sunlit traditional Indian courtyard, framed symmetrically by a single stone arch directly behind her head, with pillars on either side, the background softly blurred.",
    light: "Warm, golden directional lighting.",
  },
  {
    id: "studio-neutral",
    name: "Studio · neutral",
    setting:
      "She stands against a seamless, unpatterned light grey studio backdrop with no props and no visible floor line.",
    light:
      "Even, soft, colour-neutral studio lighting with a gentle falloff — the fabric's true colour must not be tinted by the light.",
  },
  {
    id: "studio-warm",
    name: "Studio · warm",
    setting:
      "She stands against a seamless warm ivory studio backdrop with a soft shadow falling to one side.",
    light: "Soft key light from one side with a fill on the other; warm but not colour-casting.",
  },
  {
    id: "haveli",
    name: "Carved haveli wall",
    setting:
      "She stands in front of an old carved sandstone haveli wall, the carving softly out of focus behind her.",
    light: "Late afternoon side light, warm and directional.",
  },
  {
    id: "temple",
    name: "Temple corridor",
    setting:
      "She stands in a stone temple corridor with a receding line of pillars behind her, the depth softly blurred.",
    light: "Shafts of warm daylight from the side, deep but not crushed shadows.",
  },
  {
    id: "garden",
    name: "Garden · outdoor",
    setting:
      "She stands outdoors in a green garden with foliage well behind her, thrown fully out of focus.",
    light: "Overcast, diffuse daylight — flattering and colour-true.",
  },
  {
    id: "terrace",
    name: "Terrace at golden hour",
    setting:
      "She stands on an open terrace with a soft, blown-out sky behind her and no distracting architecture.",
    light: "Low golden-hour sun behind and to one side, with fill on her face so the fabric stays readable.",
  },
];

const BY_ID = new Map(SCENES.map((s) => [s.id, s]));

/** Unknown ids are treated as a free-text setting, so the UI can allow both. */
export function scene(idOrText: string | undefined): Scene {
  if (!idOrText) return SCENES[0]!;
  const found = BY_ID.get(idOrText);
  if (found) return found;
  return { id: "custom", name: "Custom", setting: idOrText, light: "" };
}
