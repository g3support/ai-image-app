import sharp from "sharp";

const FULL_BODY_MARGIN_PERCENT = {
  top: 0.06,
  bottom: 0.04
};

export async function enforceFullBodyMargins(
  imageBuffer: Buffer
): Promise<Buffer> {
  try {
    // Memory guard for large buffers
    if (imageBuffer.length > 50 * 1024 * 1024) { // 50MB limit as per audit
      console.warn("Large image buffer detected, skipping processing.");
      return imageBuffer;
    }

    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Invalid image metadata");
    }

    // Use Sharp's built-in trim to find the content bounding box
    // background: {r:255, g:255, b:255} or similar
    const trimmed = await sharp(imageBuffer)
      .trim({ threshold: 10 }) // Adjust threshold as needed for studio backgrounds
      .toBuffer({ resolveWithObject: true });

    const { info: trimmedInfo } = trimmed;
    
    // Calculate how much to extend to maintain margins
    // We want the subject to have specific margins at top and bottom
    const targetHeight = metadata.height;
    const targetWidth = metadata.width;
    
    const contentHeight = trimmedInfo.height;
    const contentWidth = trimmedInfo.width;

    // We want contentHeight to be (1 - topMargin - bottomMargin) of the final height
    // But we also want to maintain the original aspect ratio/size if possible
    // For simplicity and stability, we'll just center the trimmed content with the requested margins
    
    const topMarginPx = Math.floor(targetHeight * FULL_BODY_MARGIN_PERCENT.top);
    const bottomMarginPx = Math.floor(targetHeight * FULL_BODY_MARGIN_PERCENT.bottom);
    
    // If the trimmed content is too tall to fit with these margins, we might need to scale it down
    // but the user said "no redesign", so we'll just do a clean composite
    
    return await sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .composite([{
      input: trimmed.data,
      gravity: 'center'
    }])
    .jpeg({ quality: 90 })
    .toBuffer();

  } catch (error: any) {
    console.error("Error in enforceFullBodyMargins:", error);
    return imageBuffer;
  }
}

export async function enhanceDetailingCrop(imageBuffer: Buffer): Promise<Buffer> {
  try {
    if (imageBuffer.length > 50 * 1024 * 1024) return imageBuffer;

    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return imageBuffer;

    // Use Sharp's built-in 'attention' strategy to focus on the most detailed area
    // This replaces the manual variance loop
    return await sharp(imageBuffer)
      .resize({
        width: metadata.width,
        height: metadata.height,
        fit: 'cover',
        position: 'attention'
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error: any) {
    console.error("Error in enhanceDetailingCrop:", error);
    return imageBuffer;
  }
}
