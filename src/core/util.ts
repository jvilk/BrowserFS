/**
 * Grab bag of utility functions used across the code.
 */

/**
 * Checks for any IE version, including IE11 which removed MSIE from the
 * userAgent string.
 */
export var isIE: boolean = typeof navigator !== "undefined" && (/(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) != null || navigator.userAgent.indexOf('Trident') !== -1);

/**
 * Check if we're in a web worker.
 */
export var isWebWorker: boolean = typeof window === "undefined";
