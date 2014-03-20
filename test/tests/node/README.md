This directory contains tests copied directly from Node JS's test directory:
  https://github.com/joyent/node/tree/master/test/simple

Some tests have been modified to prevent testing undocumented function signatures, many of which are maintained for backwards-compatibility. Others are modified to replace synchronous calls with asynchronous calls. These changes are prefixed with a note starting with `// BFS:`.