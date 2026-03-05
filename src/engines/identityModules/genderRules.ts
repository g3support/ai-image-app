export function getGenderRulesPrompt(gender: 'female' | 'male', lockIdentity: boolean, productCategory?: string): string {
  const lockRules = lockIdentity ? `
    IDENTITY LOCK ENFORCEMENT:
    - Maintain exact makeup style and color palette.
    - Maintain exact facial hair grooming and density.
    - Maintain exact hairline and forehead proportions.
    - No changes to facial symmetry or features.
  ` : '';

  if (gender === 'female') {
    return `
      SECTION 10 — FEMALE GENDER RULES
      - JEWELRY: Elegant traditional Indian jewelry matching embroidery tone.
      - DUPATTA: Maintain consistent shoulder drape orientation; adjust naturally to body rotation.
      - MAKEUP: Subtle natural glam makeup.
      - HAIR: Professional hairstyle appropriate to neckline and back design.
      ${lockRules}
    `;
  } else {
    return `
      SECTION 10 — MALE GENDER RULES
      - BEARD: Maintain exact beard density and edge sharpness.
      - HAIRLINE: Preserve hairline shape and forehead proportion.
      - SHERWANI COLLAR PROTECTION: Ensure collar does NOT distort jawline or merge into beard.
      - MASCULINE FEATURES: Preserve masculine features, no face slimming or artificial enhancement.
      - WATCH: Optional elegant wristwatch for IndoWestern/Suit.
      - FOOTWEAR: Match garment category (Sherwani: Mojari, IndoWestern: Formal, Kurta: Ethnic).
      ${lockRules}
    `;
  }
}
