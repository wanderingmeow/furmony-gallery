import { Detail } from '../routes/Detail'
import { Sheet } from './Sheet'

// Detail sheet = shared Sheet chrome (slide, drag-to-dismiss, blur, scroll-lock)
// + the Detail route. The Detail content owns its close button; the sheet owns
// the backdrop, slide-in/out, gesture and background-scroll limiting.
export function DetailSheet(props: { open: () => boolean; onDismiss: () => void }) {
  return (
    <Sheet open={props.open} onDismiss={props.onDismiss}>
      {(dismiss) => <Detail onClose={dismiss} />}
    </Sheet>
  )
}
