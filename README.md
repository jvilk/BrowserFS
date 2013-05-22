BrowserFS
=========

BrowserFS is an in-browser file system that emulates the Node JS file system API and supports storing and retrieving files from various backends. BrowserFS aims to support as many browsers as possible.

Browser compatibility
---------------------
At the moment, BrowserFS has been tested to work in the following browsers:

* Chrome
* Firefox
* Safari
* Opera

However, not all file system backends support all browsers. To check if a file system supports the current browser at runtime, use the `isAvailable` method on the file system.

Differences from Node
---------------------
### API Differences

* BrowserFS only supports asynchronous Node API functions (synchronous support is coming soon -- although it will be an optional feature, as some backends are not amenable to synchronous operations).
* BrowserFS does not support watch/unwatch functionality.
* BrowserFS does not support Node's read or write stream objects.
* BrowserFS doesn't support the following NodeJS oddities:
** Allowing number arguments to be passed as strings (e.g. '2' instead of 2).
** We do not support some undocumented API function signatures that Node maintains for backward compatibility purposes (if there is demand for fixing this, it can be fixed).

### File Descriptors

In Node, a 'file descriptor' is a typical integer-based POSIX file descriptor.

In BrowserFS, a file descriptor is an object. However, this will not impact your program's logic, unless your program actually reads the contents of the file descriptor. You will still pass it to the normal Node API methods, such as `fs.fstat()`. As long as you treat the file descriptor as an abstract token that you pass into the Node API, your program will work correctly.

Adding Backends to BrowserFS
-----------------------------------------------
If you write a backend for BrowserFS, you get the following for free:

* **Test Suite Support**: BrowserFS contains a comprehensive test suite for each command type that can be run on any backend. The tests are configured to test only the commands that the backend under test supports (e.g. if your file system does not support permissions, the permission tests will detect this and automatically pass).
* **Node API Compatibility**: BrowserFS handles translating the Node `fs` API, which has some optional arguments and default values for arguments, into a more concrete form where everything is explicitly specified. It also translates some Node functions as compositions of "core" Node `fs` functions, which reduces the number of methods you need to implement and test.
* *[Planned for the future]* **Cross filesystem support**: BrowserFS will automatically handle operations that may span multiple filesystems. For example, if a user renames a file from `/mnt/dropbox/Foo.bar` to `/mnt/localStorage/Foo.bar`, BrowserFS will read the file from the Dropbox filesystem, write to the `localStorage` filesystem, and then delete it from the Dropbox filesystem. File systems do not need to know about each other.
* *[Planned for the future]* **WebWorker Support**: BrowserFS will automatically proxy file operations across the WebWorker boundary with no individual filesystem support required.

How do I write a file system driver for BrowserFS?
--------------------------------------------------
To be written, once I have `docs` up.
