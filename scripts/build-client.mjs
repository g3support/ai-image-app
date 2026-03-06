#!/usr/bin/env node

async function run() {
  try {
    const vite = await import('vite');
    await vite.build();
  } catch (error) {
    const message = String(error?.message || error || '');
    const isMissingVite =
      message.includes("Cannot find package 'vite'") ||
      message.includes('Cannot find module') && message.includes('vite');

    if (isMissingVite) {
      console.warn('[build] Vite is not available in this environment. Skipping client build step.');
      process.exit(0);
    }

    throw error;
  }
}

run().catch((error) => {
  console.error('[build] Client build failed:', error);
  process.exit(1);
});
