/// <reference path="../../bower_components/DefinitelyTyped/node/node.d.ts" />
/// <reference path="../../bower_components/DefinitelyTyped/jasmine/jasmine.d.ts" />
import BrowserFS = require('../../src/core/browserfs');
import file_system = require('../../src/core/file_system');
import BackendFactory = require('./BackendFactory');
interface ITAPReporter {
  new(print: () => void): jasmine.Reporter;
}
var TAPReporter: ITAPReporter = require('jasmine-tapreporter');
/**
 * Sets up the test environment, and launches everything.
 * NOTE: Do not import or export anything from this file, as that will trigger
 * TypeScript to generate an AMD module. This is meant to execute at load time.
 */
declare var __karma__: any;
declare var __numWaiting: number;
declare var loadFixtures: () => void;

// Test timeout duration in milliseconds. Increase if needed.
var timeout: number = 20000;

// Defines and starts all of our unit tests.
export = function(tests: {
    fs: {
      [name: string]: {[name: string]: () => void};
      all: {[name: string]: () => void};
    };
    general: {[name: string]: () => void};
  },
  backendFactories: BackendFactory[]) {
  // Install BFS globals (process, etc.).
  (<any> window)['BrowserFS'] = BrowserFS;
  BrowserFS.install(window);
  // Polyfill for `process.on('exit')`.
  process.on = (trigger, cb) => {
    if (trigger == 'exit') {
      (<any>process)._exitCb = cb;
    } else {
      throw new Error("Unsupported trigger: " + trigger);
    }
    // XXX: Typing hack.
    return null;
  };

  // Generates a Jasmine unit test from a CommonJS test.
  function generateTest(testName: string, test: () => void) {
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

  function generateBackendTests(name: string, backend: file_system.FileSystem) {
    var testName: string;
    generateTest("Load filesystem", function () {
      __numWaiting = 0;
      BrowserFS.initialize(backend);
    });
    generateTest("Load fixtures", loadFixtures);
    if (tests.fs.hasOwnProperty(name)) {
      // Generate each unit test specific to this backend.
      for (testName in tests.fs[name]) {
        if (tests.fs[name].hasOwnProperty(testName)) {
          generateTest(testName, tests.fs[name][testName]);
        }
      }
    }
    // Generate unit test for each general FS test.
    for (testName in tests.fs.all) {
      if (tests.fs.all.hasOwnProperty(testName)) {
        generateTest(testName, tests.fs.all[testName]);
      }
    }
  }

  function generateAllTests() {
    // programmatically create a single test suite for each filesystem we wish to
    // test
    var factorySemaphore: number = backendFactories.length;
    function testGeneratorFactory(name: string, backend: file_system.FileSystem) {
      return () => { generateBackendTests(name, backend); };
    }

    // generate generic non-backend specific tests
    describe('General BrowserFS Tests', (): void => {
      var genericTests = tests.general, testName: string;
      for (testName in genericTests) {
        if (genericTests.hasOwnProperty(testName)) {
          generateTest(testName, genericTests[testName]);
        }
      }
    });

    backendFactories.forEach((factory) => {
      factory((name: string, backends: file_system.FileSystem[]) => {
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
          describe(backend.getName(), testGeneratorFactory(name, backend));
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
  jasmine.getEnv().addReporter(new TAPReporter(function() {
    console.log.apply(console, arguments);
  }));

  // Begin!
  generateAllTests();
};
