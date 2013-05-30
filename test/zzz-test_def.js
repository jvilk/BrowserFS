// Defines/generates all of our Jasmine unit tests from the node unit tests.
(function() {
  "use strict";
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
        return window.__numWaiting() === 0;
      }, "All callbacks should fire", 600000);
      runs(function() {
        // Run the exit callback, if any.
        process._exitCb();
      });
      waitsFor(function() {
        return window.__numWaiting() === 0;
      }, "All callbacks should fire", 600000);
    });
  };

  var generateTests = function(backend) {
    generateTest("Load filesystem", function() {
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

  var idbfs = new BrowserFS.FileSystem.IndexedDB(function(err){
    if (err !== undefined) return;
    var backends = [
      new BrowserFS.FileSystem.LocalStorage(),
      new BrowserFS.FileSystem.InMemory(),
      new BrowserFS.FileSystem.XmlHttpRequest('/listings.json'),
      idbfs,
    ];

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
  });
})(this);
