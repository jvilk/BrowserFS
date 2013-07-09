// Defines/generates all of our Jasmine unit tests from the node unit tests.
(function() {
  "use strict";
  var backends = [];

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
      }, "All callbacks should fire", 600000);
      runs(function() {
        // Run the exit callback, if any.
        process._exitCb();
      });
      waitsFor(function() {
        return window.__numWaiting === 0;
      }, "All callbacks should fire", 600000);
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

  if (BrowserFS.FileSystem.LocalStorage.isAvailable())
    backends.push(new BrowserFS.FileSystem.LocalStorage());
  backends.push(new BrowserFS.FileSystem.InMemory());
  if (BrowserFS.FileSystem.XmlHttpRequest.isAvailable())
    backends.push(new BrowserFS.FileSystem.XmlHttpRequest('/listings.json'));
  generateAllTests();
})(this);
