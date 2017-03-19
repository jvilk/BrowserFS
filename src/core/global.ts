/**
 * Exports the global scope variable.
 * In the main browser thread, this is "window".
 * In a WebWorker, this is "self".
 * In Node, this is "global".
 * @hidden
 * @private
 */
declare var global: any;
/**
 * @hidden
 */
let toExport: any;
if (typeof(window) !== 'undefined') {
  toExport = window;
} else if (typeof(self) !== 'undefined') {
  toExport = self;
} else {
  toExport = global;
}
export default toExport;
