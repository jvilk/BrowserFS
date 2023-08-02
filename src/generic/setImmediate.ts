/**
 * @hidden
 */
export default typeof globalThis.setImmediate == 'function' ? globalThis.setImmediate : cb => setTimeout(cb, 0);
