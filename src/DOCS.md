# BrowserFS API Documentation

BrowserFS is an in-browser file system that emulates the [Node JS file system API](http://nodejs.org/api/fs.html) and supports storing and retrieving files from various backends. BrowserFS also integrates nicely into the Emscripten file system.

The [README](https://github.com/jvilk/browserfs) provides an overview of how to integrate BrowserFS into your project. This API documentation will focus on how to use BrowserFS once you have added it to your project.

## BrowserFS Interface

The main BrowserFS interface is [documented here](interfaces/browserfs.html).

Before you can use BrowserFS, you must initialize it with a single root file system backend using `BrowserFS.initialize`. Think of this as your "storage device".

If you need to use multiple "storage devices", instantiate multiple file system backend types, mount them into a `MountableFileSystem` backend, and then use that as the root file system for BrowserFS.

There are all sorts of adapter file systems available to make it easy to access files stored in Emscripten, files stored in a different context (e.g., a web worker), isolate file operations to a particular folder, access asynchronous storage backends synchronously, and more!

## Overview of Backends

**Key:**

* ✓ means 'yes'
* ✗ means 'no'
* ? means 'depends on configuration'

Note that any asynchronous file system can be accessed synchronously using the [AsyncMirror](classes/asyncmirror.html) file system.

<table>
  <tr>
    <th></th>
    <th></th>
    <th colspan="3">Optional API Support</th>
  </tr>
  <tr>
    <th>Backend Name</th>
    <th>Read-only?</th>
    <th>Synchronous</th>
    <th>Properties</th>
    <th>Links</th>
  </tr>
  <tr>
    <td><a href="classes/asyncmirror.html">AsyncMirror</a></td>
    <td>✗</td>
    <td>✓</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/dropboxfilesystem.html">Dropbox</a></td>
    <td>✗</td>
    <td>✗</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/emscriptenfilesystem.html">Emscripten</a></td>
    <td>✗</td>
    <td>✓</td>
    <td>✓</td>
    <td>✓</td>
  </tr>
  <tr>
    <td><a href="classes/folderadapter.html">FolderAdapter</a></td>
    <td>?</td>
    <td>?</td>
    <td>?</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/html5fs.html">HTML5FS</a></td>
    <td>✗</td>
    <td>✗</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/indexeddbfilesystem.html">IndexedDB</a></td>
    <td>✗</td>
    <td>✗</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/inmemoryfilesystem.html">InMemory</a></td>
    <td>✗</td>
    <td>✓</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/isofs.html">IsoFS</a></td>
    <td>✓</td>
    <td>✓</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/localstoragefilesystem.html">LocalStorage</a></td>
    <td>✗</td>
    <td>✓</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/mountablefilesystem.html">MountableFileSystem</a></td>
    <td>?</td>
    <td>?</td>
    <td>?</td>
    <td>?</td>
  </tr>
  <tr>
    <td><a href="classes/overlayfs.html">OverlayFS</a></td>
    <td>✗</td>
    <td>?</td>
    <td>?</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/xmlhttprequest.html">XmlHttpRequest</a></td>
    <td>✓</td>
    <td>✓</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
  <tr>
    <td><a href="classes/workerfs.html">WorkerFS</a></td>
    <td>?</td>
    <td>✗</td>
    <td>?</td>
    <td>?</td>
  </tr>
  <tr>
    <td><a href="classes/zipfs.html">ZipFS</a></td>
    <td>✓</td>
    <td>✓</td>
    <td>✗</td>
    <td>✗</td>
  </tr>
</table>
