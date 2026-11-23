import { tr } from "../../i18n";
import {
  dismissStorageWarning,
  storageGuide,
  storageOnIos,
  storageRisk,
} from "../../stores/persistenceStore";
import { Dialog } from "./Dialog";
import { heldLast } from "./overlay";

/** The notice for a browser that may delete the saved list. It uses the install words the browser's
 *  own menu uses, and ends with a link to Apple's page for that device. */
export function StorageWarning() {
  // 知道了 writes "none" to the same signal that picks this line, and the notice stays on screen for
  // its own fade. Read directly, that write swaps the sentence mid-fade, because the install line
  // and the keep line are different sentences of different lengths.
  const heldRisk = heldLast(() =>
    storageRisk() === "none" ? undefined : storageRisk(),
  );
  const wayOut = () => {
    if (heldRisk() !== "install") return "storage.keepLine";
    return storageOnIos() ? "storage.installIosLine" : "storage.installMacLine";
  };

  return (
    <Dialog
      open={() => storageRisk() !== "none"}
      onClose={dismissStorageWarning}
      title={tr("storage.title")}
      actions={[{ label: tr("common.gotIt"), onPress: dismissStorageWarning }]}
    >
      <p>{tr("storage.fact")}</p>
      <p class="mt-3">
        {tr(wayOut())}
        <a
          class="text-accent underline decoration-2 underline-offset-4"
          href={storageGuide()}
          target="_blank"
          rel="noopener"
        >
          {tr("storage.appleGuide")}
        </a>
      </p>
      <p class="mt-3">{tr("storage.visitLine")}</p>
    </Dialog>
  );
}
