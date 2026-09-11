/** Human-readable messages for backend OAuth `?error=` codes. */

const MESSAGES: Record<string, string> = {
  facebook_state: "Security check failed. Please try logging in again.",
  facebook_denied: "Facebook login was cancelled.",
  facebook_failed: "Facebook login failed. Please try again.",
};

export function facebookCallbackErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "Facebook login failed. Please try again.";
}
