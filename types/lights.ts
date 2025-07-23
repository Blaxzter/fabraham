// Type definitions for the dynamic light system

export interface LightConfig {
  id: string;
  name: string;
  type: "point" | "spot" | "directional";
  enabled: boolean;
  position: { x: number; y: number; z: number };
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  // Spotlight specific
  angle?: number;
  penumbra?: number;
  target?: { x: number; y: number; z: number };
  // Directional light specific
  direction?: { x: number; y: number; z: number };
  // Animation properties
  animatable?: boolean;
  animationKeyframes?: Array<{
    progress: number;
    position?: { x: number; y: number; z: number };
    intensity?: number;
    color?: string;
  }>;
}

export interface LightSystemStore {
  lights: Record<string, LightConfig>;
  enableColoredLights: boolean;
  showLightHelpers: boolean;

  // Methods
  addLight: (config: LightConfig) => void;
  removeLight: (lightId: string) => void;
  updateLightProperty: (
    lightId: string,
    property: keyof LightConfig,
    value: any
  ) => void;
  toggleLight: (lightId: string) => void;
  getLight: (lightId: string) => LightConfig | undefined;
  getLightsByType: (type: "point" | "spot" | "directional") => LightConfig[];
  getEnabledLights: () => LightConfig[];
}

export interface AnimationKeyframe {
  progress: number;
  position?: { x: number; y: number; z: number };
  intensity?: number;
  color?: string;
}

export type LightType = "point" | "spot" | "directional";

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

// Utility types
export type LightPreset = () => void;

export interface LightPresets {
  dramatic: LightPreset;
  soft: LightPreset;
  original: LightPreset;
}
