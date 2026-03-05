export function getLightingPrompt(lockIdentity: boolean, defaultLighting: string): string {
  const lockRules = lockIdentity ? `
    LIGHTING DIRECTION LOCK (IDENTITY LOCK MODE):
    - Lighting direction must remain ABSOLUTELY CONSTANT across all frames.
    - Do NOT change key light angle. Do NOT flip light direction.
    - Key light position: Fixed studio position.
    - Shadows must fall consistently. Maintain identical shadow depth and highlight intensity.
    - Lighting must not alter facial perception or geometry.
  ` : '';

  return `
    SECTION 6 — LIGHTING CONTROL
    - Primary Lighting: ${defaultLighting}
    - Default background: Light grey studio backdrop.
    - Lighting: Soft studio lighting. No dramatic shadows. No color tint shifts.
    ${lockRules}
  `;
}
