import { default as FS, FSModule } from './FS';

// Manually export the individual public functions of fs.
// Required because some code will invoke functions off of the module.
// e.g.:
// let writeFile = fs.writeFile;
// writeFile(...)

/**
 * @hidden
 */
let fs: any = new FS();
/**
 * @hidden
 */
const _fsMock: FSModule = <any>{};
/**
 * @hidden
 */
for (const key of Object.getOwnPropertyNames(FS.prototype)) {
	if (typeof fs[key] === 'function') {
		_fsMock[key] = function (...args) {
			return (<Function>fs[key]).apply(fs, args);
		};
	} else {
		_fsMock[key] = fs[key];
	}
}
_fsMock.changeFSModule = function (newFs: FS): void {
	fs = newFs;
};
_fsMock.getFSModule = function (): FS {
	return fs;
};
_fsMock.FS = FS;
_fsMock.Stats = FS.Stats;

export default _fsMock;
