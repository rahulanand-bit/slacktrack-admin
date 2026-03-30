const TOKEN_KEY = 'slacktrack_admin_token';
const PROFILE_KEY = 'slacktrack_admin_profile';

export type SessionProfile = {
  id?: number;
  email?: string;
  role?: 'admin' | 'hr' | 'manager' | 'analytics';
  permissions?: string[];
};

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getSessionProfile(): SessionProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionProfile;
  } catch {
    return null;
  }
}

export function setSessionProfile(profile: SessionProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function hasPermission(permission: string): boolean {
  const profile = getSessionProfile();
  const permissions = profile?.permissions;
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes('*') || permissions.includes(permission);
}

export function clearSessionToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
