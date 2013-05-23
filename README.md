BrowserFS
=========

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends.

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

BrowserFS is licensed under the MIT License. See `LICENSE` for details.
