/**
 * The ⌫ key as the iOS keyboard prints it. Ant Design ships no backspace glyph, so this one is
 * drawn here at the stroke weight the antd marks beside it in the field use.
 */
export function BackspaceIcon(props: {
  size?: string | number;
  class?: string;
}) {
  const size = () => props.size ?? "1em";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size()}
      height={size()}
      class={props.class}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      style={{
        display: "inline-block",
        "flex-shrink": 0,
        "user-select": "none",
      }}
    >
      <path d="M7.92 5c-.58 0-1.14.26-1.52.7L2.12 10.7c-.64.75-.64 1.85 0 2.6l4.28 5c.38.45.94.7 1.52.7H19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H7.92Z" />
      <path d="m15 10-4 4M11 10l4 4" />
    </svg>
  );
}
