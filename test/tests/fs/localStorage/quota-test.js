/**
 * Unit tests specifically crafted for the LocalStorage file system.
 */
define([], function() { return function(){
  if (!(fs.getRootFS() instanceof BrowserFS.FileSystem.LocalStorage)) return;

  // While LocalStorage is supposed to only store 5MB, our compression enables
  // us to store 10MB in some cases...
  var bigbuff = new Buffer(10*1024*1024);
  var errorThrown = false;
  // Try to write it to local storage. Should get an error!
  try {
    fs.writeFileSync("/bigfile.txt", bigbuff);
  } catch (e) {
    errorThrown = true;
    assert(e.code === 'ENOSPC');
  }
  assert(errorThrown);
};});
