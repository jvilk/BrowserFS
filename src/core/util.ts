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

var fromCharCode = String.fromCharCode;

/**
 * Efficiently converts an array of character codes into a JS string.
 * Avoids an issue with String.fromCharCode when the number of arguments is too large.
 */
export function fromCharCodes(charCodes: number[]): string {
  // 8K blocks.
  var numChars = charCodes.length,
    numChunks = ((numChars - 1) >> 13) + 1,
    chunks: string[] = new Array<string>(numChunks), i: number;
  for (i = 0; i < numChunks; i++) {
    chunks[i] = fromCharCode.apply(String, charCodes.slice(i * 0x2000, (i + 1) * 0x2000));
  }
  return chunks.join("");
}
