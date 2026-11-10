// The global object the engines hang their debug hooks on (window in a browser).
export const root = typeof window !== "undefined" ? window : globalThis;
