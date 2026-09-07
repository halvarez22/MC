/**
 * Almacén de sesión de auth (mock Firebase).
 * sessionStorage: exige login al reabrir la app / nueva pestaña.
 * Limpia la clave legacy en localStorage (migración).
 */

import type { User } from '../types';

export const AUTH_USER_STORAGE_KEY = 'firebase.auth.user';

function purgeLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredAuthUser(): User | null {
  purgeLegacyLocalStorage();
  try {
    const raw = sessionStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: User): void {
  purgeLegacyLocalStorage();
  sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredAuthUser(): void {
  purgeLegacyLocalStorage();
  try {
    sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
