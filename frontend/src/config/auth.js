// Configuration for Passcode Authentication on GitHub Pages / App

export const AUTH_CONFIG = {
  // Default Passcode: "card-trading-2026"
  // SHA-256 Hash of "card-trading-2026"
  PASSCODE_HASH: "23cf106b1297073245aa5d54a50d2f0eb3cbfa1ad84a7e937d1dd1f2a32cfa8a",
  PASSCODE_PLAIN_DEV: "card-trading-2026",
  SESSION_STORAGE_KEY: "tcg_auth_token_v1"
};

export async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
