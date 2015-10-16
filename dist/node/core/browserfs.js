var buffer = require('./buffer');
var fs = require('./node_fs');
var path = require('./node_path');
var node_process = require('./node_process');
function install(obj) {
    obj.Buffer = buffer.Buffer;
    obj.process = node_process.process;
    var oldRequire = obj.require != null ? obj.require : null;
    obj.require = function (arg) {
        var rv = BFSRequire(arg);
        if (rv == null) {
            return oldRequire.apply(null, Array.prototype.slice.call(arguments, 0));
        }
        else {
            return rv;
        }
    };
}
exports.install = install;
exports.FileSystem = {};
function registerFileSystem(name, fs) {
    exports.FileSystem[name] = fs;
}
exports.registerFileSystem = registerFileSystem;
function BFSRequire(module) {
    switch (module) {
        case 'fs':
            return fs;
        case 'path':
            return path;
        case 'buffer':
            return buffer;
        case 'process':
            return node_process.process;
        default:
            return exports.FileSystem[module];
    }
}
exports.BFSRequire = BFSRequire;
function initialize(rootfs) {
    return fs._initialize(rootfs);
}
exports.initialize = initialize;
//# sourceMappingURL=browserfs.js.map