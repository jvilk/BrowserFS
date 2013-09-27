import node_path = require('node_path');
var path = node_path.path;

export class process {
  private static startTime = Date.now();

  private static _cwd: string = '/';

  public static chdir(dir: string): void {
    this._cwd = path.resolve(dir);
  }

  public static cwd(): string {
    return this._cwd;
  }

  public static platform: string = 'browser';

  public static uptime(): number {
    return ((Date.now() - this.startTime) / 1000) | 0;
  }
}
