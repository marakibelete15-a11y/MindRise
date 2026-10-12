'use strict';

// Exception-safe localStorage access. SRS 5.4. TODO: select token persistence policy after security review.
export function getValue(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch (_error) { return null; }
}

export function setValue(key, value) {
  try { globalThis.localStorage?.setItem(key, value); return true; } catch (_error) { return false; }
}

export function removeValue(key) {
  try { globalThis.localStorage?.removeItem(key); return true; } catch (_error) { return false; }
}