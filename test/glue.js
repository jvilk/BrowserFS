// Test glue!
BrowserFS.Install(this);

// Change to test directory.
process.chdir('/Users/jvilk/Code/BrowserFS');


// Jasmine hackery for Karma.
describe("Run All The Tests!", function() {
  it("runs all of the tests", function() {
    waitsFor(function() {
      return window.__numWaiting() === 0;
    }, "All callbacks should fire", 600000);
  });
});
