import type { ModelBrief } from "@tantu/engine/catalog";

/**
 * Lab model presets.
 *
 * A stand-in for the Model Registry, which does not exist yet. Ids follow the
 * intended convention (`MOD-F01`) so that when the registry is built these
 * become records rather than a rename.
 *
 * Model is chosen independently of pose: every preset here is expected to work
 * with every pose, and nothing in a pose record names a model.
 */
export interface LabModel {
  id: string;
  label: string;
  brief: ModelBrief;
}

export const LAB_MODELS: LabModel[] = [
  {
    id: "MOD-F01",
    label: "MOD-F01 · mid-20s, average build, warm complexion",
    brief: {
      age: "in her mid-20s",
      build: "of average height and build",
      complexion: "with a warm Indian complexion",
      hair: "with dark hair worn down",
      expression: "with a direct, confident gaze and a neutral-to-soft expression",
      styling: "gold jhumka earrings, a gold choker-style necklace, and bangles",
    },
  },
  {
    id: "MOD-F02",
    label: "MOD-F02 · early 30s, taller, deeper complexion",
    brief: {
      age: "in her early 30s",
      build: "tall and slim",
      complexion: "with a deep Indian complexion",
      hair: "with dark hair gathered back",
      expression: "with a calm, direct expression",
      styling: "small gold studs only",
    },
  },
  {
    id: "MOD-F03",
    label: "MOD-F03 · late 20s, fuller build, fair complexion",
    brief: {
      age: "in her late 20s",
      build: "of fuller build",
      complexion: "with a fair Indian complexion",
      hair: "with dark wavy hair worn down",
      expression: "with a soft, natural smile",
      styling: "gold jhumka earrings and thin bangles",
    },
  },
];

export function labModel(id: string): LabModel {
  return LAB_MODELS.find((m) => m.id === id) ?? LAB_MODELS[0]!;
}
