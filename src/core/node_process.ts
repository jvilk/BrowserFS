var path = null;

/**
 * Simple emulation of NodeJS's standard input.
 */
export class Stdin {
  private paused: boolean = true;
  private dataCallbacks: {(chunk: NodeBuffer): void;}[] = [];

  public on(type: string, cb: (chunk: NodeBuffer) => void) {
    if (type === 'data') {
      this.dataCallbacks.push(cb);
    }
  }
  public resume(): void {
    this.paused = false;
  }
  public pause(): void {
    this.paused = true;
  }
  /**
   * [BFS]
   * Alert BrowserFS to an input event.
   */
  public write(chunk: NodeBuffer) {
    var i: number;
    if (!this.paused) {
      for (i = 0; i <  this.dataCallbacks.length; i++) {
        this.dataCallbacks[i](chunk);
      }
    }
  }
}

/**
 * Simple emulation of NodeJS's standard output.
 * Also used for Stderr.
 */
export class Stdout {
  public write(data: string): void {
    this.writeCb(data);
  }
  /**
   * [BFS]
   * Set a callback here that writes to your terminal emulator for stdout
   * support.
   */
  public writeCb: (data: string) => void = function(data: string) {
    // NOP.
  };
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
  public stdout = new Stdout();
  public stderr = new Stdout();
  public stdin = new Stdin();
}

// process is a singleton.
export var process = new Process();
