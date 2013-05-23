BrowserFS
=========

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends. BrowserFS aims to support as many browsers as possible.

For more information, see the [wiki](https://github.com/jvilk/BrowserFS/wiki) and [API documentation](http://jvilk.github.io/BrowserFS/).

### Building

Prerequisites:

* GNU Make (tested with v3.81)
* Node and NPM (tested with v0.10.4)
* Typical Unix command-line tools (`find` and `dirname`)

Once you have the above prerequisites installed, type `make` to build BrowserFS. The minified library can then be found as `lib/browserfs.min.js`.

### Testing

To run unit tests, simply run `make test` **(NOTE: This will launch multiple web browsers!)**. You may need to change `karma.conf.js` if you do not have Chrome, Safari, Opera, and Firefox installed.

### License

* BrowserFS is licensed under the MIT License (see `LICENSE` for details).
* The NodeJS 'assert' polyfill (`vendor/assert.js`) is licensed under the MIT License (see file for details).
* The typed array polyfill (`vendor/typedarray.js`) is licensed under the MIT License (see file for details).
* The unit tests from NodeJS (`test/node`) and various test fixtures (`test/fixtures`) are licensed under the MIT License (see `test/node/LICENSE` or `test/fixtures/LICENSE` for details).
