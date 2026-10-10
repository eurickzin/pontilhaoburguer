const OWNER_SESSION_KEY = "pontilhao-admin-session";
const OWNER_PASSWORD_HASH_KEY = "pontilhao-admin-password-hash";

async function hashOwnerPassword(password) {
  if (!crypto?.subtle) throw new Error("A autenticação precisa que o site seja aberto em HTTPS ou localhost.");
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
