import api_error = require('../core/api_error');
export declare var asyncDownloadFile: {
    (p: string, type: 'buffer', cb: (err: api_error.ApiError, data?: NodeBuffer) => void): void;
    (p: string, type: 'json', cb: (err: api_error.ApiError, data?: any) => void): void;
    (p: string, type: string, cb: (err: api_error.ApiError, data?: any) => void): void;
};
export declare var syncDownloadFile: {
    (p: string, type: 'buffer'): NodeBuffer;
    (p: string, type: 'json'): any;
    (p: string, type: string): any;
};
export declare function getFileSizeSync(p: string): number;
export declare function getFileSizeAsync(p: string, cb: (err: api_error.ApiError, size?: number) => void): void;
