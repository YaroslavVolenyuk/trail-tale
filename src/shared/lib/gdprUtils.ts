export const CONSENT_VERSION = 'v1.2025-01';
const CONSENT_KEY = 'tt:consent';

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function grantConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
  } catch {
    /* private mode — ignore */
  }
}
