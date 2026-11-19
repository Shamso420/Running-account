// The username lives in the Supabase user's own profile data (user_metadata.username),
// so it needs no database change. It is only a display name; sign-in still uses the email.

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 24;

export function getUsername(user) {
  const v = user?.user_metadata?.username;
  return typeof v === 'string' ? v.trim() : '';
}

// Shown in greetings: the username if set, otherwise a name made from the email.
export function displayName(user) {
  const set = getUsername(user);
  if (set) return set;
  const first = String(user?.email || '').split('@')[0].split(/[._\-+]/)[0].replace(/\d+$/, '');
  if (!first) return 'there';
  const name = first.charAt(0).toUpperCase() + first.slice(1);
  return name.length > 14 ? `${name.slice(0, 13)}…` : name;
}

// Returns an error message, or '' when the name is fine.
export function validateUsername(raw) {
  const v = String(raw || '').trim();
  if (v.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (v.length > USERNAME_MAX) return `Username can be at most ${USERNAME_MAX} characters.`;
  return '';
}
