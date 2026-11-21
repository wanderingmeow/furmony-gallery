// src/data/encodedSetting.ts - a setting that reaches the app in base64.
//
// `.env` holds both values that a repository copy does not carry in base64, and the build passes
// them through, so the built files hold no address and no key in plain text.

/** The plain value, or '' when this build was given none or the value is not base64. Each feature
 *  reads '' as off. */
export function decodeSetting(encoded: string): string {
  try {
    return atob(encoded.trim());
  } catch {
    return "";
  }
}
