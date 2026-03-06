import crypto from "crypto";
import { auth as firebaseAuth } from "../services/firebaseAdmin.js";

export const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";
export const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN || "";

export function tokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function authenticateRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!AUTH_REQUIRED) return next();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (SERVICE_AUTH_TOKEN && tokenEquals(token, SERVICE_AUTH_TOKEN)) {
    (req as any).authContext = { method: "service-token" };
    return next();
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    (req as any).authContext = { method: "firebase", decodedToken };
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}

export function enforceBrandAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  const decodedToken = (req as any).authContext?.decodedToken;
  if (!decodedToken) return next();

  const tokenBrandId =
    decodedToken.brandId ||
    decodedToken.brand_id ||
    (Array.isArray(decodedToken.brands) ? decodedToken.brands[0] : undefined);

  const requestBrandId = (req.body?.brandId as string | undefined) || (req.query?.brandId as string | undefined);

  if (tokenBrandId && requestBrandId && tokenBrandId !== requestBrandId) {
    return res.status(403).json({ success: false, error: "Forbidden for this brandId" });
  }

  return next();
}

export function resolveAuthorizedBrandId(req: express.Request): string | undefined {
  const decodedToken = (req as any).authContext?.decodedToken;
  const tokenBrandId =
    decodedToken?.brandId ||
    decodedToken?.brand_id ||
    (Array.isArray(decodedToken?.brands) ? decodedToken.brands[0] : undefined);

  return tokenBrandId || (req.body?.brandId as string | undefined) || (req.query?.brandId as string | undefined);
}
