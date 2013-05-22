BrowserFS
=========

BrowserFS is an in-browser file system that emulates the Node JS file system API and supports storing and retrieving files from various backends. BrowserFS aims to support as many browsers as possible.

Browser compatibility
---------------------
At the moment, BrowserFS has been tested to work in the latest version of the following browsers:

* Chrome
* Firefox
* Safari
* Opera

We plan to test additional browsers soon, once we have a few fully-functioning backends in the above-listed browsers. Compatibility is an important goal for us.

However, note that not all file system backends support all browsers. For example, if the browser does not have `localStorage` support, the `localStorage` backend will not work properly. To check if a file system supports the current browser at runtime, use the `isAvailable` method on the file system.

Once we have a number of backends working, we will have composite backends that will dynamically fall back to the best-available backend for the current browser.

Differences from Node
---------------------
### API Differences

* BrowserFS buffers cannot be read from or written to like arrays.
  * Equivalent to `buf[1] = 2`: `buf.writeUInt8(2,1)`
  * Equivalent to `a = buf[1]`: `buf.readUInt8(1)`
* BrowserFS buffers' `read` and `write` functions do not support the optional `noAssert=true` parameter; they will always throw a `RangeError` if you attempt to read or write past the end of the buffer.
* BrowserFS only supports asynchronous Node API functions (synchronous support is coming soon -- although it will be an optional feature, as some backends are not amenable to synchronous operations).
* BrowserFS does not support watch/unwatch functionality.
* BrowserFS does not support Node's read or write stream objects.
* BrowserFS doesn't support the following NodeJS oddities:
  * Allowing number arguments to be passed as strings (e.g. '2' instead of 2).
  * We do not support some undocumented API function signatures that Node maintains for backward compatibility purposes (if there is demand for fixing this, it can be fixed).

### File Descriptors

In Node, a 'file descriptor' is a typical integer-based POSIX file descriptor.

In BrowserFS, a file descriptor is an object. However, this will not impact your program's logic, unless your program actually reads the contents of the file descriptor. You will still pass it to the normal Node API methods, such as `fs.fstat()`. As long as you treat the file descriptor as an abstract token that you pass into the Node API, your program will work correctly.

Why add a backend to BrowserFS?
-----------------------------------------------
If you write a backend for BrowserFS, you get the following for free:

* **Test Suite Support**: BrowserFS contains a comprehensive test suite for each command type that can be run on any backend. The tests are configured to test only the commands that the backend under test supports (e.g. if your file system does not support permissions, the permission tests will detect this and automatically pass).
* **Node API Compatibility**: BrowserFS handles translating the Node `fs` API, which has some optional arguments and default values for arguments, into a more concrete form where everything is explicitly specified. It also translates some Node functions as compositions of "core" Node `fs` functions, which reduces the number of methods you need to implement and test.
* *[Planned for the future]* **Cross filesystem support**: BrowserFS will automatically handle operations that may span multiple filesystems. For example, if a user renames a file from `/mnt/dropbox/Foo.bar` to `/mnt/localStorage/Foo.bar`, BrowserFS will read the file from the Dropbox filesystem, write to the `localStorage` filesystem, and then delete it from the Dropbox filesystem. File systems do not need to know about each other.
* *[Planned for the future]* **WebWorker Support**: BrowserFS will automatically proxy file operations across the WebWorker boundary with no individual filesystem support required.

Building BrowserFS
------------------
Prerequisites:

* GNU Make (tested with v3.81)
* Node and NPM (tested with v0.10.4)
* Typical Unix command-line tools (`find` and `dirname`)

Once you have the above prerequisites installed, type `make` to build BrowserFS. The minified library can then be found as `lib/browserfs.min.js`.

Using BrowserFS
---------------
To be written.


How to add a backend to BrowserFS
--------------------------------------------------
To be written, once I have `docs` up.
