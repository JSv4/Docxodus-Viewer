// WASM base path - needs to be relative to the deployed URL base
// In production on GitHub Pages, assets are at /Docxodus-Viewer/
// The WASM files are in /Docxodus-Viewer/wasm/
export const WASM_BASE_PATH = import.meta.env.BASE_URL + 'wasm/';
