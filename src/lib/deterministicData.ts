/**
 * CHATR OS — Deterministic Property Engine
 * Replaces Math.random() in UI components with stable, deterministic hash functions.
 * Given the same entity ID or name, always produces identical ratings, counts, and properties.
 */

export function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function deterministicNumber(seedStr: string, min: number, max: number): number {
  const hash = simpleHash(seedStr);
  const normalized = (hash % 10000) / 10000;
  return min + normalized * (max - min);
}

export function deterministicInt(seedStr: string, min: number, max: number): number {
  return Math.floor(deterministicNumber(seedStr, min, max + 1));
}

export function deterministicBool(seedStr: string, threshold = 0.5): boolean {
  const hash = simpleHash(seedStr);
  return (hash % 100) / 100 < threshold;
}

export function deterministicChoice<T>(seedStr: string, options: T[]): T {
  const idx = deterministicInt(seedStr, 0, options.length - 1);
  return options[idx];
}
