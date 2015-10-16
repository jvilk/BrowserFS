import BrowserFS = require('../../src/core/browserfs');
import file_system = require('../../src/core/file_system');
import buffer = require('../../src/core/buffer');
import BFSBuffer = buffer.Buffer;
import BackendFactory = require('./BackendFactory');
import async = require('async');
import assert = require('./wrapped-assert');

var loadFixtures: () => void = require('../fixtures/load_fixtures');

declare var __numWaiting: number;
declare var __karma__: any;
// HACK: Delay test execution until backends load.
// https://zerokspot.com/weblog/2013/07/12/delay-test-execution-in-karma/
__karma__.loaded = function() {};

// Test timeout duration in milliseconds. Increase if needed.
var timeout: number = 60000;

function waitsFor(test: () => boolean, what: string, timeout: number, done: (e?: Error) => void) {
  var interval = setInterval(() => {
    if (test()) {
      clearInterval(interval);
      done();
    } else if (0 >= (timeout -= 10)) {
      clearInterval(interval);
      done(new Error(`${what}: Timed out.`));
    }
  }, 10);
}


// Defines and starts all of our unit tests.
export = function(tests: {
    fs: {
      [name: string]: {[name: string]: () => void};
      all: {[name: string]: () => void};
    };
    general: {[name: string]: () => void};
  }, backendFactories: BackendFactory[]) {
  var fsBackends: { name: string; backends: file_system.FileSystem[]; }[] = [];

  // Install BFS as a global.
  (<any> window)['BrowserFS'] = BrowserFS;

  var process = BrowserFS.BFSRequire('process');

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
  function generateTest(testName: string, test: () => void, postCb: () => void = () => {}) {
    it(testName, function (done: (e?: any) => void) {
      // Reset the exit callback.
      process.on('exit', function () { });
      test();
      waitsFor(() => {
        return __numWaiting === 0;
      }, "All callbacks should fire", timeout, (e?: Error) => {
        if (e) {
          postCb();
          done(e);
        } else {
          // Run the exit callback, if any.
          (<any>process)._exitCb();
          waitsFor(() => {
            return __numWaiting === 0;
          }, "All callbacks should fire", timeout, (e?: Error) => {
            postCb();
            done(e);
          });
        }
      });
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
    describe('BrowserFS Tests', function(): void {
      this.timeout(0);

      // generate generic non-backend specific tests
      describe('General Tests', (): void => {
        var genericTests = tests.general, testName: string;
        __numWaiting = 0;
        var pcb = BFSBuffer.getPreferredBufferCore();
        // Test each available buffer core type!
        BFSBuffer.getAvailableBufferCores().forEach((bci) => {
          for (testName in genericTests) {
            if (genericTests.hasOwnProperty(testName)) {
              // Capture testName in a closure.
              ((testName: string) => {
                generateTest(`${testName} [${bci.name}]`, () => {
                  BFSBuffer.setPreferredBufferCore(bci);
                  genericTests[testName]();
                }, () => {
                  // Restore the previous preferred core.
                  BFSBuffer.setPreferredBufferCore(pcb);
                });
              })(testName);
            }
          }
        });
      });

      describe('FS Tests', (): void => {
        fsBackends.forEach((fsBackend) => {
          fsBackend.backends.forEach((backend) => {
            describe(`${fsBackend.name} ${backend.getName()}`, (): void => {
              generateBackendTests(fsBackend.name, backend);
            });
          });
        });
      });
    });

    // Kick off the tests!
    __karma__.start();
  }

  async.eachSeries(backendFactories, (factory: BackendFactory, cb: (e?: any) => void) => {
    factory((name: string, backends: file_system.FileSystem[]) => {
      fsBackends.push({name: name, backends: backends});
      cb();
    });
  }, (e?: any) => {
    generateAllTests();
  });
};
