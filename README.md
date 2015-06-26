BrowserFS
=========

[![NPM version](https://badge.fury.io/js/browserfs.svg)](http://badge.fury.io/js/browserfs)
[![Bower version](https://badge.fury.io/bo/browserfs.svg)](http://badge.fury.io/bo/browserfs)
[![david-dm-status-badge](https://david-dm.org/jvilk/BrowserFS.svg)](https://david-dm.org/jvilk/browserfs#info=dependencies&view=table)
[![david-dm-status-badge](https://david-dm.org/jvilk/BrowserFS/dev-status.svg)](https://david-dm.org/jvilk/BrowserFS#info=devDependencies&view=table)

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends. BrowserFS also integrates nicely into the Emscripten file system.

Provided backends:
* `XmlHttpRequest` (downloads files on-demand from a webserver)
* `localStorage`
* HTML5 `FileSystem`
* IndexedDB
* Dropbox
* In-memory
* Zip file-backed FS (currently read only)
* WebWorker (mount the BrowserFS file system configured in the main thread in a WebWorker, or the other way around!)

More backends can be defined by separate libraries, so long as they extend the `BaseFileSystem`. Multiple backends can be active at once at different locations in the directory hierarchy.

For more information, see the [wiki](https://github.com/jvilk/BrowserFS/wiki).

### Building

Prerequisites:

* Node and NPM
* Grunt-CLI and Bower globally installed: `npm install -g grunt-cli bower`
* Run `npm install` to install local dependencies

Release:
```
grunt
```

The minified release build can be found in `build/browserfs.min.js`.

Development:
```
grunt dev
```

The development build can be found as `build/browserfs.js`.

Custom builds:

If you want to build BrowserFS with a subset of the available backends,
change the `getBackends()` function in `Gruntfile.js` to return an
array of backends you wish to use. Then, perform a release build.

### Using
Here's a simple example, using the LocalStorage-backed file system:
```html
<script type="text/javascript" src="browserfs.min.js"></script>
<script type="text/javascript">
  // Installs globals onto window:
  // * Buffer
  // * require (monkey-patches if already defined)
  // * process
  // You can pass in an arbitrary object if you do not wish to pollute
  // the global namespace.
  BrowserFS.install(window);
  // Constructs an instance of the LocalStorage-backed file system.
  var lsfs = new BrowserFS.FileSystem.LocalStorage();
  // Initialize it as the root file system.
  BrowserFS.initialize(lsfs);
</script>
```

Now, you can write code like this:
```javascript
var fs = require('fs');
fs.writeFile('/test.txt', 'Cool, I can do this in the browser!', function(err) {
  fs.readFile('/test.txt', function(err, contents) {
    console.log(contents.toString());
  });
});
```

### Using with Emscripten

You can use any *synchronous* BrowserFS file systems with Emscripten! Persist particular folders in the Emscripten file system to `localStorage`, or enable Emscripten to synchronously download files from another folder as they are requested.

Include `browserfs.min.js` into the page, and add code similar to the following to your `Module`'s `preRun` array:

```javascript
/**
 * Mounts a localStorage-backed file system into the /data folder of Emscripten's file system.
 */
function setupBFS() {
  // Constructs an instance of the LocalStorage-backed file system.
  var lsfs = new BrowserFS.FileSystem.LocalStorage();
  // Initialize it as the root file system.
  BrowserFS.initialize(lsfs);
  // Grab the BrowserFS Emscripten FS plugin.
  var BFS = new BrowserFS.EmscriptenFS();
  // Create the folder that we'll turn into a mount point.
  FS.createFolder(FS.root, 'data', true, true);
  // Mount BFS's root folder into the '/data' folder.
  FS.mount(BFS, {root: '/'}, '/data');
}
```

Note: Do **NOT** use `BrowserFS.install(window)` on a page with an Emscripten application! Emscripten will be tricked into thinking that it is running in Node JS.

### Testing

Prerequisites:

* Karma globally installed: `npm install -g karma`

To run unit tests, simply run `grunt test` **(NOTE: This will launch multiple web browsers!)**. You may need to change `build/karma.conf.js` if you do not have Chrome, Safari, Opera, and Firefox installed.

### License

BrowserFS is licensed under the MIT License. See `LICENSE` for details.
