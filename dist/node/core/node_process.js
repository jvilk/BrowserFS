var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var eventemitter = require('./node_eventemitter');
var path = null;
var TTY = (function (_super) {
    __extends(TTY, _super);
    function TTY() {
        _super.call(this, true, true);
        this.isRaw = false;
        this.columns = 80;
        this.rows = 120;
        this.isTTY = true;
    }
    TTY.prototype.setReadMode = function (mode) {
        if (this.isRaw !== mode) {
            this.isRaw = mode;
            this.emit('modeChange');
        }
    };
    TTY.prototype.changeColumns = function (columns) {
        if (columns !== this.columns) {
            this.columns = columns;
            this.emit('resize');
        }
    };
    TTY.prototype.changeRows = function (rows) {
        if (rows !== this.rows) {
            this.rows = rows;
            this.emit('resize');
        }
    };
    TTY.isatty = function (fd) {
        return fd instanceof TTY;
    };
    return TTY;
})(eventemitter.AbstractDuplexStream);
exports.TTY = TTY;
var Process = (function () {
    function Process() {
        this.startTime = Date.now();
        this._cwd = '/';
        this.platform = 'browser';
        this.argv = [];
        this.stdout = new TTY();
        this.stderr = new TTY();
        this.stdin = new TTY();
    }
    Process.prototype.chdir = function (dir) {
        if (path === null) {
            path = require('./node_path');
        }
        this._cwd = path.resolve(dir);
    };
    Process.prototype.cwd = function () {
        return this._cwd;
    };
    Process.prototype.uptime = function () {
        return ((Date.now() - this.startTime) / 1000) | 0;
    };
    return Process;
})();
exports.Process = Process;
exports.process = new Process();
//# sourceMappingURL=node_process.js.map