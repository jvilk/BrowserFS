/**
 * Exports the global scope variable.
 * In the main browser thread, this is "window".
 * In a WebWorker, this is "self".
 * In Node, this is "global".
 * @hidden
 * @private
 */
declare var globalThis: any;
/**
 * @hidden
 */
const toExport: any = typeof(window) !== 'undefined' ? window : typeof(self) !== 'undefined' ? self : typeof (global) !== "undefined" ? global : globalThis;
export default toExport;
