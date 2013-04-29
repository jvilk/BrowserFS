BrowserFS
=========

BrowserFS is an in-browser filesystem that emulates the Node JS filesystem API and supports storing and retrieving files from various backends. BrowserFS aims to support as many browsers as possible.

Browser compatibility
---------------------
In general, BrowserFS has been tested to work in the following browsers:

* TODO: Write up.

However, not all filesystems support all browsers. To check if a filesystem supports the current browser at runtime, use the `isAvailable` method on the filesystem.

Differences from Node
---------------------
### API Differences

* BrowserFS only supports asynchronous Node API functions.
* BrowserFS does not support symlink operations at this time; perhaps at some point we'll support BrowserFS-specific link files if this becomes important.
* BrowserFS does not support watch/unwatch functionality.
* BrowserFS doesn't support the following NodeJS oddities:
** Allowing out-of-order arguments (e.g. Buffer's `copy` method allows you to pass in the encoding before starting index if you want).
** Allowing number arguments to be passed as strings (e.g. '2' instead of 2).

Why do we only support the asynchronous API?

* Asynchronous methods allow you to use the filesystem across web worker boundaries using proxy file descriptors.
* Asynchronous methods allow you to queue up multiple file upload/download requests for remote filesystems before they complete.
* Honestly, it's just good practice. :)

### File Descriptors
In Node (and in most filesystem APIs), you get a file descriptor back. In Node, a file descriptor is an integer, which clearly maps onto Unix filesystem APIs.

In BrowserFS, a file descriptor is an object. However, this will not impact your program's logic, unless your program actually reads the contents of the file descriptor. You will still pass it to the normal Node API methods, such as `fs.fstat()`. As long as you treat the file descriptor as a token that you pass into the Node API, you'll be fine.

Why write a file system driver for BrowserFS?
-----------------------------------------------
If you write a file system "driver" for BrowserFS, you get the following for free:

* **WebWorker Support**: BrowserFS will automatically proxy file operations across the WebWorker boundary with no individual filesystem support required.
* **Cross filesystem support**: BrowserFS will automatically handle operations that may span multiple filesystems. For example, if a user renames a file from `/mnt/dropbox/Foo.bar` to `/mnt/localStorage/Foo.bar`, BrowserFS will read the file from the Dropbox filesystem, write to the `localStorage` filesystem, and then delete it from the Dropbox filesystem. Filesystems do not need to know about each other.
* **Test Suite Support**: BrowserFS (will eventually) contains a comprehensive test suite for each command type that can be run on any filesystem type. You can run the tests applicable to the filesystem commands that BrowserFS supports on your new filesystem without having to write the tests yourself.
* **Node API Compatibility**: BrowserFS handles translating the Node `fs` API, which has some optional arguments and default values for arguments, into a more concrete form where everything is explicitly specified. It also translates some Node functions as compositions of "core" Node `fs` functions, which reduces the number of methods you need to implement and test.

How do I write a file system driver for BrowserFS?
--------------------------------------------------
Why, it's as easy as 1, 2, implement a bunch of methods, N! :)
