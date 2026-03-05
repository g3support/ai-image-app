import { StylingConfig } from "../IdentityEngine";

export function resolveStyling(
  gender: 'female' | 'male',
  freezeStyling: boolean,
  defaultStyling: StylingConfig,
  stylingOverride?: Partial<StylingConfig>
): StylingConfig {
  if (freezeStyling) {
    return defaultStyling;
  }

  const resolved = { ...defaultStyling, ...stylingOverride };

  // Ensure gender-specific fields are handled correctly if needed
  // (Though the interface already separates them, we can enforce logic here)
  
  return resolved;
}

export function getStylingPrompt(gender: 'female' | 'male', config: StylingConfig): string {
  const femaleStyling = `
    - Hairstyle: ${config.hairStyle}
    - Jewelry: ${config.jewelry}
    - Expression: ${config.expression}
    - Footwear: ${config.footwear}
  `;

  const maleStyling = `
    - Hairstyle: ${config.hairStyle}
    - Beard Style: ${config.beardStyle || 'clean shaven'}
    - Facial Hair: ${config.facialHair || 'clean'}
    - Facial Hair Density: ${config.facialHairDensity || 'none'}
    - Watch: ${config.watch || 'none'}
    - Footwear: ${config.footwear}
    - Expression: ${config.expression}
  `;

  return `
    SECTION 3 — STYLING ENGINE (STYLING RESOLVED)
    STRICTLY FOLLOW THIS STYLING CONFIGURATION:
    ${gender === 'female' ? femaleStyling : maleStyling}
    
    STYLING CONSISTENCY RULES:
    - Hairstyle: ABSOLUTELY FROZEN. Same cut, same texture, same flow.
    - Jewelry: ABSOLUTELY FROZEN. Same design, same placement.
    - Beard/Facial Hair: ABSOLUTELY FROZEN. Same density, same edges.
    - Accessories (Watch/etc): ABSOLUTELY FROZEN. Same model, same wrist.
    - Facial Expression: ABSOLUTELY FROZEN. Same intensity.
    - Do NOT introduce any styling variations.
    - Styling must be a 100% match to the character's default configuration.
  `;
}
