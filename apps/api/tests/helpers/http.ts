import { env } from '../../src/env.js';

/** The Origin every test must send on a POST/PUT/PATCH/DELETE — enforceOriginAndContentType is global. */
export const ALLOWED_ORIGIN = env.ALLOWED_ORIGINS[0]!;
