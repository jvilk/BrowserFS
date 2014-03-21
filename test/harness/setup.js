// Wrap in a function closure to avoid polluting the global namespace.
(function() {
  // Calleable things aren't always Functions... IE9 is dumb :(
  // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
  if (typeof console.log == "object") {
    if (Function.prototype.bind) {
      // Let us use Function.apply, dangit!
      console.log = Function.prototype.bind.call(console.log, console);
    } else {
      // IE<9 does not define bind. :(
      // Use a half-assed polyfill function.
      console.log = (function(oglog) {
        return function() {
          switch(arguments.length) {
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
  var startTests = function(BrowserFS, TAPReporter) {
    "use strict";
    // Arguments: Essential followed by tests.
    var testFcns = Array.prototype.slice.call(arguments, essentialModules.length);

    // Add a TAP reporter so we get decent console output.
    jasmine.getEnv().addReporter(new TAPReporter(function() {
      console.log.apply(console, arguments);
    }));

    window['BrowserFS'] = BrowserFS;
    // Test-related setup code.
    var obj = {};
    // Install to obj to prevent trampling on RequireJS's require
    // function.
    BrowserFS.install(obj);

    // Make these things global
    window.fs = obj.require('fs');
    window.path = obj.require('path');
    window.process = obj.process;
    // Polyfill for Node's 'common' module that it uses for its unit tests.
    window.common = {
        tmpDir: '/tmp/',
        fixturesDir: '/test/fixtures/files/node',
        // NodeJS uses 'common.error' for test messages, but this is inappropriate.
        // I map it to log, instead.
        error: function() { console.log.apply(console, arguments); }
    };
    window.Buffer = obj.Buffer;

    // Polyfill for `process.on('exit')`.
    window.process.on = function(trigger, cb) {
      if (trigger == 'exit') {
        process._exitCb = cb;
      } else {
        throw new Error("Unsupported trigger: " + trigger);
      }
    };

    var backends = [];

    var timeout = 20000;

    // Generates a unit test.
    var generateTest = function(testName, test) {
      it (testName, function() {
        runs(function() {
          // Reset the exit callback.
          process.on('exit', function(){});
          test();
        });
        waitsFor(function() {
          return window.__numWaiting === 0;
        }, "All callbacks should fire", timeout);
        runs(function() {
          // Run the exit callback, if any.
          process._exitCb();
        });
        waitsFor(function() {
          return window.__numWaiting === 0;
        }, "All callbacks should fire", timeout);
      });
    };

    var generateTests = function(backend) {
      generateTest("Load filesystem", function() {
        window.__numWaiting = 0;
        BrowserFS.initialize(backend);
      });
      generateTest("Load fixtures", window.loadFixtures);
      var i;
      for (i = 0; i < allTestFiles.length; i++) {
        // Generate a unit test for this Node test
        generateTest(allTestFiles[i], testFcns[i]);
      }
    };

    var generateAllTests = function() {
      // programmatically create a single test suite for each filesystem we wish to
      // test
      var testGeneratorFactory = function(backend) {
        return function() { generateTests(backend); };
      };
      for (var i = 0; i < backends.length; i++) {
        var _backend = backends[i];
        describe(_backend.getName(), testGeneratorFactory(_backend));
      }
      if (typeof __karma__ !== 'undefined') {
        // Normal unit testing.
        __karma__.start();
      } else {
        // Testling environment.
        jasmine.getEnv().execute();
      }
    };

    // Add LocalStorage-backed filesystem
    var LocalStorage = BrowserFS.FileSystem.LocalStorage;
    if (LocalStorage.isAvailable()) {
      var lsfs = new LocalStorage();
      lsfs.empty();
      backends.push(lsfs);
    }

    // Add in-memory filesystem
    var InMemory = BrowserFS.FileSystem.InMemory;
    backends.push(new InMemory());

    // Add AJAX filesystem
    var XmlHttpRequest = BrowserFS.FileSystem.XmlHttpRequest;
    if (XmlHttpRequest.isAvailable()) {
      var xhrfs = new XmlHttpRequest('/listings.json');
      backends.push(xhrfs);
      // Add three Zip FS variants for different zip files.
      var zipFiles = ['0', '4', '9'];
      // Leverage the XHRFS to download the fixtures for this FS.
      BrowserFS.initialize(xhrfs);
      for (var i = 0; i < zipFiles.length; i++) {
        var zipFileName = '/test/fixtures/zipfs/zipfs_fixtures_l' + zipFiles[i] + '.zip';
        backends.push(new BrowserFS.FileSystem.ZipFS(fs.readFileSync(zipFileName), zipFileName));
      }
    }

    // Add mountable filesystem
    var im2 = new InMemory();
    var im3 = new InMemory();
    var MountableFileSystem = BrowserFS.FileSystem.MountableFileSystem;
    var mfs = new MountableFileSystem();
    //TODO: Test when API Error has a 'file' attribute that MFS can appropriately
    // alter when an error is raised.
    mfs.mount('/test', im2);
    mfs.mount('/tmp', im3);
    backends.push(mfs);

    var async_backends = 0;

    // Set to 'true' to test the Dropbox FS (which is slow to test).
    if (false) {
      async_backends++;
      var init_client = new db.Client({
        key: 'c6oex2qavccb2l3',
        sandbox: true
      });

      var auth = function(){
        init_client.authenticate(function(error, authed_client){
          if (error){
            console.error('Error: could not connect to Dropbox');
            console.error(error);
            return;
          }

          authed_client.getUserInfo(function(error, info){
            console.debug("Successfully connected to " + info.name + "'s Dropbox");
          });

          var Dropbox = BrowserFS.FileSystem.Dropbox;
          var dbfs = new Dropbox(authed_client);
          backends.push(dbfs);
          dbfs.empty(function(){
            async_backends--;
            if (async_backends === 0) generateAllTests();
          });
        });
      };

      // Authenticate with pregenerated unit testing credentials.
      var req = new XMLHttpRequest();
      req.open('GET', '/test/fixtures/dropbox/token.json');
      var data = null;
      req.onerror = function(e){ console.error(req.statusText); };
      req.onload = function(e){
        if(!(req.readyState === 4 && req.status === 200)){
          console.error(req.statusText);
        }
        var creds = JSON.parse(req.response);
        init_client.setCredentials(creds);
        auth();
      };
      req.send();
    }


    // Add HTML5 FileSystem API backed filesystem
    var HTML5FS = BrowserFS.FileSystem.HTML5FS;
    if (HTML5FS.isAvailable()) {
      async_backends++;
      var html5fs = new HTML5FS(10, window.TEMPORARY);
      backends.push(html5fs);
      html5fs.allocate(function(err){
        if (err){
          console.error(err);
        } else {
          html5fs.empty(function(err2){
            if (err2) {
              console.error(err2);
            } else {
              async_backends--;
              if (async_backends === 0) generateAllTests();
            }
          });
        }
      });
    }

    var IDBFS = BrowserFS.FileSystem.IndexedDB;
    if (IDBFS.isAvailable()) {
      async_backends++;
      new IDBFS(function (e, idbfs) {
        if (e) {
          console.error(e);
        } else {
          idbfs.empty(function (e) {
            if (e) {
              console.error(e);
            } else {
              backends.push(idbfs);
              if (--async_backends === 0) generateAllTests();
            }
          });
        }
      }, 'test');
    }

    if (async_backends === 0) generateAllTests();
  };

  var allTestFiles = [];
  var TEST_REGEXP = /test\/tests\/node\/.*\.js$/;
  var BACKEND_REGEXP = /backend\/.*\.js$/;
  // TODO: Can grab from files.
  var essentialModules = ['core/browserfs', '../../node_modules/jasmine-tapreporter/src/tapreporter'];

  var pathToModule = function(path) {
    return path.replace(/^\/base\//, '../../').replace(/\.js$/, '');
  };

  var pathToModule2 = function(path) {
    return path.replace(/^\/base\/build\/dev\//, '').replace(/\.js$/, '');
  };

  var file;
  for (file in window.__karma__.files) {
    if (window.__karma__.files.hasOwnProperty(file)) {
      if (TEST_REGEXP.test(file)) {
        // Normalize paths to RequireJS module names.
        allTestFiles.push(pathToModule(file));
      } else if (BACKEND_REGEXP.test(file)) {
        essentialModules.push(pathToModule2(file));
      }
    }
  }

  require.config({
    // Karma serves files under /base, which is the basePath from your config file
    baseUrl: '/base/build/dev',
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
    deps: essentialModules.concat(allTestFiles),
    // we have to kickoff jasmine, as it is asynchronous
    callback: startTests
  });
})();