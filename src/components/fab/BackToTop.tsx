import { createMemo } from "solid-js";
import { VerticalAlignTopOutlined } from "@ant-design/icons-svg";
import { AntIcon } from "../ui/AntIcon";
import { FabCircle } from "./FabCircle";
import { tr } from "../../i18n";

/** At the far end of the page from the two circles that answer what the list is. */
export function BackToTop(props: {
  scrollTop: () => number;
  onTop: () => void;
}) {
  const show = () => props.scrollTop() > 0;
  // How far through the page the user stands, drawn as the ring around the circle.
  const progress = createMemo(() => {
    const max = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    return Math.min(1, Math.max(0, props.scrollTop() / max));
  });

  // half the difference in height, so this circle's centre and the pill's land on one line
  return (
    <div
      class={`fixed z-[45]
              right-[calc(1rem+var(--safe-right))]
              bottom-[calc(1rem+var(--safe-bottom)+(var(--seg-h-glass)-var(--fab-size))/2)]`}
    >
      {/* The box takes the circle's height back while the user stands at the top of the page and
          there is nowhere to go back to, so the circle never arrives as a jump. */}
      <div
        class="transition-[margin-bottom,opacity,transform,visibility] duration-300
                ease-chrome motion-reduce:transition-none"
        classList={{
          "invisible scale-75 opacity-0 mb-[calc(-1*var(--fab-size)-0.5rem)]":
            !show(),
        }}
      >
        <FabCircle
          class="float-progress"
          title={tr("chrome.toTop")}
          style={{ "--float-btn-progress": `${progress()}turn` }}
          onClick={props.onTop}
        >
          <AntIcon icon={VerticalAlignTopOutlined} size={22} />
        </FabCircle>
      </div>
    </div>
  );
}
