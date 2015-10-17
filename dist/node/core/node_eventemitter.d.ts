export declare class AbstractEventEmitter implements NodeJS.EventEmitter {
    private _listeners;
    private maxListeners;
    addListener(event: string, listener: Function): NodeJS.EventEmitter;
    on(event: string, listener: Function): NodeJS.EventEmitter;
    once(event: string, listener: Function): NodeJS.EventEmitter;
    private _emitRemoveListener(event, listeners);
    removeListener(event: string, listener: Function): NodeJS.EventEmitter;
    removeAllListeners(event?: string): NodeJS.EventEmitter;
    setMaxListeners(n: number): void;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
}
export declare class AbstractDuplexStream extends AbstractEventEmitter implements NodeJS.ReadWriteStream {
    writable: boolean;
    readable: boolean;
    private encoding;
    private flowing;
    private buffer;
    private endEvent;
    private ended;
    private drained;
    constructor(writable: boolean, readable: boolean);
    addListener(event: string, listener: Function): NodeJS.EventEmitter;
    private _processArgs(data?, arg2?, arg3?);
    private _processEvents();
    private emitEvent(type, event);
    write(data: string, cb?: Function): boolean;
    write(data: string, encoding?: string, cb?: Function): boolean;
    write(data: NodeBuffer, cb?: Function): boolean;
    end(): void;
    end(data: string, cb?: Function): void;
    end(data: string, encoding?: string, cb?: Function): void;
    end(data: NodeBuffer): void;
    read(size?: number): any;
    setEncoding(encoding: string): void;
    pause(): void;
    resume(): void;
    pipe<T extends NodeJS.WritableStream>(destination: T, options?: {
        end?: boolean;
    }): T;
    unpipe<T extends NodeJS.WritableStream>(destination?: T): void;
    unshift(chunk: String): void;
    unshift(chunk: NodeBuffer): void;
    private _push(event);
    wrap(stream: NodeJS.ReadableStream): NodeJS.ReadableStream;
}
