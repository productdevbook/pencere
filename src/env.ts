/** SSR guard — true when running in a browser-like environment. */
export const isBrowser: boolean = typeof document !== "undefined"
