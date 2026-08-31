export type RenderCard =
  | { state: "pending"; poseId: string; poseName: string }
  | { state: "cancelled"; poseId: string; poseName: string }
  | {
      state: "ok";
      id: string;
      poseId: string;
      poseName: string;
      dataUrl: string;
      prompt: string;
      provider: string;
      model: string;
      ms: number;
    }
  | { state: "failed"; poseId: string; poseName: string; error: string; ms: number };
