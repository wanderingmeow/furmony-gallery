export type BadgeColor = "red" | "green" | "purple" | "blue" | "amber";

const COLOR_MAP: Record<BadgeColor, string> = {
  red: "bg-red-500/90 text-white",
  green: "bg-green-600/90 text-white",
  purple: "bg-purple-600/90 text-white",
  blue: "bg-blue-600/90 text-white",
  amber: "bg-amber-500/90 text-white",
};

export function StatusBadge(props: { text: string; color: BadgeColor }) {
  return (
    // The row's <dd> is a grid, and a grid stretches its items across the cell. `w-fit` keeps the
    // badge the width of its word.
    <span
      class={`inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${COLOR_MAP[props.color]}`}
    >
      {props.text}
    </span>
  );
}
