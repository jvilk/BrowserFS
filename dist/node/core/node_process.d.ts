import eventemitter = require('./node_eventemitter');
export declare class TTY extends eventemitter.AbstractDuplexStream {
    isRaw: boolean;
    columns: number;
    rows: number;
    isTTY: boolean;
    constructor();
    setReadMode(mode: boolean): void;
    changeColumns(columns: number): void;
    changeRows(rows: number): void;
    static isatty(fd: any): boolean;
}
export declare class Process {
    private startTime;
    private _cwd;
    chdir(dir: string): void;
    cwd(): string;
    platform: string;
    uptime(): number;
    argv: string[];
    stdout: TTY;
    stderr: TTY;
    stdin: TTY;
}
export declare var process: Process;
