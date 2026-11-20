// src/draw/haptics.ts - the buzz that a web page can get.
//
// There is no haptics API. Safari gives a buzz to one control, `<input type="checkbox" switch>`, and
// it buzzes when the reader turns it. So the code puts an invisible copy of that control under the
// reader's finger, and a tap or a drag turns it.

import './haptics.css'

export const canBuzz = (): boolean => 'switch' in document.createElement('input')

/** Put a switch under `el`, so the reader's taps and drags turn it. iOS writes into that switch when
 *  the reader turns it, so the page has to keep it in step with what it shows:
 *  `components/ui/useHaptic.ts` does that for a control. */
export function hapticTap(el: HTMLElement): HTMLInputElement | null {
  if (!canBuzz()) return null
  const already = el.querySelector<HTMLInputElement>(':scope > .haptic-hit > .haptic-switch')
  if (already) return already
  const label = document.createElement('label')
  label.className = 'haptic-hit'
  label.setAttribute('aria-hidden', 'true')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.className = 'haptic-switch'
  // The control that this sits in says what it is, so this copy stays away from screen readers and
  // out of the tab order.
  input.tabIndex = -1
  input.setAttribute('aria-hidden', 'true')
  label.append(input)
  el.append(label)
  return input
}
