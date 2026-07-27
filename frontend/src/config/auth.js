// Cryptographically Secure Passcode Authentication Config
// Contains ONLY the one-way SHA-256 cryptographic hash fingerprint

export const AUTH_CONFIG = {
  // One-way SHA-256 hash fingerprint of the secret passcode
  PASSCODE_HASH: "af8134fcae21edc431e6e095d482387f4ac37eb625ab9a6ec93fc1574370f917",
  SESSION_STORAGE_KEY: "tcg_auth_token_v1"
};

export async function hashPasscode(passcode) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
