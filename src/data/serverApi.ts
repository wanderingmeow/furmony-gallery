// The one machine this app sends anything to: the address is decoded once here, and `PATH` says
// what that machine answers. A new server feature is one line in `PATH` and one call where it is
// used.
import { decodeSetting } from "./encodedSetting";

// Set at build time, base64, and the origin only. The paths are this file's to know, so an
// address that names one endpoint cannot make the others look broken when a path moves.
const ENCODED = String(import.meta.env.VITE_SERVER_ORIGIN_B64 ?? "");

/** https, a host with a dot in it, and nothing after the host. '' for a build that was given no
 *  server, which every feature reads as off.
 */
export function serverOrigin(raw: string): string {
  // Labels only: a port, a query or a path that survived the paste has to fail here rather
  // than reach the server as `/search/search`.
  const at = raw.trim().toLowerCase().replace(/\/+$/, "");
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(at) ? at : "";
}

export const SERVER_ORIGIN = serverOrigin(decodeSetting(ENCODED));

/** Every path this app calls on that machine. */
export const PATH = {
  search: "/search",
  searchPicture: "/search-image",
  ping: "/ping",
} as const;

export type ServerPath = (typeof PATH)[keyof typeof PATH];

/** '' when this build has no server, so a caller tests one string instead of two. */
export function serverUrl(path: ServerPath): string {
  return SERVER_ORIGIN ? `${SERVER_ORIGIN}${path}` : "";
}

export const serverConfigured = SERVER_ORIGIN !== "";
