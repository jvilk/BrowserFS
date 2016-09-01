import fs from '../../../../src/core/node_fs';
import * as path from 'path';
import assert from '../../../harness/wrapped-assert';
import common from '../../../harness/common';

export default function() {
  var rootFS = fs.getRootFS();
  if (!rootFS.isReadOnly()) {
    // Ensure we cannot remove directories that are non-empty.
    fs.mkdir('/rmdirTest', function(e) {
      assert(!e);
      fs.mkdir('/rmdirTest/rmdirTest2', function(e) {
        assert(!e);
        fs.rmdir('/rmdirTest', function(e) {
          assert(!!e, "Invariant failed: Successfully removed a non-empty directory.");
          assert(e.code === "ENOTEMPTY");
        });
      });
    });
  }
};
