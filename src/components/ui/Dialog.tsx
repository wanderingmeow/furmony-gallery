import { createUniqueId, For, type JSXElement, Show } from "solid-js";
import { Portal } from "solid-js/web";
import {
  BACKDROP,
  BACKDROP_IN,
  BACKDROP_OUT,
  holdFocus,
  holdScroll,
  usePresence,
} from "./overlay";

// 280ms: the dim's departure (./theme.css) is the slowest part of the layer's.
const LEAVE_MS = 280;

export interface DialogAction {
  label: string;
  onPress: () => void;
  tone?: "recommended" | "second" | "destructive";
}

// min-h-12 is the 48px every other target holds to (--fab-size, --field-h). A label that needs a
// second line grows past it.
const PILL =
  "flex min-h-12 items-center justify-center rounded-full px-4 py-2 text-[15px] font-semibold " +
  "text-center outline-none transition-opacity active:opacity-70";

/** The accent fill is the answer the plate expects, so it is the one a user can take without
 *  reading; red words mark what cannot be taken back, and the app never recommends one.
 *  Only the plain fill carries a hairline: 8% of black over a white plate is a 1.19 luminance step,
 *  too small for a fill to draw a shape on its own, while the accent is a 2.9 step and a neutral
 *  line over a saturated fill only dirties the edge. border-box, so the line costs no height. */
const TONE = {
  recommended: "bg-accent text-white",
  second: "border border-border bg-black/8 dark:bg-white/12",
  destructive:
    "border border-border bg-black/8 dark:bg-white/12 text-red-600 dark:text-red-400",
} as const;

/** A question that waits before the page goes on: the page behind stops taking input and stops
 *  scrolling, and it goes soft behind a dim. Only a button answers it - a tap on the dim is more
 *  often a misaim than a choice - and Escape answers, because the platform binds it to cancel and
 *  cancel is never the destructive one. `holdFocus` keeps the page behind unreachable. */
export function Dialog(props: {
  open: () => boolean;
  onClose: () => void;
  title: string;
  children: JSXElement;
  actions: DialogAction[];
}) {
  const titleId = createUniqueId();
  const bodyId = createUniqueId();
  // eslint-disable-next-line solid/reactivity -- usePresence reads it inside its own effect
  const { shown, closing } = usePresence(props.open, LEAVE_MS);
  let plate: HTMLDivElement | undefined;

  const motion = () =>
    closing()
      ? "animate-dialog-out motion-reduce:animate-fade-quiet-out"
      : "animate-dialog-in motion-reduce:animate-fade-quiet-in";

  holdScroll(shown, () => plate ?? null);

  holdFocus({
    open: () => props.open(),
    onClose: () => props.onClose(),
    getPlate: () => plate,
  });

  return (
    <Show when={shown()}>
      <Portal>
        <div class="fixed inset-0 z-[70]">
          <div
            data-dialog="dim"
            class={`${BACKDROP} ${closing() ? BACKDROP_OUT : BACKDROP_IN}`}
          />
          <div class="absolute inset-0 grid place-items-center p-5">
            <div
              ref={plate}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={bodyId}
              tabindex={-1}
              class={`glass ${motion()} max-h-[calc(100svh-2.5rem)] touch-pan-y
                overscroll-contain overflow-y-auto w-full max-w-[19.5rem] rounded-[26px]
                border border-border px-6 pt-6 pb-5 text-ink shadow-xl outline-none`}
            >
              <h2
                id={titleId}
                class="text-[17px] font-semibold leading-snug tracking-tight"
              >
                {props.title}
              </h2>
              <div
                id={bodyId}
                class="mt-2 space-y-2 text-[15px] leading-snug opacity-65"
              >
                {props.children}
              </div>
              <div class="dialog-actions mt-5 grid gap-3">
                <For each={props.actions}>
                  {(action) => (
                    <button
                      class={`${PILL} ${TONE[action.tone ?? "second"]}`}
                      onClick={() => action.onPress()}
                    >
                      {action.label}
                    </button>
                  )}
                </For>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
