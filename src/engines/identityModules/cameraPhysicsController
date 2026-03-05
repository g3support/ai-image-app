export function getCameraPhysicsPrompt(lockIdentity: boolean): string {
  const lockRules = lockIdentity ? `
    CAMERA CONSISTENCY (IDENTITY LOCK MODE):
    - Focal Length: STRICTLY 85mm. No variation.
    - Camera Distance: Must remain ABSOLUTELY CONSTANT across all frames.
    - Perspective: Zero distortion. No wide-angle effects. No fish-eye.
    - Zoom: No zooming in or out. Maintain identical subject-to-frame ratio.
  ` : '';

  return `
    SECTION 9 — CAMERA & PHYSICS CONTROL (MANDATORY)
    ${lockRules}
    
    CAMERA POSITION:
    - Camera height must align with upper chest level (not waist, not head level).
    - Camera must remain at the SAME vertical height across all frames.
    - Do NOT change camera elevation between frames.

    DISTANCE & FOCAL CONTROL:
    - Maintain identical camera-to-subject distance across all images.
    - Do NOT zoom in or zoom out between frames.
    - Use standard portrait focal range simulation (85mm equivalent).
    - STRICTLY PROHIBITED: Wide angle distortion, extreme zoom out, face perspective stretch, body elongation.

    HEAD & FOOT MARGIN RULE (FOR FULL BODY):
    - Maintain consistent head and feet margins across all full body shots.
    - Top of head must have small natural margin (~5–8% vertical space).
    - Feet must have natural margin (~3–5% from bottom).
    - Do NOT crop tightly at head. Do NOT leave excessive empty space above head.
    - Maintain consistent subject scaling across all outputs.
    - Maintain face scale ratio.
  `;
}
