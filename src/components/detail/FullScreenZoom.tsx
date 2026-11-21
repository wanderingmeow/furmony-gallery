import { tr } from "../../i18n";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons-svg";
import Panzoom from "@panzoom/panzoom";
import { onImageError, preloadImage } from "../../data/image";
import { AntIcon } from "../ui/AntIcon";
import { watchTaps } from "../ui/tapGate";

/** The three controls over the picture share one look. Tailwind gives a button the default cursor,
 *  so `ENABLED` names the hand and `DISABLED` the flat look of a control at its zoom limit. */
const CONTROL =
  "flex items-center justify-center text-white transition-colors backdrop-blur-lg";
const ENABLED =
  "cursor-pointer bg-black/40 hover:bg-white/15 active:bg-white/25";
const DISABLED = "bg-black/20 text-white/40 cursor-not-allowed";

/** Paint `show` once `pic` has pixels to paint. A layer with none is transparent, so an engine
 *  without `decode` shows the picture underneath for a frame or two rather than a blank box. */
function revealWhenDecoded(pic: HTMLImageElement, show: () => void): void {
  if (!pic.decode) {
    show();
    return;
  }
  pic.decode().then(show, () => {});
}

export function FullScreenZoom(props: {
  imageUrl: string;
  fullUrl: string;
  count: number;
  index: () => number;
  onClose: () => void;
}) {
  let container!: HTMLDivElement;
  let stage!: HTMLDivElement;
  let pz: ReturnType<typeof Panzoom> | null = null;
  const [scale, setScale] = createSignal(1);
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const atMax = () => scale() >= MAX_SCALE - 0.01;
  const atMin = () => scale() <= MIN_SCALE + 0.01;

  // The full picture, laid over the thumbnail once it is ready to paint. The thumbnail keeps its
  // own src, so a whole picture that never arrives costs nothing.
  const [sharp, setSharp] = createSignal(false);

  // Panzoom drives the wrapper that holds both layers, so a reader panned to 3x sees the new pixels
  // land on the old ones: the swap moves nothing.
  createEffect(
    on([() => props.fullUrl, () => props.imageUrl], ([url, thumb]) => {
      setSharp(false);
      if (!url || url === thumb) return;
      const job = preloadImage(url);
      onCleanup(job.cancel);
      void job.ready.then((pic) =>
        revealWhenDecoded(pic, () => setSharp(true)),
      );
    }),
  );

  createEffect(
    on(
      () => props.imageUrl,
      (url) => {
        if (!url) return;
        if (pz) {
          pz.destroy();
          pz = null;
        }

        // Panzoom binds here, so both layers share one transform.
        pz = Panzoom(stage, {
          maxScale: MAX_SCALE,
          minScale: MIN_SCALE,
          contain: "outside",
          cursor: "grab",
        });
        const wheel = (e: WheelEvent) => {
          e.preventDefault();
          if (pz) {
            pz.zoomWithWheel(e);
            setScale(pz.getScale());
          }
        };
        // panzoom fires `panzoomchange` on every transform, whether the wheel, a button or a pinch
        // caused it, so the zoom buttons always show the real scale.
        const onZoomChange = () => {
          if (pz) setScale(pz.getScale());
        };
        stage.addEventListener("panzoomchange", onZoomChange);
        container.addEventListener("wheel", wheel, { passive: false });
        onCleanup(() => {
          stage.removeEventListener("panzoomchange", onZoomChange);
          container.removeEventListener("wheel", wheel);
          pz?.destroy();
          pz = null;
        });
      },
    ),
  );

  // One tap on the picture closes the viewer. The controls stand outside the stage, so anything
  // inside it is the picture.
  onCleanup(
    watchTaps({
      owns: (target) => target === container || stage.contains(target as Node),
      onTap: () => props.onClose(),
    }),
  );

  // document-level keys so they work regardless of focus: Esc/X close, +/- zoom
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "x" || e.key === "X") props.onClose();
      else if (e.key === "+" || e.key === "=" || e.key === "Add") {
        pz?.zoomIn();
        setScale(pz?.getScale() ?? 1);
      } else if (e.key === "-" || e.key === "_" || e.key === "Subtract") {
        pz?.zoomOut();
        setScale(pz?.getScale() ?? 1);
      }
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  // The overlay is z-[70], above the sheet's z-[60]: it opens from inside the sheet and has to cover it.
  return (
    <div
      ref={container}
      class="fixed inset-0 z-[70] bg-black flex items-center justify-center"
    >
      <div ref={stage} class="relative w-full h-full">
        <img
          src={props.imageUrl}
          alt=""
          class="absolute inset-0 w-full h-full object-contain"
          onError={onImageError}
        />
        <Show when={sharp()}>
          <img
            src={props.fullUrl}
            alt=""
            class="absolute inset-0 w-full h-full object-contain"
          />
        </Show>
      </div>

      <button
        class={`${CONTROL} ${ENABLED} absolute w-11 h-11 rounded-full
        top-[calc(1rem+var(--safe-top))] left-[calc(1rem+var(--safe-left))]`}
        onClick={() => props.onClose()}
        aria-label={tr("zoom.close")}
        title={tr("zoom.close")}
      >
        <AntIcon icon={CloseOutlined} size={22} />
      </button>

      <div
        class="absolute flex flex-col gap-2 bottom-[calc(1.5rem+var(--safe-bottom))]
        right-[calc(1.5rem+var(--safe-right))]"
      >
        <button
          class={`${CONTROL} w-9 h-9 rounded ${atMax() ? DISABLED : ENABLED}`}
          disabled={atMax()}
          aria-label={tr("zoom.in")}
          title={tr("zoom.in")}
          onClick={() => {
            pz?.zoomIn();
            setScale(pz?.getScale() ?? 1);
          }}
        >
          <AntIcon icon={ZoomInOutlined} size={20} />
        </button>
        <button
          class={`${CONTROL} w-9 h-9 rounded ${atMin() ? DISABLED : ENABLED}`}
          disabled={atMin()}
          aria-label={tr("zoom.out")}
          title={tr("zoom.out")}
          onClick={() => {
            pz?.zoomOut();
            setScale(pz?.getScale() ?? 1);
          }}
        >
          <AntIcon icon={ZoomOutOutlined} size={20} />
        </button>
      </div>

      <Show when={props.count > 1}>
        <span
          class="pointer-events-none backdrop-blur-lg absolute left-1/2 -translate-x-1/2 px-2 py-1
          rounded bg-black/50 text-white text-xs bottom-[calc(1.5rem+var(--safe-bottom))]"
        >
          {props.index() + 1} / {props.count}
        </span>
      </Show>
    </div>
  );
}
