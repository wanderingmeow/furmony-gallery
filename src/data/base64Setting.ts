// A setting that reaches the app in base64.
//
// `.env` carries the two values in base64 so the repository does not hold them, and the build
// passes them through: the built files hold no address and no key in plain text.

/** The plain value, or '' when this build was given none or the value is not base64. Each feature
 *  reads '' as off. */
export function decodeSetting(encoded: string): string {
  try {
    return atob(encoded.trim());
  } catch {
    return "";
  }
}
