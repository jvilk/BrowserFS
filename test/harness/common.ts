// Polyfill for Node's 'common' module that it uses for its unit tests.

// Calleable things aren't always Functions... IE9 is dumb :(
// http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
if (typeof console.log == "object") {
  if (Function.prototype.bind) {
    // Let us use Function.apply, dangit!
    console.log = Function.prototype.bind.call(console.log, console);
  } else {
    // IE<9 does not define bind. :(
    // Use a half-assed polyfill function.
    console.log = (function (oglog: (message?: any, ...optionalParams: any[]) => void) {
      return function () {
          switch (arguments.length) {
            case 0:
              return oglog();
            case 1:
              return oglog(arguments[0]);
            case 2:
              return oglog(arguments[0], arguments[1]);
            case 3:
              return oglog(arguments[0], arguments[1], arguments[2]);
            case 4:
              return oglog(arguments[0], arguments[1], arguments[2], arguments[3]);
            case 5:
              return oglog(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
            default:
              oglog("WARNING: Calling console.log with > 5 arguments...");
              return oglog(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
          }
        }
    })(console.log);
  }
}

export = {
  tmpDir: '/tmp/',
  fixturesDir: '/test/fixtures/files/node',
  // NodeJS uses 'common.error' for test messages, but this is inappropriate.
  // I map it to log, instead.
  error: function () { console.log.apply(console, arguments); }
};
