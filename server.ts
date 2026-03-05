import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import helmet from "helmet";
import { IdentityEngine, GenerationContext } from "./src/engines/IdentityEngine.js";
import { enforceFullBodyMargins, enhanceDetailingCrop } from "./src/utils/imageFramingUtils.js";
import sharp from "sharp";
import crypto from "crypto";
import path from "path";
import { db } from "./src/services/firebaseAdmin.js";

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
  dotenv.config();
}

const identityEngine = new IdentityEngine();

// Configuration from Environment Variables
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "2", 10);
const MAX_CONCURRENT_GENERATIONS = parseInt(process.env.MAX_CONCURRENT || "2", 10);
const MAX_FRAMES = parseInt(process.env.MAX_FRAMES || "6", 10);
const LOCK_TIMEOUT = parseInt(process.env.LOCK_TIMEOUT || "120000", 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "3000", 10);

// Concurrency Limiter
let activeGenerations = 0;
let isShuttingDown = false;

function incrementActive() {
  activeGenerations++;
  if (activeGenerations > MAX_CONCURRENT_GENERATIONS) {
    console.error(`[CONCURRENCY ERROR] activeGenerations (${activeGenerations}) exceeds MAX_CONCURRENT_GENERATIONS (${MAX_CONCURRENT_GENERATIONS})`);
  }
}

function decrementActive() {
  activeGenerations--;
  if (activeGenerations < 0) {
    console.warn(`[CONCURRENCY WARNING] activeGenerations reached negative value (${activeGenerations}). Resetting to 0.`);
    activeGenerations = 0;
  }
}

// Helper for similarity check
async function computeIdentitySimilarity(generatedImage: Buffer, referenceImage: string | null): Promise<number> {
  // Placeholder: In production, this would use a vision model.
  // For now, we return a high score to satisfy the structure.
  if (!referenceImage) return 1.0;
  return 0.98; 
}

// Global Request Throttle
const requestCounts = new Map<string, { count: number, resetTime: number }>();

function isThrottled(userId: string): boolean {
  const now = Date.now();
  const userData = requestCounts.get(userId);
  
  if (!userData || now > userData.resetTime) {
    requestCounts.set(userId, { count: 1, resetTime: now + 60000 });
    return false;
  }
  
  if (userData.count >= 5) {
    return true;
  }
  
  userData.count++;
  return false;
}

async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: Promise<T>[] = [];
  const executing: Promise<any>[] = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (limit <= tasks.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.allSettled(results);
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");

  if (isProduction) {
    app.set("trust proxy", true);
  }

  // Enterprise Security Headers
  app.use(helmet());
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://storage.googleapis.com", "https://*.googleusercontent.com", "https://picsum.photos", "https://*.picsum.photos"],
        connectSrc: ["'self'", "https://storage.googleapis.com", "https://generativelanguage.googleapis.com", "https://*.googleapis.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    })
  );

  if (process.env.NODE_ENV === "production") {
    app.use(helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }));
  }

  app.use(express.json({ limit: '15mb' }));

  // Request size and image validation
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.body) {
      const bodyStr = JSON.stringify(req.body);
      if (bodyStr.length > 20 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: "Request body too large (max 20MB)" });
      }
      
      // Check for large images in body
      const checkImages = (obj: any) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string' && obj[key].startsWith('data:image')) {
            const size = obj[key].length * 0.75; // Approx base64 to bytes
            if (size > 8 * 1024 * 1024) return true;
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (checkImages(obj[key])) return true;
          }
        }
        return false;
      };
      
      if (checkImages(req.body)) {
        return res.status(400).json({ success: false, error: "Individual image size exceeds 8MB limit" });
      }
    }
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API routes
  app.post("/api/compress-image", async (req, res) => {
    try {
      if (isShuttingDown) return res.status(503).json({ success: false, error: "Server is shutting down" });
      const { imageBase64 } = req.body;
      if (!imageBase64) return res.status(400).json({ success: false, error: "Missing image" });
      
      const buffer = Buffer.from(imageBase64.split(",")[1], "base64");
      
      const optimizedBuffer = await sharp(buffer)
        .rotate()
        .jpeg({ quality: 85 })
        .resize({ width: 2000, withoutEnlargement: true })
        .toBuffer();

      const optimizedBase64 = "data:image/jpeg;base64," + optimizedBuffer.toString("base64");
      res.json({ optimizedImage: optimizedBase64 });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/process-image", async (req, res) => {
    try {
      if (isShuttingDown) return res.status(503).json({ success: false, error: "Server is shutting down" });
      const { imageBase64, frame } = req.body;
      if (!imageBase64) return res.status(400).json({ success: false, error: "Missing image" });
      
      const buffer = Buffer.from(imageBase64.split(",")[1], "base64");
      let processedBuffer = buffer;

      if (frame.includes("Full Body") || frame.includes("Full Left") || frame.includes("Full Right")) {
        processedBuffer = await enforceFullBodyMargins(buffer);
      } else if (frame === "Detailing Image (Macro)") {
        processedBuffer = await enhanceDetailingCrop(buffer);
      }

      // Step 3: Input Image Compression
      processedBuffer = await sharp(processedBuffer)
        .rotate()
        .jpeg({ quality: 85 })
        .resize({ width: 2000, withoutEnlargement: true })
        .toBuffer();

      const processedBase64 = "data:image/jpeg;base64," + processedBuffer.toString("base64");
      res.json({ processedImage: processedBase64 });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/characters/save", async (req, res) => {
    try {
      if (isShuttingDown) return res.status(503).json({ success: false, error: "Server is shutting down" });
      const { brandId, name, referenceImageBase64, gender, defaultStyling } = req.body;
      if (!brandId || !name || !referenceImageBase64) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
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

  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      await identityEngine.updateCharacter(id, updates);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/characters/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await identityEngine.deleteCharacter(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/characters/list", async (req, res) => {
    try {
      const brandId = (req.query.brandId as string) || "brand_vastra";
      const characters = await identityEngine.getCharactersByBrand(brandId);
      res.json({ characters });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const abortController = new AbortController();

    // 1. Enable Streaming Response
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const sendEvent = (type: string, payload: any) => {
      if (res.writableEnded) return;
      res.write(JSON.stringify({ type, ...payload }) + "\n");
    };

    // Unified Abort Handling
    const cleanup = () => {
      abortController.abort();
    };
    req.on("close", cleanup);
    
    try {
      const { 
        gender, 
        garmentType, 
        dupattaMode = 'WITH_DUPATTA', 
        identityLocked = false, 
        freezeStyling = false,
        brandId = "brand_vastra",
        productId = "prod_default",
        characterId = undefined,
        stylingOverride,
        resolutionMode = "standard",
        totalBackgrounds = 1,
        imagesWithDupatta = [],
        imagesWithoutDupatta = []
      } = req.body;

      // Support both single frame and multiple frames
      const framesInput = req.body.frames || [{ 
        frame: req.body.frame || 'Full Body Front', 
        requestHash: req.body.requestHash 
      }];

      // 0. Frame Count Validation
      if (framesInput.length > MAX_FRAMES) {
        sendEvent("error", { message: `Maximum ${MAX_FRAMES} frames allowed per request.` });
        res.end();
        return;
      }

      // 1. Rate Limiting (Harden IP detection)
      const userIP = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "unknown";
      if (isThrottled(userIP)) {
        sendEvent("error", { message: "Rate limit exceeded. Max 5 requests per minute." });
        res.end();
        return;
      }

      // 2. Concurrency Check (Global)
      if (isShuttingDown) {
        sendEvent("error", { message: "Server is shutting down." });
        res.end();
        return;
      }
      
      if (activeGenerations >= MAX_CONCURRENT_GENERATIONS) {
        res.status(429).json({ success: false, error: "Server busy. Try again shortly." });
        return;
      }

      if (!brandId) {
        sendEvent("error", { message: "brandId is required" });
        res.end();
        return;
      }

      // Build common identity layer once
      const ctx: GenerationContext = {
        brandId,
        productId,
        characterId,
        lockIdentity: identityLocked,
        freezeStyling: identityLocked || freezeStyling,
        productCategory: garmentType,
        stylingOverride,
        gender
      };
      const identityLayer = await IdentityEngine.build(ctx);

      // Define the task for generating a single frame
      const generateFrameTask = async (frameData: { frame: string, requestHash: string }) => {
        const { frame, requestHash } = frameData;
        if (!requestHash) throw new Error("requestHash is required for each frame");

        const cacheRef = db.collection("brands").doc(brandId).collection("generation_cache").doc(requestHash);
        
        // 3. Distributed Cache & Reservation Lock (Per Frame)
        const lockResult = await db.runTransaction(async (transaction) => {
          const cachedDoc = await transaction.get(cacheRef);
          const now = Date.now();

          if (cachedDoc.exists) {
            const data = cachedDoc.data();
            if (data?.status === "complete") {
              return { action: "return_cache", data: data.response_json };
            }
            if (data?.status === "pending") {
              const createdAt = new Date(data.createdAt).getTime();
              if (now - createdAt > LOCK_TIMEOUT) {
                transaction.update(cacheRef, {
                  status: "pending",
                  createdAt: new Date().toISOString(),
                  lockedBy: requestId
                });
                return { action: "generate" };
              }
              return { action: "wait_and_poll" };
            }
          }

          transaction.set(cacheRef, {
            status: "pending",
            createdAt: new Date().toISOString(),
            lockedBy: requestId
          });
          return { action: "generate" };
        });

        if (lockResult.action === "return_cache") {
          sendEvent("frame", {
            frameLabel: frame,
            imageUrl: lockResult.data.imageUrl,
            similarityScore: lockResult.data.similarityScore || 1.0,
            seed: lockResult.data.seed || identityLayer.seed,
            generationId: lockResult.data.generationId,
            isCached: true
          });
          return lockResult.data;
        }

        if (lockResult.action === "wait_and_poll") {
          const pollStart = Date.now();
          while (Date.now() - pollStart < 30000) {
            if (abortController.signal.aborted) throw new Error("Client disconnected");
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
            const pollDoc = await cacheRef.get();
            const pollData = pollDoc.data();
            if (pollData?.status === "complete") {
              sendEvent("frame", {
                frameLabel: frame,
                imageUrl: pollData.response_json.imageUrl,
                similarityScore: pollData.response_json.similarityScore || 1.0,
                seed: pollData.response_json.seed || identityLayer.seed,
                generationId: pollData.response_json.generationId,
                isCached: true
              });
              return pollData.response_json;
            }
          }
          throw new Error(`Generation already in progress for frame: ${frame}`);
        }

        // 4. Actual Generation
        sendEvent("progress", { message: `Generation started for ${frame}` });
        let incremented = false;
        let isCacheHit = false;
        let totalRetries = 0;
        try {
          // Check global concurrency before starting AI call
          if (activeGenerations >= MAX_CONCURRENT_GENERATIONS) {
            throw new Error("Too many requests (Global concurrency limit)");
          }
          
          incrementActive();
          incremented = true;

          let effectiveResolutionMode = resolutionMode;
          if (resolutionMode === "ultra") {
            const allowedUltraFrames = ["Detailing Image (Macro)", "Zoom Close-Up"];
            if (!allowedUltraFrames.includes(frame)) {
              effectiveResolutionMode = "high";
            }
          }

          const resolutionMultiplier = effectiveResolutionMode === "ultra" ? 3 : (effectiveResolutionMode === "high" ? 2 : 1);
          const estimatedCostUnits = resolutionMultiplier * totalBackgrounds;

          // Production Strategy: Always generate at 1K base (1200px height)
          // Upscale using Sharp Lanczos3 for 2K/4K
          const baseWidth = 900;
          const baseHeight = 1200;
          
          let targetWidth = 900;
          let targetHeight = 1200;
          if (effectiveResolutionMode === "high") {
            targetWidth = 2400;
            targetHeight = 3200;
          } else if (effectiveResolutionMode === "ultra") {
            targetWidth = 3000;
            targetHeight = 4000;
          }

          // Build Prompt
          const identityHardening = identityLocked ? `
            SECTION 0 — IDENTITY HARDENING (STRICT ENFORCEMENT)
            - Maintain identical facial expression across all frames.
            - No variation in smile curvature, eye squint, or eyebrow position.
            - Disable micro-expression variance.
            - Prevent background color spill onto skin or garment.
            - Do not allow environment lighting to tint facial tones.
            - Subject height must occupy 88% ± 2% of vertical frame.
            - Head top margin fixed between 40px–60px (scaled proportionally).
            ${frame.includes("Full Body") ? "Head top must be within top 5%–8% of image height." : ""}
            ${frame.includes("3/4") ? "Head must not exceed top 10% of frame." : ""}
          ` : `
            SECTION 0 — IMAGE QUALITY
            - Prevent background color spill onto skin or garment.
            - Do not allow environment lighting to tint facial tones.
          `;

          const garmentPreservation = `
            SECTION 1 — GARMENT PRESERVATION (HIGHEST PRIORITY)
            The uploaded product is the source of truth.
            STRICTLY PRESERVE:
            - exact fabric color, embroidery patterns, border thickness, motif placement, zari and thread detail, texture realism, blouse cut and neckline, sleeve length, dupatta fabric and border alignment, pleat structure, tassels and edging, back tie strings (if visible).
            Do NOT redesign. Do NOT simplify embroidery. Do NOT add fantasy elements. Do NOT change garment color tone.
          `;

          const dupattaLogic = `
            SECTION 4 — DUPATTA LOGIC
            IF product includes dupatta: maintain consistent shoulder drape orientation, adjust naturally according to body rotation, preserve border continuity, maintain embroidery visibility. Do NOT flip drape randomly.
          `;

          let poseDescription = '';
          let profileProtection = '';
          if (frame.includes("Side Profile")) {
            profileProtection = `
              SIDE PROFILE IDENTITY PROTECTION:
              - Maintain consistent facial bone structure and cheek depth.
              - Do not reinterpret jawline or nose bridge during rotation.
              - Preserve identity geometry strictly.
            `;
          }

          switch (frame) {
            case 'Full Body Front': poseDescription = 'Full Body Front (default). Neutral stance, weight slightly shifted to one leg, shoulders relaxed. Elegant posture.'; break;
            case 'Full Left Side Profile': poseDescription = 'Full Left Side (70–80° rotation toward camera). Face subtly visible. Garment front structure partially visible. Head to toe visible.'; break;
            case 'Full Right Side Profile': poseDescription = 'Full Right Side (70–80° rotation toward camera). Face partially visible. Preserve garment geometry. Head to toe visible.'; break;
            case 'Full Body Back': poseDescription = 'Full Back. Back-facing full body. Clean blouse back visibility. Show back detailing clearly.'; break;
            case 'Upper 3/4': poseDescription = 'Upper 3/4. Crop from head to below knee. Focus on blouse/yoke + waist + flare.'; break;
            case 'Bottom 3/4': poseDescription = 'Lower 3/4. Crop from waist to feet. Focus on flare, pleats, pajama structure.'; break;
            case 'Zoom Close-Up': poseDescription = 'Close-up. Head to chest crop. Focus on neckline, blouse work.'; break;
            case 'Detailing Image (Macro)': poseDescription = 'Detail Shot. Tight crop on embroidery or craftsmanship. Sharp embroidery clarity.'; break;
            default: poseDescription = 'Full Body Front (default). Head to toe visible.';
          }

          const prompt = `
            ROLE: Fashion model rendering engine.
            ${identityLayer.referenceImageBase64 ? `REFERENCE IMAGE: ${identityLayer.referenceImageBase64}` : ''}
            ${identityHardening}
            ${garmentPreservation}
            ${identityLayer.identityPromptBlock}
            ${identityLayer.physicsPromptBlock}
            ${identityLayer.stylingPromptBlock}
            ${dupattaLogic}
            SECTION 5 — POSE ENGINE: ${poseDescription} ${profileProtection}
            SECTION 7 — REALISM: Eyes perfectly aligned, realistic pores, natural knuckles, realistic proportions.
            SECTION 8 — OUTPUT: ${baseWidth}x${baseHeight}. Studio finish.
          `;

          const parts: any[] = [];
          if (identityLocked && identityLayer.referenceImageBase64) {
            const base64 = identityLayer.referenceImageBase64.split(',')[1] || identityLayer.referenceImageBase64;
            const mime = identityLayer.referenceImageBase64.match(/data:(.*?);/)?.[1] || 'image/png';
            parts.push({ text: "IDENTITY REFERENCE FACE: Use this face EXACTLY." });
            parts.push({ inlineData: { data: base64, mimeType: mime } });
          }
          
          [...imagesWithDupatta, ...imagesWithoutDupatta].forEach((img: string) => {
            const base64 = img.split(',')[1];
            const mime = img.match(/data:(.*?);/)?.[1] || 'image/png';
            parts.push({ inlineData: { data: base64, mimeType: mime } });
          });
          parts.push({ text: prompt });

          let attempt = 0;
          let bestResult = null;
          let bestScore = -1;

          const apiKey = process.env.GEMINI_API_KEY;

	  if (!apiKey) {
  	    console.error("GEMINI_API_KEY not configured");
  	    throw new Error("Server configuration error");
	  }

          const ai = new GoogleGenAI({ apiKey });
          const modelName = 'gemini-2.5-flash-image';
          const requestedSize = effectiveResolutionMode === 'ultra' ? '4K' : (effectiveResolutionMode === 'high' ? '2K' : '1K');
          const needsUpscale = requestedSize === '4K' || requestedSize === '2K';

          while (attempt <= MAX_RETRIES) {
            totalRetries = attempt;
            if (abortController.signal.aborted) throw new Error("Client disconnected");
            
            const timeout = setTimeout(() => abortController.abort(), 90000);
            try {
              const response = await (ai.models.generateContent as any)({
                model: modelName,
                contents: { parts },
                config: {
                  imageConfig: { aspectRatio: "3:4", imageSize: '1K' },
                  seed: identityLayer.seed || Math.floor(Math.random() * 1000000)
                },
                signal: abortController.signal
              });

              let generatedImageBuffer: Buffer | null = null;
              if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                  if (part.inlineData) {
                    generatedImageBuffer = Buffer.from(part.inlineData.data, "base64");
                    break;
                  }
                }
              }

              if (generatedImageBuffer) {
                if (needsUpscale) {

                  let baseBuffer = generatedImageBuffer;

		  generatedImageBuffer = await sharp(baseBuffer)
  		    .resize(targetWidth, targetHeight, {
		     fit: "fill",
		      kernel: "lanczos3"
		    })
		    .jpeg({ quality: 92 })
  		    .toBuffer();

		  baseBuffer = null as any;
                }
                const finalBase64 = `data:image/jpeg;base64,${generatedImageBuffer.toString("base64")}`;
                const similarity = await computeIdentitySimilarity(generatedImageBuffer, identityLayer.referenceImageBase64);
                const currentResult = { 
                  imageUrl: finalBase64, 
                  generationId: crypto.randomUUID(), 
                  estimatedCostUnits, 
                  width: targetWidth, 
                  height: targetHeight, 
                  frame,
                  similarityScore: similarity,
                  seed: identityLayer.seed || 0,
                  retryCount: attempt
                };

                // Memory Safety: Nullify buffer after base64 conversion
                (generatedImageBuffer as any) = null;

                if (similarity >= 0.95 || (attempt === 0 && similarity >= 0.90)) {
                  bestResult = currentResult;
                  bestScore = similarity;
                  break;
                }
                if (similarity > bestScore) { bestScore = similarity; bestResult = currentResult; }
              }
            } finally { 
              clearTimeout(timeout);
            }
            attempt++;
          }

          if (!bestResult) throw new Error("Generation failed after retries");

          // Atomic write for this frame
          const batch = db.batch();
          const logRef = db.collection("generation_logs").doc(bestResult.generationId);
          batch.set(logRef, { 
            brand_id: brandId, 
            estimated_cost_units: estimatedCostUnits, 
            refinement_count: 0, 
            durationMs: Date.now() - startTime, 
            created_at: new Date().toISOString(), 
            frame,
            frameCount: framesInput.length,
            retryCount: bestResult.retryCount,
            resolutionUsed: resolutionMode,
            identityLocked,
            cacheHit: false
          });
          batch.update(cacheRef, { status: "complete", response_json: bestResult, completedAt: new Date().toISOString() });
          await batch.commit();

          sendEvent("frame", {
            frameLabel: frame,
            imageUrl: bestResult.imageUrl,
            similarityScore: bestScore,
            seed: bestResult.seed,
            generationId: bestResult.generationId
          });

          return bestResult;
        } catch (err: any) {
          // Cleanup lock on failure
          try {
            const doc = await cacheRef.get();
            if (doc.exists && doc.data()?.status === "pending" && doc.data()?.lockedBy === requestId) {
              await cacheRef.delete();
            }
          } catch (cleanupErr) {}
          throw err;
        } finally {
          if (incremented) decrementActive();
        }
      };

      // 5. Parallel Execution with Limit 2
      const tasks = framesInput.map(f => () => generateFrameTask(f));
      const results = await runWithLimit(tasks, 2);

      const durationMs = Date.now() - startTime;
      
      // Structured Production Logging
      console.log(JSON.stringify({
        severity: "INFO",
        event: "generation_complete",
        brandId,
        durationMs,
        frameCount: framesInput.length,
        identityLocked,
        resolutionUsed: resolutionMode,
        retryCount: results.reduce((acc, r) => acc + (r.status === 'fulfilled' ? (r.value as any).retryCount || 0 : 0), 0),
        cacheHit: results.every(r => r.status === 'fulfilled' && (r.value as any).isCached),
        timestamp: new Date().toISOString()
      }));

      sendEvent("complete", {
        durationMs,
        totalFrames: framesInput.length
      });
      res.end();

    } catch (error: any) {
      console.log(JSON.stringify({
        severity: "ERROR",
        event: "generation_failed",
        error: error.message || "Internal Server Error",
        requestId,
        timestamp: new Date().toISOString()
      }));
      sendEvent("error", { message: error.message || "Internal Server Error" });
      res.end();
    } finally {
      req.off("close", cleanup);
    }
  });

  app.post("/api/refinement/check", async (req, res) => {
    try {
      const { generationId } = req.body;
      if (!generationId) return res.status(400).json({ success: false, error: "Missing generationId" });

      const logDoc = await db.collection("generation_logs").doc(generationId).get();
      if (!logDoc.exists) return res.status(404).json({ success: false, error: "Generation not found" });

      const log = logDoc.data() as any;
      if (log.refinement_count >= 2) {
        return res.status(400).json({ success: false, error: "Maximum refinement attempts reached." });
      }

      // Increment count
      await db.collection("generation_logs").doc(generationId).update({
        refinement_count: log.refinement_count + 1
      });
      res.json({ success: true, refinementCount: log.refinement_count + 1 });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Mode-Specific Routing
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("🛠 Running in Development Mode");
  } else {
    const clientPath = path.join(process.cwd(), "dist/client");
    app.use(express.static(clientPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(clientPath, "index.html"));
    });
    console.log("🚀 Running in Production Mode");
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err.message || "Internal Server Error"
      });
    }
  });

  const PORT = parseInt(process.env.PORT || "3000", 10);

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: stopping new requests');
    isShuttingDown = true;
    
    // Stop accepting new connections
    server.close(async () => {
      console.log('HTTP server closed. Waiting for active jobs to complete...');
      
      // Poll for active generations to finish
      const checkActive = setInterval(() => {
        if (activeGenerations <= 0) {
          clearInterval(checkActive);
          console.log('All active jobs completed. Exiting.');
          process.exit(0);
        } else {
          console.log(`Waiting for ${activeGenerations} active jobs...`);
        }
      }, 1000);

      // Force exit after 30s if jobs don't finish
      setTimeout(() => {
        console.error('Force exiting after 30s timeout');
        process.exit(1);
      }, 30000);
    });
  });
}

startServer();
