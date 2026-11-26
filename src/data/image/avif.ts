// The AVIF answer for this browser: asked once at start, read when an address is written.
import { offscreenImage } from "./load";

let avif = false;

/** Call once, at start. The answer arrives a frame later, so a picture asked for before it gets
 *  webp. */
export function probeAvif(): void {
  const probe =
    "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAAQ0AAAAZAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGhpcHJwAAAASWlwY28AAAAUaXNwZQAAAAAAAAABAAAAAQAAAA5waXhpAAAAAAEIAAAADGF2MUOBABwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAIW1kYXQSAAoHGAAGmAhoNTIMHYWd3HAsrJA1kW5f";
  const pic = offscreenImage();
  pic.onload = () => {
    avif = pic.naturalWidth > 0;
  };
  // A browser that cannot decode the format reports it by error, or by a picture of no size.
  pic.onerror = () => {
    avif = false;
  };
  pic.src = probe;
}

/** Whether the Bilibili addresses ask for AVIF. Only `hosts.ts` writes a format. */
export function supportsAvif(): boolean {
  return avif;
}
