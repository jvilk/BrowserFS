// Wrap in a function closure to avoid polluting the global namespace.
(function() {
  // Prevent Karma from auto-executing.
  // There's no Karma in the Testling environment.
  if (typeof __karma__ !== 'undefined') {
    __karma__.loaded = function() {};
  }
  // All of our tests will be defined in this hashmap.
  window.tests = {};
  // Calleable things aren't always Functions... IE9 is dumb :(
  // http://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
  if (typeof console.log == "object") {
    if (Function.prototype.bind) {
      // Let us use Function.apply, dangit!
      console.log = Function.prototype.bind.call(console.log, console);
    } else {
      // IE<9 does not define bind. :(
      // Use a half-assed polyfill function.
      var oglog = console.log;
      console.log = function() {
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
      };
    }
  }
  // Add a TAP reporter so we get decent console output.
  jasmine.getEnv().addReporter(new TAPReporter(function() {
    console.log.apply(console, arguments);
  }));

  // Defines and starts all of our unit tests.
  var startTests = function(BrowserFS) {
    "use strict";
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
      for (var testName in window.tests) {
        if (window.tests.hasOwnProperty(testName)) {
          // Generate a unit test for this Node test
          generateTest(testName, window.tests[testName]);
        }
      }
    };

    var generateAllTests = function() {
      // XXX: TERRIBLE HACK: There's a race condition with defining tests and this
      //      file loading.
      setTimeout(function() {
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
     }, 1000);
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

  if (typeof BrowserFS !== 'undefined') {
    // Release mode.
    setTimeout(function() {
      startTests(BrowserFS);
    }, 10);
  } else {
    // Dev mode.
    // Defines/generates all of our Jasmine unit tests from the node unit tests.
    require(['../build/dev/core/browserfs',
             '../build/dev/backend/IndexedDB',
             '../build/dev/backend/in_memory',
             '../build/dev/backend/localStorage',
             '../build/dev/backend/mountable_file_system',
             '../build/dev/backend/XmlHttpRequest',
             '../build/dev/backend/html5fs',
             '../build/dev/backend/dropbox',
             '../build/dev/backend/zipfs'], startTests);
  }
})();