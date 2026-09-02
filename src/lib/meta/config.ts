import "server-only";
import { MetaError } from "@/lib/meta/errors";

export type MetaServerConfig = {
  appId: string;
  loginConfigId: string;
  redirectUri: string;
  graphApiVersion: string;
};

function envTrim(name: string): string {
  return (process.env[name] ?? "").trim();
}

function requireEnv(name: string): string {
  const value = envTrim(name);
  if (!value) {
    throw new MetaError(
      "META_CONFIG_MISSING",
      "Configurazione Meta incompleta.",
    );
  }
  return value;
}

/** True solo se le env server richieste sono presenti. Non lanciare in import. */
export function isMetaServerConfigReady(): boolean {
  return Boolean(
    envTrim("META_APP_ID") &&
      envTrim("META_APP_SECRET") &&
      envTrim("META_LOGIN_CONFIG_ID") &&
      envTrim("META_REDIRECT_URI") &&
      envTrim("META_TOKEN_ENCRYPTION_KEY") &&
      envTrim("META_GRAPH_API_VERSION"),
  );
}

/**
 * Config pubblica lato server (senza secret).
 * Lanciare solo quando si invoca una funzione Meta, non al boot dell'app.
 */
export function getMetaServerConfig(): MetaServerConfig {
  return {
    appId: requireEnv("META_APP_ID"),
    loginConfigId: requireEnv("META_LOGIN_CONFIG_ID"),
    redirectUri: requireEnv("META_REDIRECT_URI"),
    graphApiVersion: requireEnv("META_GRAPH_API_VERSION"),
  };
}

/** App secret: solo in memoria server, mai in oggetti serializzati o log. */
export function getMetaAppSecret(): string {
  return requireEnv("META_APP_SECRET");
}

export function getMetaTokenEncryptionKeyConfigured(): boolean {
  return Boolean(envTrim("META_TOKEN_ENCRYPTION_KEY"));
}
