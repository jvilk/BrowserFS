// Test-related setup code.
BrowserFS.Install(this);
var assert = require('assert');
var fs = BrowserFS.node.fs;
var path = BrowserFS.node.path;
var process = BrowserFS.node.process;
var common = BrowserFS.common;
var Buffer = BrowserFS.node.Buffer;
window.tests = {};

// Change to test directory.
process.chdir('/Users/jvilk/Code/BrowserFS');
// Initialize the LocalStorage filesystem.
var lsfs = new BrowserFS.FileSystem.LocalStorage();
lsfs.empty();
BrowserFS.node.fs.initiate(lsfs);
