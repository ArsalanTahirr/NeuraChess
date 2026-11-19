import { DemoAdapter } from './demoAdapter';
import { BackendAdapter } from './backendAdapter';
import type { EngineAdapter } from './adapter';

export function createAdapter(): EngineAdapter {
  const mode = import.meta.env.VITE_ENGINE_MODE;
  if (mode === 'backend') {
    return new BackendAdapter();
  }
  return new DemoAdapter();
}

export { DemoAdapter, BackendAdapter };
export type { EngineAdapter };
