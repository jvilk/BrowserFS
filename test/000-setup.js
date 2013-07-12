(function() {
  // Test-related setup code.
  BrowserFS.install(this);

  // Make these things global
  window.tests = {};
  window.fs = BrowserFS.node.fs;
  window.path = BrowserFS.node.path;
  window.process = BrowserFS.node.process;
  // Polyfill for Node's 'common' module that it uses for its unit tests.
  window.common = {
      tmpDir: '/tmp/',
      fixturesDir: '/test/fixtures/node',
      // NodeJS uses 'common.error' for test messages, but this is inappropriate.
      // I map it to log, instead.
      error: function() { console.log.apply(console, arguments); }
  };
  window.Buffer = BrowserFS.node.Buffer;

  // Prevent Karma from auto-executing.
  __karma__.loaded = function() {};

  // Polyfill for `process.on('exit')`.
  process.on = function(trigger, cb) {
    if (trigger == 'exit') {
      process._exitCb = cb;
    } else {
      throw new Error("Unsupported trigger: " + trigger);
    }
  };
})(this);
