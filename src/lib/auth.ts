const textEncoder = new TextEncoder();

let cachedDigestPromise: Promise<string> | null = null;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }

  return globalThis.crypto.subtle;
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const data = textEncoder.encode(value);
  const hashBuffer = await subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const AUTH_COOKIE_NAME = "workshop-auth";

export function isPasswordConfigured(): boolean {
  return Boolean(process.env.WORKSHOP_PORTAL_PASSWORD && process.env.WORKSHOP_PORTAL_PASSWORD.trim().length > 0);
}

export async function getPasswordDigest(): Promise<string> {
  if (!isPasswordConfigured()) {
    throw new Error("Workshop portal password is not configured.");
  }

  if (!cachedDigestPromise) {
    cachedDigestPromise = sha256Hex(process.env.WORKSHOP_PORTAL_PASSWORD!.trim());
  }

  return cachedDigestPromise;
}

export async function hashPasswordCandidate(candidate: string): Promise<string> {
  return sha256Hex(candidate.trim());
}
