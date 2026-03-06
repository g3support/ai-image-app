// Ambient declarations to allow type-checking in restricted CI/container environments
// where npm registry access can block installation of runtime package typings.

declare module 'express' {
  const express: any;
  export = express;
}

declare module 'vite' {
  export const createServer: any;
  export const defineConfig: any;
  export const loadEnv: any;
}

declare module '@google/genai' {
  export const GoogleGenAI: any;
}

declare module 'dotenv' {
  const dotenv: any;
  export default dotenv;
}

declare module 'helmet' {
  const helmet: any;
  export default helmet;
}

declare module 'sharp' {
  const sharp: any;
  export default sharp;
}

declare module 'firebase-admin' {
  const admin: any;
  export default admin;
}

declare module 'crypto' {
  const crypto: any;
  export default crypto;
}

declare module 'path' {
  const path: any;
  export default path;
}

declare const process: any;
declare const console: any;
declare const setTimeout: any;
declare const clearTimeout: any;
declare const setInterval: any;
declare const clearInterval: any;
declare class AbortController {
  signal: any;
  abort(reason?: any): void;
}

type Buffer = any;
declare const Buffer: any;


declare namespace express {
  type Request = any;
  type Response = any;
  type NextFunction = any;
}


declare module '@tailwindcss/vite' {
  const plugin: any;
  export default plugin;
}

declare module '@vitejs/plugin-react' {
  const plugin: any;
  export default plugin;
}

declare module 'react' {
  export const StrictMode: any;
  export function useState<T = any>(initial: T): [T, (value: any) => void];
  export function useRef<T = any>(initial: T): { current: T };
  export function useEffect(effect: () => any, deps?: any[]): void;
  const React: {
    ChangeEvent: any;
  };
  export default React;
}

declare namespace React {
  type ChangeEvent<T = any> = any;
}

declare module 'react-dom/client' {
  export const createRoot: any;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'lucide-react' {
  export const Upload: any;
  export const User: any;
  export const UserCircle: any;
  export const CheckCircle2: any;
  export const Loader2: any;
  export const Image: any;
  export const Download: any;
  export const RefreshCw: any;
  export const Lock: any;
  export const Unlock: any;
  export const ChevronRight: any;
  export const Plus: any;
  export const X: any;
  export const ArrowLeft: any;
  export const Edit2: any;
  export const Key: any;
  export const ExternalLink: any;
  export const AlertCircle: any;
  export const ZoomIn: any;
  export const Maximize2: any;
  export const Minimize2: any;
  export const RotateCcw: any;
  export const Search: any;
  export const Trash2: any;
}

declare module 'motion/react' {
  export const motion: any;
  export const AnimatePresence: any;
}

declare module 'react-zoom-pan-pinch' {
  export const TransformWrapper: any;
  export const TransformComponent: any;
}

declare const __dirname: string;

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
