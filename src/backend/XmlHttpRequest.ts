import file_system = require('../core/file_system');
import file_index = require('../generic/file_index');
import buffer = require('../core/buffer');
import api_error = require('../core/api_error');
import file_flag = require('../core/file_flag');
import util = require('../core/util');
import file = require('../core/file');
import node_fs_stats = require('../core/node_fs_stats');
import preload_file = require('../generic/preload_file');
import browserfs = require('../core/browserfs');

var Buffer = buffer.Buffer;
var ApiError = api_error.ApiError;
var ErrorType = api_error.ErrorType;
var FileFlag = file_flag.FileFlag;
var ActionType = file_flag.ActionType;

document.write("<!-- IEBinaryToArray_ByteStr -->\r\n" +
  "<script type='text/vbscript'>\r\n" +
  "Function getIEByteArray(byteArray, out)\r\n" +
  "  Dim len, i\r\n" + "  len = LenB(byteArray)\r\n" +
  "  For i = 1 to len\r\n" +
  "    out.push(AscB(MidB(byteArray, i, 1)))\r\n" +
  "  Next\r\n" +
  "End Function\r\n" +
  "</script>\r\n");
declare var getIEByteArray: (vbarr: any, arr: number[]) => void;

export class XmlHttpRequestAbstract extends file_system.FileSystem {
  private _index: file_index.FileIndex;
  public prefix_url: string;
  constructor(listing_url: string, prefix_url: string) {
    super();
    if (listing_url == null) {
      listing_url = 'index.json';
    }
    this.prefix_url = prefix_url != null ? prefix_url : '';
    var listing = this._request_file(listing_url, 'json');
    if (listing == null) {
      throw new Error("Unable to find listing at URL: " + listing_url);
    }
    this._index = file_index.FileIndex.from_listing(listing);
  }

  public empty(): void {
    var idx = this._index._index;
    for (var k in idx) {
      var v = <node_fs_stats.Stats> idx[k];
      if (v.file_data != null) {
        v.file_data = null;
      }
    }
  }

  public _request_file_size(path: string, cb: (size: number) => void): void {
    var req = new XMLHttpRequest();
    req.open('HEAD', this.prefix_url + path);
    req.onreadystatechange = function(e) {
      if (req.readyState === 4) {
        if (req.status !== 200) {
          console.error(req.statusText);
        }
        try {
          cb(parseInt(req.getResponseHeader('Content-Length'), 10));
        } catch(e) {
          // In the event that the header isn't present or there is an error...
          cb(-1);
        }
      }
    };
    req.send();
  }

  public _request_file(path: string, data_type: string, cb?: (data: any) => void): any {
    throw new ApiError(ErrorType.NOT_SUPPORTED, 'XmlHttpRequestAbstract is an abstract class.');
  }

  public getName(): string {
    return 'XmlHttpRequest';
  }

  public static isAvailable(): boolean {
    return typeof XMLHttpRequest !== "undefined" && XMLHttpRequest !== null;
  }

  public diskSpace(path: string, cb: (total: number, free: number) => void): void {
    cb(0, 0);
  }

  public isReadOnly(): boolean {
    return true;
  }

  public supportsLinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public preloadFile(path: string, buffer: buffer.Buffer): void {
    var inode = <node_fs_stats.Stats> this._index.getInode(path);
    if (inode === null) {
      throw new ApiError(ErrorType.NOT_FOUND, "" + path + " not found.");
    }
    inode.size = buffer.length;
    inode.file_data = new preload_file.NoSyncFile(this, path, FileFlag.getFileFlag('r'), inode, buffer);
  }

  public stat(path: string, isLstat: boolean, cb: (e: api_error.ApiError, stat?: node_fs_stats.Stats) => void): void {
    var inode = this._index.getInode(path);
    if (inode === null) {
      return cb(new ApiError(ErrorType.NOT_FOUND, "" + path + " not found."));
    }
    var stats: node_fs_stats.Stats;
    if (inode.isFile()) {
      stats = <node_fs_stats.Stats> inode;
      if (stats.size < 0) {
        this._request_file_size(path, function(size) {
          stats.size = size;
          cb(null, stats);
        });
      } else {
        cb(null, stats);
      }
    } else {
      stats = (<file_index.DirInode> inode).getStats();
      cb(null, stats);
    }
  }

  public open(path: string, flags: file_flag.FileFlag, mode: number, cb: (e: api_error.ApiError, file?: file.File) => void): void {
    var _this = this;
    var inode = <node_fs_stats.Stats> this._index.getInode(path);
    if (inode === null) {
      return cb(new ApiError(ErrorType.NOT_FOUND, "" + path + " is not in the FileIndex."));
    }
    if (inode.isDirectory()) {
      return cb(new ApiError(ErrorType.NOT_FOUND, "" + path + " is a directory."));
    }
    switch (flags.pathExistsAction()) {
      case ActionType.THROW_EXCEPTION:
      case ActionType.TRUNCATE_FILE:
        return cb(new ApiError(ErrorType.NOT_FOUND, "" + path + " already exists."));
      case ActionType.NOP:
        if (inode.file_data != null) {
          return cb(null, inode.file_data);
        }
        this._request_file(path, 'arraybuffer', function(buffer) {
          inode.size = buffer.length;
          inode.file_data = new preload_file.NoSyncFile(_this, path, flags, inode, buffer);
          return cb(null, inode.file_data);
        });
        break;
      default:
        return cb(new ApiError(ErrorType.INVALID_PARAM, 'Invalid FileMode object.'));
    }
  }

  public readdir(path: string, cb: (e: api_error.ApiError, listing?: string[]) => void): void {
    var inode = this._index.getInode(path);
    if (inode === null) {
      return cb(new ApiError(ErrorType.NOT_FOUND, "" + path + " not found."));
    } else if (inode.isFile()) {
      return cb(new ApiError(ErrorType.NOT_FOUND, "" + path + " is a file, not a directory."));
    }
    return cb(null, (<file_index.DirInode> inode).getListing());
  }
}

export class XmlHttpRequestIE extends XmlHttpRequestAbstract {
  constructor(listing_url: string, prefix_url: string) {
    super(listing_url, prefix_url);
  }

  public _request_file(path: string, data_type: string, cb?: (data: any) => void): any {
    var _this = this;
    var req = new XMLHttpRequest();
    req.open('GET', this.prefix_url + path, cb != null);
    req.setRequestHeader("Accept-Charset", "x-user-defined");
    var data = null;
    req.onreadystatechange = function(e) {
      var data_array;
      if (req.readyState === 4) {
        if (req.status === 200) {
          if (data_type === 'arraybuffer') {
            getIEByteArray(req.responseBody, data_array = []);
            data = new Buffer(data_array);
          } else {
            data = req.responseText;
          }
          return typeof cb === "function" ? cb(data) : void 0;
        } else {
          console.error("ReadyState: " + req.readyState + " Status: " + req.status);
        }
      }
    };
    req.send();
    if ((data != null) && data !== 'NOT FOUND') {
      return data;
    }
  }
}

export class XmlHttpRequestModern extends XmlHttpRequestAbstract {
  constructor(listing_url: string, prefix_url: string) {
    super(listing_url, prefix_url);
  }

  public _request_file(path: string, data_type: string, cb?: (data: any) => void): any {
    var req = new XMLHttpRequest();
    req.open('GET', this.prefix_url + path, cb != null);
    req.responseType = data_type;
    var data = null;
    req.onerror = function(e) {
      console.error(req.statusText);
    };
    req.onload = function(e) {
      if (!(req.readyState === 4 && req.status === 200)) {
        console.error(req.statusText);
      }
      if (data_type === 'arraybuffer') {
        data = new Buffer(req.response);
      } else {
        data = req.response;
      }
      return typeof cb === "function" ? cb(data) : void 0;
    };
    req.send();
    if ((data != null) && data !== 'NOT FOUND') {
      return data;
    }
  }
}

export var XmlHttpRequest = (util.isIE && typeof window['Blob'] === 'undefined') ? XmlHttpRequestIE : XmlHttpRequestModern;

browserfs.registerFileSystem('XmlHttpRequest', XmlHttpRequest);
