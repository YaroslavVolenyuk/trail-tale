// Story 2.3 — device_id (generated once, stored in localStorage)

const KEY = 'tt:device_id';
let memoryId: string | null = null;

function memoryFallback(): string {
  if (!memoryId) memoryId = crypto.randomUUID();
  return memoryId;
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode Safari fallback
    return memoryFallback();
  }
}
