
// Test glue!
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

// wait for the rest of the tests to be loaded.
setImmediate(function(){
  describe("Buffer test suite", function() {
    it("runs the buffer tests", function() {
      window.tests.buffer();
      window.tests.buffer_ascii();
      window.tests.buffer_concat();
      waitsFor(function() {
        return window.__numWaiting() === 0;
      }, "All callbacks should fire", 600000);
    });
  });
  describe("Path test suite", function() {
    it("runs the path tests", function() {
      window.tests.path();
      window.tests.path_makelong();
      waitsFor(function() {
        return window.__numWaiting() === 0;
      }, "All callbacks should fire", 600000);
    });
  });
  describe("FS test suite", function() {
    it("runs the fs tests", function() {
      window.tests.fs_append_file();
      window.tests.fs_chmod();
      window.tests.fs_exists();
      window.tests.fs_long_path();
      window.tests.fs_mkdir();
      window.tests.fs_open();
      window.tests.fs_stat();
      waitsFor(function() {
        return window.__numWaiting() === 0;
      }, "All callbacks should fire", 600000);
    });
  });
});
