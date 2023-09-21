import * as fs_mock from './FS';
import type * as fs_node from 'node:fs';

const fs: typeof fs_node & typeof fs_mock = fs_mock;

export * from './FS';
export default fs;
