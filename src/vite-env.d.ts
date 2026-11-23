/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SEARCH_URL_B64?: string;
  readonly VITE_TRANSLATE_KEY_B64?: string;
  /** Set by a build made with `VITE_MOCK=1`; the dev server reads the copies without it. */
  readonly VITE_MOCK?: boolean;
}
