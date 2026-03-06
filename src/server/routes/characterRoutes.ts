import type { IdentityEngine } from "../../engines/IdentityEngine.js";
import {
  authenticateRequest,
  enforceBrandAccess,
  resolveAuthorizedBrandId
} from "../security.js";
import {
  ALLOWED_GENDERS,
  isBase64ImageDataUrl,
  isValidString,
  pickCharacterUpdateFields
} from "../validation.js";

export function registerCharacterRoutes(app: any, identityEngine: IdentityEngine, isShuttingDown: () => boolean) {
  app.post("/api/characters/save", authenticateRequest, enforceBrandAccess, async (req: any, res: any) => {
    try {
      if (isShuttingDown()) return res.status(503).json({ success: false, error: "Server is shutting down" });
      const brandId = resolveAuthorizedBrandId(req);
      const { name, referenceImageBase64, gender, defaultStyling } = req.body;
      if (!isValidString(brandId, 120) || !isValidString(name, 120) || !isBase64ImageDataUrl(referenceImageBase64)) {
        return res.status(400).json({ success: false, error: "Invalid required fields" });
      }
      if (gender && !ALLOWED_GENDERS.has(gender)) {
        return res.status(400).json({ success: false, error: "Invalid gender" });
      }
      const characterId = await identityEngine.saveCharacter({
        brandId,
        name,
        referenceImageBase64,
        gender,
        defaultStyling
      });
      res.json({ characterId });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch("/api/characters/:id", authenticateRequest, enforceBrandAccess, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const brandId = resolveAuthorizedBrandId(req);
      if (!brandId) return res.status(400).json({ success: false, error: "Missing brandId" });
      const updates = pickCharacterUpdateFields(req.body);
      if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: "No allowed fields provided" });
      await identityEngine.updateCharacter(brandId, id, updates as any);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/characters/:id", authenticateRequest, enforceBrandAccess, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const brandId = resolveAuthorizedBrandId(req);
      if (!brandId) return res.status(400).json({ success: false, error: "Missing brandId" });
      await identityEngine.deleteCharacter(brandId, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/characters/list", authenticateRequest, enforceBrandAccess, async (req: any, res: any) => {
    try {
      const brandId = resolveAuthorizedBrandId(req);
      if (!brandId) return res.status(400).json({ success: false, error: "Missing brandId" });
      const characters = await identityEngine.getCharactersByBrand(brandId);
      res.json({ characters });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
