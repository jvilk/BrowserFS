import eventemitter = require('./node_eventemitter');
var path = null;

export class TTY extends eventemitter.AbstractDuplexStream {
  public isRaw: boolean = false;
  public columns: number = 80;
  public rows: number = 120;
  public isTTY: boolean = true;

  constructor() {
    super(true, true);
  }

  /**
   * Set read mode to 'true' to enable raw mode.
   */
  public setReadMode(mode: boolean): void {
    if (this.isRaw !== mode) {
      this.isRaw = mode;
      // [BFS] TTY implementations can use this to change their event emitting
      //       patterns.
      this.emit('modeChange');
    }
  }

  /**
   * [BFS] Update the number of columns available on the terminal.
   */
  public changeColumns(columns: number): void {
    if (columns !== this.columns) {
      this.columns = columns;
      // Resize event.
      this.emit('resize');
    }
  }

  /**
   * [BFS] Update the number of rows available on the terminal.
   */
  public changeRows(rows: number): void {
    if (rows !== this.rows) {
      this.rows = rows;
      // Resize event.
      this.emit('resize');
    }
  }

  /**
   * Returns 'true' if the given object is a TTY.
   */
  public static isatty(fd: any): boolean {
    return fd instanceof TTY;
  }
}

/**
 * Partial implementation of Node's `process` module.
 * We implement the portions that are relevant for the filesystem.
 * @see http://nodejs.org/api/process.html
 * @class
 */
export class Process {
  private startTime = Date.now();

  private _cwd: string = '/';
  /**
   * Changes the current working directory.
   *
   * **Note**: BrowserFS does not validate that the directory actually exists.
   *
   * @example Usage example
   *   console.log('Starting directory: ' + process.cwd());
   *   process.chdir('/tmp');
   *   console.log('New directory: ' + process.cwd());
   * @param [String] dir The directory to change to.
   */
  public chdir(dir: string): void {
    // XXX: Circular dependency hack.
    if (path === null) {
      path = require('./node_path').path;
    }
    this._cwd = path.resolve(dir);
  }
  /**
   * Returns the current working directory.
   * @example Usage example
   *   console.log('Current directory: ' + process.cwd());
   * @return [String] The current working directory.
   */
  public cwd(): string {
    return this._cwd;
  }
  /**
   * Returns what platform you are running on.
   * @return [String]
   */
  public platform: string = 'browser';
  /**
   * Number of seconds BrowserFS has been running.
   * @return [Number]
   */
  public uptime(): number {
    return ((Date.now() - this.startTime) / 1000) | 0;
  }

  public argv: string[] = [];
  public stdout = new TTY();
  public stderr = new TTY();
  public stdin = new TTY();
}

// process is a singleton.
export var process = new Process();
