import { fileURLToPath } from 'node:url';

const pkg = (p: string) => fileURLToPath(new URL(`../packages/${p}`, import.meta.url));

/** Shared module aliases for both apps, tests and tooling. */
export const aliases = {
  '@plyo/core/arena': pkg('core/src/arena.ts'),
  '@plyo/hand3d/skinTones': pkg('hand3d/src/skinTones.ts'),
  '@plyo/engine': pkg('engine/src/index.ts'),
  '@plyo/hand3d': pkg('hand3d/src/index.ts'),
  '@plyo/core': pkg('core/src/index.ts'),
  '@plyo/tokens': pkg('tokens/src'),
};
