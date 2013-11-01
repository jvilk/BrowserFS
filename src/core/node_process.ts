import node_path = require('./node_path');
var path = node_path.path;

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
  public stdout(print: string) {
    window.alert(print);
  }
  public stdin(prompt?: string) {
    return window.prompt(prompt ? prompt : 'Input: ');
  }
}

// process is a singleton.
export var process = new Process();
