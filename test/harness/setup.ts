import BrowserFS = require('../../src/core/browserfs');
import file_system = require('../../src/core/file_system');
import BFSEmscriptenFS from '../../src/generic/emscripten_fs';
// !!TYPING ONLY!!
import __buffer = require('bfs-buffer');
import buffer = require('buffer');
import BackendFactory = require('./BackendFactory');
import async = require('async');
import assert = require('./wrapped-assert');
var BFSBuffer = <typeof __buffer.Buffer> (<any> buffer).Buffer;

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
    emscripten: {[name: string]: (Module: any) => void};
  }, backendFactories: BackendFactory[]) {
  var fsBackends: { name: string; backends: file_system.FileSystem[]; }[] = [];

  // Install BFS as a global.
  (<any> window)['BrowserFS'] = BrowserFS;

  var process = BrowserFS.BFSRequire('process');

  // Generates a Jasmine unit test from a CommonJS test.
  function generateTest(testName: string, test: () => void, postCb: () => void = () => {}) {
    it(testName, function (done: (e?: any) => void) {
      // Reset the exit callback.
      process.removeAllListeners('exit');
      test();
      waitsFor(() => {
        return __numWaiting === 0;
      }, "All callbacks should fire", timeout, (e?: Error) => {
        if (e) {
          postCb();
          done(e);
        } else {
          // Run the exit callback, if any.
          process.exit(0);
          process.removeAllListeners('exit');
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

  function generateEmscriptenTest(testName: string, test: (module: any) => void) {
    // Only applicable to typed array-compatible browsers.
    if (typeof(Uint8Array) !== 'undefined') {
      it(`[Emscripten] Initialize FileSystem`, () => {
        BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
      });
      generateTest(`[Emscripten] Load fixtures (${testName})`, loadFixtures);
      it(`[Emscripten] ${testName}`, function(done: (e?: any) => void) {
        let stdout = "";
        let stderr = "";
        let fs = BrowserFS.BFSRequire('fs');
        let path = BrowserFS.BFSRequire('path');
        let expectedStdout: string = null;
        let expectedStderr: string = null;
        let testNameNoExt = testName.slice(0, testName.length - path.extname(testName).length);
        try {
          expectedStdout = fs.readFileSync(`/test/fixtures/files/emscripten/${testNameNoExt}.out`).toString().replace(/\r/g, '');
          expectedStderr = fs.readFileSync(`/test/fixtures/files/emscripten/${testNameNoExt}.err`).toString().replace(/\r/g, '');
        } catch (e) {
          // No stdout/stderr test.
        }

        const Module = {
          print: function(text: string) { stdout += text + '\n'; },
          printErr: function(text: string) { stderr += text + '\n'; },
          onExit: function(code) {
            if (code !== 0) {
              done(new Error(`Program exited with code ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
            } else {
              if (expectedStdout !== null) {
                assert.equal(stdout.trim(), expectedStdout.trim());
                assert.equal(stderr.trim(), expectedStderr.trim());
              }
              done();
            }
          },
          // Block standard input. Otherwise, the unit tests inexplicably read from stdin???
          stdin: function() {
            return null;
          },
          locateFile: function(fname: string): string {
            return `/test/tests/emscripten/${fname}`;
          },
          preRun: function() {
            const FS = Module.FS;
            const BFS = new BFSEmscriptenFS(FS, Module.PATH, Module.ERRNO_CODES);
            FS.mkdir('/files');
            console.log(BrowserFS.BFSRequire('fs').readdirSync('/test/fixtures/files/emscripten'));
            FS.mount(BFS, {root: '/test/fixtures/files/emscripten'}, '/files');
            FS.chdir('/files');
          },
          ENVIRONMENT: "WEB",
          FS: <any> undefined,
          PATH: <any> undefined,
          ERRNO_CODES: <any> undefined
        };
        test(Module);
      });
    }
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
                generateTest(`${testName} [${bci.bufferType}]`, () => {
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

      describe('Emscripten Tests', (): void => {
        var emscriptenTests = tests.emscripten;
        Object.keys(emscriptenTests).forEach((testName) => {
          generateEmscriptenTest(testName, emscriptenTests[testName]);
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
    let timeout = setTimeout(() => {
      throw new Error(`Backend ${factory['name']} failed to initialize promptly.`);
    }, 10000);
    factory((name: string, backends: file_system.FileSystem[]) => {
      clearTimeout(timeout);
      fsBackends.push({name: name, backends: backends});
      cb();
    });
  }, (e?: any) => {
    generateAllTests();
  });
};
