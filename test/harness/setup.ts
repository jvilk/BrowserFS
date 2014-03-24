/// <reference path="../../vendor/DefinitelyTyped/node/node.d.ts" />
/// <reference path="../../vendor/DefinitelyTyped/jasmine/jasmine.d.ts" />
/**
 * Sets up the test environment, and launches everything.
 * NOTE: Do not import or export anything from this file, as that will trigger
 * TypeScript to generate an AMD module. This is meant to execute at load time.
 */
declare var __karma__;
declare var __numWaiting: number;
declare var loadFixtures: Function;

(() => {
  // Test timeout duration in milliseconds. Increase if needed.
  var timeout: number = 20000;

  // Calleable things aren't always Functions... IE9 is dumb :(
  // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
  if (typeof console.log == "object") {
    if (Function.prototype.bind) {
      // Let us use Function.apply, dangit!
      console.log = Function.prototype.bind.call(console.log, console);
    } else {
      // IE<9 does not define bind. :(
      // Use a half-assed polyfill function.
      console.log = (function (oglog) {
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

  // Defines and starts all of our unit tests.
  function startTests(BrowserFS, TAPReporter, unitTestModules: string[], testFcns: Function[], backendFactories: any[]) {
    // Install all needed test globals.
    window['BrowserFS'] = BrowserFS;
    BrowserFS.install(window);
    // Make these things global
    window['fs'] = BrowserFS.BFSRequire('fs');
    window['path'] = BrowserFS.BFSRequire('path');
    // Polyfill for Node's 'common' module that it uses for its unit tests.
    window['common'] = {
      tmpDir: '/tmp/',
      fixturesDir: '/test/fixtures/files/node',
      // NodeJS uses 'common.error' for test messages, but this is inappropriate.
      // I map it to log, instead.
      error: function () { console.log.apply(console, arguments); }
    };
    // Polyfill for `process.on('exit')`.
    window['process'].on = (trigger, cb) => {
      if (trigger == 'exit') {
        (<any>process)._exitCb = cb;
      } else {
        throw new Error("Unsupported trigger: " + trigger);
      }
    };

    // Generates a Jasmine unit test from a CommonJS test.
    function generateTest(testName, test) {
      it(testName, function () {
        runs(function () {
          // Reset the exit callback.
          process.on('exit', function () { });
          test();
        });
        waitsFor(() => {
          return __numWaiting === 0;
        }, "All callbacks should fire", timeout);
        runs(function () {
          // Run the exit callback, if any.
          (<any>process)._exitCb();
        });
        waitsFor(() => {
          return __numWaiting === 0;
        }, "All callbacks should fire", timeout);
      });
    }

    function generateTests(backend) {
      generateTest("Load filesystem", function () {
        __numWaiting = 0;
        BrowserFS.initialize(backend);
      });
      generateTest("Load fixtures", loadFixtures);
      // Generate a unit test for each node test.
      unitTestModules.forEach((testModule, i) => {
        generateTest(testModule, testFcns[i]);
      });
    }

    function generateAllTests() {
      // programmatically create a single test suite for each filesystem we wish to
      // test
      var factorySemaphore: number = backendFactories.length;
      function testGeneratorFactory(backend) {
        return () => { generateTests(backend); };
      }
      backendFactories.forEach((factory) => {
        factory((backends) => {
          var backendSemaphore: number = backends.length;
          // XXX: 0 backend case.
          if (backendSemaphore === 0) {
            if (--factorySemaphore === 0) {
              // LAUNCH THE TESTS!
              if (typeof __karma__ !== 'undefined') {
                // Normal unit testing.
                __karma__.start();
              } else {
                // Testling environment.
                jasmine.getEnv().execute();
              }
            }
          }
          backends.forEach((backend) => {
            describe(backend.getName(), testGeneratorFactory(backend));
            if (--backendSemaphore === 0) {
              if (--factorySemaphore === 0) {
                // LAUNCH THE TESTS!
                if (typeof __karma__ !== 'undefined') {
                  // Normal unit testing.
                  __karma__.start();
                } else {
                  // Testling environment.
                  jasmine.getEnv().execute();
                }
              }
            }
          });
        });
      });
    }

    // Add a TAP reporter so we get decent console output.
    jasmine.getEnv().addReporter(new TAPReporter(() => {
      console.log.apply(console, arguments);
    }));

    // Begin!
    generateAllTests();
  }

  function bootstrap() {
    var unitTestModules = [],
      factoryModules = [],
      essentialModules = ['src/core/browserfs',
        '../../node_modules/jasmine-tapreporter/src/tapreporter'];

    /**
     * Processes modules into groups, and passes it to the harness.
     */
    function preStartTests(BrowserFS, TAPReporter) {
      // Arguments: Essential followed by factories followed by tests.
      var testFcns = Array.prototype.slice.call(arguments, essentialModules.length + factoryModules.length),
        backendFactories = Array.prototype.slice.call(arguments, essentialModules.length, factoryModules.length);
      startTests(BrowserFS, TAPReporter, unitTestModules, testFcns, backendFactories);
    }

    function pathToModule(path: string): string {
      return path.replace(/^\/base\//, '../../').replace(/..\/..\/build\/test/, '.').replace(/\.js$/, '');
    }

    var file;
    for (file in __karma__.files) {
      if (__karma__.files.hasOwnProperty(file)) {
        if (/test\/tests\/node\/.*\.js$/.test(file)) {
          // Normalize paths to RequireJS module names.
          unitTestModules.push(pathToModule(file));
        } else if (/test\/harness\/factories\/.*\.js$/.test(file)) {
          factoryModules.push(pathToModule(file));
        }
      }
    }

    // Tell require to load our modules, which will kick everything off!
    window['require'].config({
      // Karma serves files under /base, which is the basePath from your config file
      baseUrl: '/base/build/test',
      paths: {
        'zlib': '../../vendor/zlib.js/rawinflate.min',
        'async': '../../vendor/async/lib/async',
      },

      shim: {
        'zlib': {
          exports: 'Zlib'
        }
      },
      // dynamically load all test files
      deps: essentialModules.concat(factoryModules, unitTestModules),
      // we have to kickoff jasmine, as it is asynchronous
      callback: preStartTests
    });
  }

  // Kick everything off!
  bootstrap();
})();
