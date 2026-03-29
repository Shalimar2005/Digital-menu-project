interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  // add other env variables here if you have more
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}