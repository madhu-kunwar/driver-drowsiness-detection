declare module "sheryjs" {
  interface SheryImageEffectConfig {
    [key: string]: { value: number; range?: [number, number] };
  }

  interface SheryImageEffectOptions {
    style?: number;
    config?: SheryImageEffectConfig;
    gooey?: boolean;
    slideStyle?: (set: (val: number) => void) => void;
  }

  interface SheryMagnetOptions {
    ease?: string;
    duration?: number;
    multiplicator?: number;
  }

  interface SheryHoverEffectOptions {
    style?: number;
    color?: string;
  }

  const Shery: {
    imageEffect(selector: string, options?: SheryImageEffectOptions): void;
    makeMagnet(selector: string, options?: SheryMagnetOptions): void;
    hoverEffect(selector: string, options?: SheryHoverEffectOptions): void;
    mouseFollower(options?: Record<string, unknown>): void;
  };

  export default Shery;
}
