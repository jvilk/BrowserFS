/**
 * Buffer module. Exports an appropriate version of Buffer for the current
 * platform.
 */
import buffer_old = require('./buffer_old');
import buffer_modern = require('./buffer_modern');

export interface BufferConstructor {
  new (str: string, encoding?: string): NodeBuffer;
  new (size: number): NodeBuffer;
  new (array: any[]): NodeBuffer;
  // Only available in ModernBuffer, since ArrayBuffer does not exist in
  // older JS engines.
  new (ab: ArrayBuffer): NodeBuffer;
  isBuffer(obj: any): boolean;
  byteLength(string: string, encoding?: string): number;
  concat(list: NodeBuffer[], totalLength?: number): NodeBuffer;
}

export var OldBuffer: BufferConstructor = buffer_old.Buffer;
export var ModernBuffer: BufferConstructor = buffer_modern.Buffer;

// Typing copied from ndoe.d.ts.
export var Buffer: BufferConstructor = typeof ArrayBuffer !== 'undefined' ?
  <BufferConstructor> buffer_modern.Buffer :
  <BufferConstructor> buffer_old.Buffer;
