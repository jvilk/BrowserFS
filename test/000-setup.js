// Test-related setup code.
BrowserFS.Install(this);
var assert = window.assert;
var fs = BrowserFS.node.fs;
var path = BrowserFS.node.path;
var process = BrowserFS.node.process;
var common = BrowserFS.common;
var Buffer = BrowserFS.node.Buffer;
window.tests = {};

// Initialize the LocalStorage filesystem.
var lsfs = new BrowserFS.FileSystem.LocalStorage();
lsfs.empty();
BrowserFS.node.fs.initiate(lsfs);

// Polyfill for `process.on('exit')`.
process.on = function(trigger, cb) {
  if (trigger == 'exit') {
    process._exitCb = cb;
  } else {
    throw new Error("Unsupported trigger: " + trigger);
  }
};
