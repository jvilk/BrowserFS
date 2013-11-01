BrowserFS
=========

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends.

For more information, see the [wiki](https://github.com/jvilk/BrowserFS/wiki) and [API documentation](http://jvilk.github.io/BrowserFS/).

### Building

Prerequisites:

* Node and NPM
* Grunt and Bower globally installed: `npm install -g grunt bower`

Once you have the above prerequisites installed, type `grunt` to build BrowserFS. The minified library can then be found as `lib/browserfs.js`.

### Testing

Prerequisites:
* Karma globally installed: `npm install -g karma`

To run unit tests, simply run `grunt test` **(NOTE: This will launch multiple web browsers!)**. You may need to change `build/karma.conf.js` if you do not have Chrome, Safari, Opera, and Firefox installed.

### License

BrowserFS is licensed under the MIT License. See `LICENSE` for details.
