import AsyncMirror from '../backend/AsyncMirror';
import Dropbox from '../backend/Dropbox';
import Emscripten from '../backend/Emscripten';
import FolderAdapter from '../backend/FolderAdapter';
import HTML5FS from '../backend/HTML5FS';
import InMemory from '../backend/InMemory';
import IndexedDB from '../backend/IndexedDB';
import LocalStorage from '../backend/LocalStorage';
import MountableFileSystem from '../backend/MountableFileSystem';
import OverlayFS from '../backend/OverlayFS';
import WorkerFS from '../backend/WorkerFS';
import XmlHttpRequest from '../backend/XmlHttpRequest';
import ZipFS from '../backend/ZipFS';
import IsoFS from '../backend/IsoFS';
/* tslint:disable:variable-name */
/**
 * @hidden
 */
const Backends = { AsyncMirror, Dropbox, Emscripten, FolderAdapter, HTML5FS, InMemory, IndexedDB, IsoFS, LocalStorage, MountableFileSystem, OverlayFS, WorkerFS, XmlHttpRequest, ZipFS };
export default Backends;
/* tslint:enable:variable-name */
