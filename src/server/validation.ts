export const ALLOWED_FRAMES = new Set([
  "Full Body Front",
  "Full Left Side Profile",
  "Full Right Side Profile",
  "Full Body Back",
  "Upper 3/4",
  "Upper 3/4 Frame",
  "Bottom 3/4",
  "Bottom 3/4 Frame",
  "Zoom Close-Up",
  "Detailing Image (Macro)"
]);

export const ALLOWED_GENDERS = new Set(["female", "male"]);

export function isBase64ImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.includes(",")
  );
}

export function isValidString(value: unknown, maxLength = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function validateGenerateRequestBody(body: any): string | null {
  if (!body || typeof body !== "object") return "Invalid request body";
  if (!isValidString(body.brandId, 120)) return "brandId is required";
  if (body.gender && !ALLOWED_GENDERS.has(body.gender)) return "Invalid gender";

  const framesInput = body.frames || [{ frame: body.frame || "Full Body Front", requestHash: body.requestHash }];
  if (!Array.isArray(framesInput) || framesInput.length === 0) return "frames must be a non-empty array";
  for (const item of framesInput) {
    if (!item || typeof item !== "object") return "Invalid frame payload";
    if (!isValidString(item.frame, 80) || !ALLOWED_FRAMES.has(item.frame)) return "Invalid frame";
    if (!isValidString(item.requestHash, 200)) return "requestHash is required for each frame";
  }

  for (const img of [...(body.imagesWithDupatta || []), ...(body.imagesWithoutDupatta || [])]) {
    if (!isBase64ImageDataUrl(img)) return "Invalid image payload format";
  }

  return null;
}

export function pickCharacterUpdateFields(input: any): Record<string, unknown> {
  const allowed = new Set([
    "name",
    "gender",
    "defaultLighting",
    "defaultFocalLength",
    "defaultCameraDistance",
    "defaultStyling",
    "identityLockEnabled"
  ]);

  const result: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return result;
  for (const key of Object.keys(input)) {
    if (allowed.has(key)) result[key] = input[key];
  }
  return result;
}
