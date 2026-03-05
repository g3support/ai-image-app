export interface SeedResult {
  seed: number;
}

export function resolveSeed(lockIdentity: boolean, characterSeed?: number): SeedResult {
  if (lockIdentity && characterSeed !== undefined) {
    return { seed: characterSeed };
  }
  
  // Generate a random seed if not locked or no character seed provided
  // Using a large range as requested (1 - 2147483647)
  return { seed: Math.floor(Math.random() * 2147483647) + 1 };
}
