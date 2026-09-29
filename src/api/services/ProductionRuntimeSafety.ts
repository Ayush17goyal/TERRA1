export function isProductionRuntime(): boolean {
  const env = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
  return env === 'production';
}

export function assertNotProductionDefault(component: string, missingDependencies: string[]): void {
  if (!isProductionRuntime()) return;
  if (missingDependencies.length === 0) return;
  throw new Error(`${component} is not production-ready: missing required dependencies [${missingDependencies.join(', ')}].`);
}
