import * as fs_mock from './index';
import type * as fs_node from 'node:fs';

type BrowserFSModule = typeof fs_node & typeof fs_mock;
const fs: BrowserFSModule = fs_mock;

export * from './index';
export default fs;
