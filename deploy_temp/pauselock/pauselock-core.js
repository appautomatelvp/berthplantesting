/**
 * PauseLock core — hash SHA-256, session token, rate limit.
 * Dung chung cho pauselock.js (static HTML) va pauselock.jsx (React).
 *
 * - Mat khau chi so sanh qua passwordHash (khong plain text)
 * - sessionStorage luu token dẫn xuat, khong phai "1"
 * - 5 lan sai -> khoa 30 giay (client-side)
 *
 * Xem pauselock/plan.md de biet cach trien khai day du.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

async function digestHex(value) {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export async function hashPassword(plain) {
  return digestHex(String(plain));
}

export async function createUnlockToken(passwordHash, sessionKey, sessionSalt) {
  return digestHex(`${passwordHash}:${sessionKey}:${sessionSalt}`);
}

export async function verifyPassword(plain, passwordHash) {
  const candidate = await hashPassword(plain);
  if (candidate.length !== passwordHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    mismatch |= candidate.charCodeAt(i) ^ passwordHash.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function isPauseLockUnlocked(config) {
  try {
    const stored = sessionStorage.getItem(config.sessionKey);
    if (!stored) return false;
    const expected = await createUnlockToken(
      config.passwordHash,
      config.sessionKey,
      config.sessionSalt
    );
    if (stored.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < stored.length; i += 1) {
      mismatch |= stored.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

export async function setPauseLockUnlocked(config) {
  try {
    const token = await createUnlockToken(
      config.passwordHash,
      config.sessionKey,
      config.sessionSalt
    );
    sessionStorage.setItem(config.sessionKey, token);
  } catch {
    // ignore
  }
}

export function createAttemptLimiter() {
  let failures = 0;
  let lockedUntil = 0;

  return {
    canAttempt() {
      return Date.now() >= lockedUntil;
    },
    msUntilRetry() {
      return Math.max(0, lockedUntil - Date.now());
    },
    recordFailure() {
      failures += 1;
      if (failures >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_MS;
        failures = 0;
      }
    },
    reset() {
      failures = 0;
      lockedUntil = 0;
    },
  };
}
