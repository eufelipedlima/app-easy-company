export const ESCOPOS_GOOGLE_CALENDAR = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function redirectUriGoogle(origin: string) {
  return `${origin}/api/google/callback`;
}
