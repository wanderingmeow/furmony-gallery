// src/draw/haptics.ts - the buzz that a web page can get.
//
// There is no haptics API. Safari gives a buzz to one control, `<input type="checkbox" switch>`, and
// it buzzes when the reader turns it. So the code puts a label over the control and that switch
// inside the label: a tap on the label turns the switch, and that turn comes from the reader, so it
// buzzes. The sizes and the hit test are in haptics.css.

export const canBuzz = (): boolean =>
  "switch" in document.createElement("input");

/** Put a label over `el` with that switch inside it, so a tap on `el` turns the switch and buzzes.
 *  The switch turns whether or not the control took the tap, so the page has to keep it in step with
 *  what it shows: `hooks/useHaptic.ts` does that. */
export function hapticTap(el: HTMLElement): HTMLInputElement | null {
  if (!canBuzz()) return null;
  const already = el.querySelector<HTMLInputElement>(
    ":scope > .haptic-hit > .haptic-switch",
  );
  if (already) return already;
  const label = document.createElement("label");
  label.className = "haptic-hit";
  label.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.className = "haptic-switch";
  // The control that this sits in says what it is, so this copy stays away from screen readers and
  // out of the tab order.
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  // The label forwards the tap to this switch. That forwarded click is the same tap the control
  // already saw, so it stops here.
  input.addEventListener("click", (e) => e.stopPropagation());
  label.append(input);
  el.append(label);
  return input;
}
