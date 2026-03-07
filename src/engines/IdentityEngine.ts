import { resolveSeed } from "./identityModules/seedController.js";
import { getCameraPhysicsPrompt } from "./identityModules/cameraPhysicsController.js";
import { getLightingPrompt } from "./identityModules/lightingController.js";
import { resolveStyling, getStylingPrompt } from "./identityModules/stylingController.js";
import { getGenderRulesPrompt } from "./identityModules/genderRules.js";

import sharp from "sharp";
import { db, bucket } from "../services/firebaseAdmin.js";

export interface StylingConfig {
  hairStyle: string;
  jewelry: string;
  expression: string;
  footwear: string;
  beardStyle?: string;
  watch?: string;
  facialHair?: "clean" | "stubble" | "beard";
  facialHairDensity?: string;
}

export interface CharacterProfile {
  id: string;
  brandId: string;
  name: string;
  gender: "female" | "male";
  baseSeed: number;
  faceReferenceUrl: string;
  faceReferencePath?: string;
  defaultLighting: "soft-left" | "soft-right" | "studio-front";
  defaultFocalLength: number;
  defaultCameraDistance: "standard-full-body";
  defaultStyling: StylingConfig;
  identityLockEnabled: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export class IdentityEngine {

  static async build(ctx: any) {

    const engine = new IdentityEngine();

    let character: CharacterProfile | null = null;

    if (ctx.characterId) {
      try {
        character = await engine.fetchCharacter(ctx.brandId, ctx.characterId);
      } catch (error: any) {
        const message = String(error?.message || error || "");
        if (message.includes("not found")) {
          console.warn(`[IDENTITY] Character ${ctx.characterId} not found for brand ${ctx.brandId}. Continuing without identity lock.`);
        } else {
          throw error;
        }
      }
    }

    const effectiveLockIdentity = Boolean(ctx.lockIdentity && character);

    const seedResult = resolveSeed(effectiveLockIdentity, character?.baseSeed);

    const cameraPhysicsBlock =
      getCameraPhysicsPrompt(effectiveLockIdentity);

    const lightingBlock =
      getLightingPrompt(
        effectiveLockIdentity,
        character?.defaultLighting || "studio-front"
      );

    const genderRulesBlock =
      getGenderRulesPrompt(
        ctx.gender,
        effectiveLockIdentity,
        ctx.productCategory
      );

    const resolvedStyling = resolveStyling(
      ctx.gender,
      effectiveLockIdentity || ctx.freezeStyling,
      character?.defaultStyling || engine.getDefaultStyling(ctx.gender),
      ctx.stylingOverride
    );

    const stylingBlock =
      getStylingPrompt(ctx.gender, resolvedStyling);

    const identityBlock =
      await engine.buildIdentityBlock(effectiveLockIdentity, character);

    return {

      seed: seedResult.seed,

      identityPromptBlock: `
        ${identityBlock}
        ${genderRulesBlock}
      `,

      physicsPromptBlock: `
        ${cameraPhysicsBlock}
        ${lightingBlock}
      `,

      stylingPromptBlock: stylingBlock,

      // IMPORTANT: never return signed URL as base64
      referenceImageBase64: null

    };

  }


  private async getShortLivedFaceUrl(character: CharacterProfile): Promise<string> {
    if (character.faceReferencePath) {
      const [signedUrl] = await bucket.file(character.faceReferencePath).getSignedUrl({
        action: "read",
        expires: Date.now() + 15 * 60 * 1000
      });
      return signedUrl;
    }

    // Backward compatibility for older records that persisted a long-lived URL.
    return character.faceReferenceUrl;
  }

  private async buildIdentityBlock(
    lockIdentity: boolean,
    character: CharacterProfile | null
  ): Promise<string> {

    if (lockIdentity && character) {

      return `
        SECTION 2 — IDENTITY ENGINE (IDENTITY LOCK ACTIVE)

        Use the provided reference face EXACTLY.

        Reference image URL:
        ${await this.getShortLivedFaceUrl(character)}

      `;

    }

    return `
      SECTION 2 — IDENTITY ENGINE (IDENTITY LOCK MODE DISABLED)

      Generate a new realistic Indian model.

    `;

  }

  private getDefaultStyling(
    gender: "female" | "male"
  ): StylingConfig {

    if (gender === "male") {

      return {
        hairStyle: "professional short",
        jewelry: "none",
        expression: "neutral",
        footwear: "standard"
      };

    }

    return {
      hairStyle: "professional bun",
      jewelry: "minimal",
      expression: "neutral",
      footwear: "standard"
    };

  }

  private async fetchCharacter(
    brandId: string,
    characterId: string
  ): Promise<CharacterProfile> {

    const doc =
      await db
        .collection("brands")
        .doc(brandId)
        .collection("characters")
        .doc(characterId)
        .get();

    if (!doc.exists) {
      throw new Error(`Character ${characterId} not found`);
    }

    return doc.data() as CharacterProfile;

  }

  async saveCharacter(data: any): Promise<string> {

    if (!data.referenceImageBase64) {
      throw new Error("referenceImageBase64 missing");
    }

    const characterId =
      `char_${Math.random().toString(36).slice(2, 9)}`;

    const baseSeed =
      Math.floor(Math.random() * 2147483647) + 1;

    if (!data.referenceImageBase64.includes(",")) {
      throw new Error("Invalid image format");
    }

    const base64 = data.referenceImageBase64.split(",")[1];

    const buffer = Buffer.from(base64, "base64");

    const metadata = await sharp(buffer).metadata();

    const faceBuffer =
      await sharp(buffer)

        .extract({
          left: 0,
          top: 0,
          width: metadata.width || 1200,
          height: Math.floor((metadata.height || 1600) * 0.6)
        })

        .resize(600, 800, {
          fit: "cover",
          position: "attention"
        })

        .jpeg({
          quality: 90
        })

        .toBuffer();

    const storagePath =
      `brands/${data.brandId}/characters/${characterId}.jpg`;

    const file = bucket.file(storagePath);

    await file.save(faceBuffer, {

      metadata: {
        contentType: "image/jpeg"
      },

      resumable: false

    });

    const [faceReferenceUrl] =
      await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 15 * 60 * 1000
      });

    const newCharacter: CharacterProfile = {

      id: characterId,
      brandId: data.brandId,
      name: data.name,
      gender: data.gender,

      baseSeed,

      faceReferenceUrl,
      faceReferencePath: storagePath,

      defaultLighting: "studio-front",
      defaultFocalLength: 85,
      defaultCameraDistance: "standard-full-body",

      defaultStyling:
        data.defaultStyling ||
        this.getDefaultStyling(data.gender),

      identityLockEnabled: true,

      isDeleted: false,

      createdAt: Date.now(),
      updatedAt: Date.now()

    };

    await db
      .collection("brands")
      .doc(data.brandId)
      .collection("characters")
      .doc(characterId)
      .set(newCharacter);

    console.log(JSON.stringify({
      severity: "INFO",
      event: "character_saved",
      characterId,
      brandId: data.brandId,
      storagePath
    }));

    return characterId;

  }

  async getCharactersByBrand(
    brandId: string
  ): Promise<CharacterProfile[]> {

    const snapshot =
      await db
        .collection("brands")
        .doc(brandId)
        .collection("characters")
        .where("isDeleted", "==", false)
        .get();

    const characters = snapshot.docs.map(
      doc => doc.data() as CharacterProfile
    );

    return Promise.all(characters.map(async (character) => ({
      ...character,
      faceReferenceUrl: await this.getShortLivedFaceUrl(character)
    })));

  }

  async updateCharacter(
    brandId: string,
    id: string,
    updates: Partial<CharacterProfile>
  ): Promise<void> {

    const characterRef = db
      .collection("brands")
      .doc(brandId)
      .collection("characters")
      .doc(id);

    const existing = await characterRef.get();
    if (!existing.exists) {
      throw new Error(`Character ${id} not found for brand ${brandId}`);
    }

    await characterRef.update({
      ...updates,
      updatedAt: Date.now()
    });

  }

  async deleteCharacter(brandId: string, id: string): Promise<void> {

    const characterRef = db
      .collection("brands")
      .doc(brandId)
      .collection("characters")
      .doc(id);

    const existing = await characterRef.get();
    if (!existing.exists) {
      throw new Error(`Character ${id} not found for brand ${brandId}`);
    }

    await characterRef.update({
      isDeleted: true,
      updatedAt: Date.now()
    });

  }

}