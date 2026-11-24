import { Show, type JSX } from "solid-js";
import { CloseOutlined, PictureOutlined } from "@ant-design/icons-svg";
import { tr } from "../../i18n";
import { AntIcon } from "../ui/AntIcon";
import { BACKSPACE } from "../ui/icons";
import {
  CHROME_ACTS,
  CHROME_ACTS_HOLD,
  CHROME_PLATE,
  CHROME_PLATE_BOX,
  CHROME_PLATE_REST,
} from "../ui/boxes";

/** A circle on the field's right edge: 40px, because these stand inside the box and the corner's pair
 *  stands outside it. */
function Act(props: {
  label: string;
  pressed?: () => boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <button
      class="relative cursor-pointer w-10 h-10 shrink-0 grid place-items-center rounded-full
             transition-[background-color,color,transform] duration-150 active:scale-[0.92]
             motion-reduce:transition-none"
      classList={{
        "text-ink active:bg-black/10 dark:active:bg-white/10":
          !props.pressed?.(),
        "bg-accent text-white active:bg-accent-ink": !!props.pressed?.(),
      }}
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed === undefined ? undefined : props.pressed()}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}

/** The plate the circles stand on, and the row they keep their place in while the box grows around
 *  them: a circle that left the row would drag the picture's circle along with it. */
export function FieldPlate(props: {
  open: () => boolean;
  typed: () => boolean;
  pictureOn: () => boolean;
  semanticOn: () => boolean;
  onFocusField: () => void;
  onClose: () => void;
  onClearText: () => void;
  onTogglePicture: () => void;
}) {
  return (
    <div
      data-chrome="plate"
      class={`${CHROME_PLATE} ${props.open() ? CHROME_PLATE_BOX : CHROME_PLATE_REST}`}
      style={{
        right: props.open()
          ? "var(--plate-air)"
          : "calc(100% - var(--fab-size))",
      }}
      onClick={() => props.open() && props.onFocusField()}
    >
      <div class={CHROME_ACTS_HOLD}>
        <div
          data-chrome="acts"
          class={CHROME_ACTS}
          classList={{ "invisible opacity-0": !props.open() }}
        >
          <div classList={{ invisible: props.pictureOn() }}>
            <Act
              label={props.typed() ? tr("search.clear") : tr("search.close")}
              onClick={() =>
                props.typed() ? props.onClearText() : props.onClose()
              }
            >
              {/* A field with a query is text to take back, so the mark is the delete key. An empty
                  field has nothing to take, and the mark is the way out of the box. */}
              {props.typed() ? (
                <AntIcon icon={BACKSPACE} size={20} />
              ) : (
                <AntIcon icon={CloseOutlined} size={18} />
              )}
            </Act>
          </div>
          {/* A picture is the other half of the enhanced search, so it leaves with the switch that
              turns that search off. */}
          <Show when={props.semanticOn()}>
            <Act
              label={tr("picture.find")}
              pressed={props.pictureOn}
              onClick={props.onTogglePicture}
            >
              <AntIcon icon={PictureOutlined} size={18} />
            </Act>
          </Show>
        </div>
      </div>
    </div>
  );
}
