/// <reference types="vite/client" />

/**
 * Game version from the repo-root version.json, inlined at build time by
 * vite.config.ts's `define`. Same file the backend reads - see
 * backend/app/core/config.py.
 */
declare const __GAME_VERSION__: string
