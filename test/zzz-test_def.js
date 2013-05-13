// Defines all of our unit tests once everything loads.
// Apparently we cannot do this asynchronously, as we do not control when
// Jasmine is executed.
// It's possible there's a way to manually trigger it, but I'm not sure.

// Generates a unit test.
var generateTest = function(testName, test) {
  it (testName, function() {
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


// programmatically create a single test suite for each filesystem we wish to
// test
// TODO: Generalize this once we have more file systems.
describe("localStorage FS", function() {
  for (var testName in window.tests) {
    if (window.tests.hasOwnProperty(testName)) {
      // Generate a unit test for this Node test
      generateTest(testName, window.tests[testName]);
    }
  }
});
// Trigger the tests
__karma__.start(true);
