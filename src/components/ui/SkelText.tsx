import { SK_FILL } from "./boxes";
import { SK_BOX } from "./skeletonView";

/**
 * The bar that stands in for a word the app cannot write yet. The shelf answers a listing's name,
 * description and painter in the language the request asked for, and that answer lands a moment
 * after the reader picks a language. A span, because the words it replaces sit inside a line of
 * text, and the caller names the size so the bar holds the room the word will take.
 */
export const SkelText = (props: { class?: string }) => (
  <span
    aria-hidden="true"
    class={`inline-block align-middle ${SK_FILL} ${SK_BOX} rounded ${props.class ?? ""}`}
  />
);
