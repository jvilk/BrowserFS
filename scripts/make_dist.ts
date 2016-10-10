#!/usr/bin/env node
/**
 * Assembles the 'dist' folder for BrowserFS.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

const buildFolder = path.resolve('build');
const distFolder = path.resolve('dist');
if (!fs.existsSync(buildFolder)) {
  console.error("Cannot find build folder! Make sure you run this script from the root folder.");
  process.exit(1);
}

function copyToDist(file: string) {
  const dest = path.join(distFolder, file);
  let parent = path.dirname(dest);
  while (!fs.existsSync(parent)) {
    fs.mkdirSync(parent);
    parent = path.dirname(parent);
  }
  fs.writeFileSync(dest, fs.readFileSync(path.join(buildFolder, file)));
}

rimraf(distFolder, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  fs.mkdirSync(distFolder);

  // TypeScript interface
  fs.writeFileSync(path.join(distFolder, 'browserfs.d.ts'),
`export * from './node/main';
export as namespace BrowserFS;
`);

  // Scripts & library files
  [path.join('scripts', 'make_xhrfs_index'), 'browserfs', 'browserfs.min'].forEach((file) => {
    ['.js', '.js.map'].forEach((ext) => {
      copyToDist(`${file}${ext}`);
    });
  });
});

