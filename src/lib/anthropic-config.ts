/**
 * Config Anthropic server-side only.
 * NON esportare in client / NEXT_PUBLIC.
 */

/** Fallback se `ANTHROPIC_MODEL` non è impostata. Vision + text. */
export const ANTHROPIC_MODEL_DEFAULT = "claude-sonnet-5";

/**
 * Model ID usato da tutte le route AI.
 * Override: env `ANTHROPIC_MODEL` (server only).
 */
export function anthropicModelId(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return ANTHROPIC_MODEL_DEFAULT;
}
