/**
 * Tests for indexed file systems.
 */
import assert from '../../harness/wrapped-assert';
import * as BrowserFS from '../../../src/core/browserfs';

export default function() {
  // Does the root directory exist in empty file systems? It should!
  var ifs = new BrowserFS.FileSystem.InMemory();
  try {
    ifs.statSync('/', true);
  } catch (e) {
    assert(false, "Root directory does not exist.");
  }
};