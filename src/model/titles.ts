/**
 * The name of a screen, on the button that opens it and on the screen itself. It lives apart from
 * the code that computes the numbers, because the button shows the name before that code arrives.
 */
import { tr } from '../i18n'

export const statsTitle = (): string => tr('chrome.stats')
