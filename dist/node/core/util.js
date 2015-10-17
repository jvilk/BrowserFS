/**
 * Grab bag of utility functions used across the code.
 */
exports.isIE = typeof navigator !== "undefined" && (/(msie) ([\w.]+)/.exec(navigator.userAgent.toLowerCase()) != null || navigator.userAgent.indexOf('Trident') !== -1);
exports.isWebWorker = typeof window === "undefined";
var fromCharCode = String.fromCharCode;
function fromCharCodes(charCodes) {
    var numChars = charCodes.length, numChunks = ((numChars - 1) >> 13) + 1, chunks = new Array(numChunks), i;
    for (i = 0; i < numChunks; i++) {
        chunks[i] = fromCharCode.apply(String, charCodes.slice(i * 0x2000, (i + 1) * 0x2000));
    }
    return chunks.join("");
}
exports.fromCharCodes = fromCharCodes;
//# sourceMappingURL=util.js.map