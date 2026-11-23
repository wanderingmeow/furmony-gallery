import { For, Show } from "solid-js";
import { AntIcon } from "./AntIcon";
import { TICK } from "./icons";

export interface Choice<V extends string> {
  value: V;
  label: string;
}

/**
 * A grid of cells where exactly one is chosen, for names too long to sit in segments side by side.
 *
 * Radio inputs in one group, so the arrow keys move the choice and a screen reader counts the
 * options. Only the chosen cell shows the tick, and the other cells keep the same room, so the
 * names do not slide when the reader picks one.
 */
export function ChoiceGrid<V extends string>(props: {
  value: () => V;
  onChange: (v: V) => void;
  items: Choice<V>[];
  /** The group's name, for a screen reader. */
  label: string;
  /** Cells per row. Four names read best as two rows of two. */
  columns?: 2 | 3;
}) {
  const grid = () => (props.columns === 3 ? "grid-cols-3" : "grid-cols-2");
  return (
    <div role="group" aria-label={props.label} class={`grid gap-1 ${grid()}`}>
      <For each={props.items}>
        {(s) => {
          const on = () => props.value() === s.value;
          return (
            <label
              class={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs
                      has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accent
                      ${
                        on()
                          ? "bg-accent/15 border-accent/40 text-accent-soft font-medium"
                          : "bg-surface border-border"
                      }`}
            >
              <input
                type="radio"
                name={props.label}
                value={s.value}
                checked={on()}
                onChange={() => props.onChange(s.value)}
                class="sr-only"
              />
              <span class="truncate">{s.label}</span>
              <span
                class="ml-auto w-3 flex items-center justify-center text-accent"
                aria-hidden="true"
              >
                <Show when={on()}>
                  <AntIcon icon={TICK} size={11} />
                </Show>
              </span>
            </label>
          );
        }}
      </For>
    </div>
  );
}
