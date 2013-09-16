// Defines/generates all of our Jasmine unit tests from the node unit tests.
(function() {
  "use strict";
  var backends = [];

  var timeout = 5000;

  // Generates a unit test.
  var generateTest = function(testName, test) {
    it (testName, function() {
      console.log("Running " + testName);
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
    // programmatically create a single test suite for each filesystem we wish to
    // test
    var testGeneratorFactory = function(backend) {
      return function() { generateTests(backend); };
    };
    for (var i = 0; i < backends.length; i++) {
      var _backend = backends[i];
      describe(_backend.getName(), testGeneratorFactory(_backend));
    }
    __karma__.start();
  };

  // Add LocalStorage-backed filesystem
  if (BrowserFS.FileSystem.LocalStorage.isAvailable()) {
    var lsfs = new BrowserFS.FileSystem.LocalStorage();
    lsfs.empty();
    // backends.push(lsfs);
  }

  // Add in-memory filesystem
  // backends.push(new BrowserFS.FileSystem.InMemory());

  // Add AJAX filesystem
  // if (BrowserFS.FileSystem.XmlHttpRequest.isAvailable())
    // backends.push(new BrowserFS.FileSystem.XmlHttpRequest('/listings.json'));

  // Add mountable filesystem
  var im2 = new BrowserFS.FileSystem.InMemory();
  //var im3 = new BrowserFS.FileSystem.InMemory();
  var mfs = new BrowserFS.FileSystem.MountableFileSystem();
  mfs.mount('/', im2);
  //TODO: Test when API Error has a 'file' attribute that MFS can appropriately
  // alter when an error is raised.
  //mfs.mount('/test', im2);
  // backends.push(mfs);

  // Add HTML5 FileSystem API backed filesystem
  if (BrowserFS.FileSystem.HTML5FS.isAvailable()){
    var html5fs = new BrowserFS.FileSystem.HTML5FS(10, window.TEMPORARY);
    backends.push(html5fs);
    html5fs.allocate(function(err){
      if (err){
        console.error(err);
      }
      else {
        html5fs.empty(function(err2){
          if (err2) {
            console.error(err2);
          }
          else {
            // XXX: this shouldn't be necessary.
            html5fs.mkdir('/tmp', null, function(err3){
              if (err3){
                console.error(err3);
              }
              else {
                generateAllTests();
              }
            })
          }
        });
      }
    });
  }
})(this);
