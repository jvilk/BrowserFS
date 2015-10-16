var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var buffer = require('../core/buffer');
var api_error = require('../core/api_error');
var file_index = require('../generic/file_index');
var browserfs = require('../core/browserfs');
var node_fs_stats = require('../core/node_fs_stats');
var file_system = require('../core/file_system');
var file_flag = require('../core/file_flag');
var buffer_core_arraybuffer = require('../core/buffer_core_arraybuffer');
var preload_file = require('../generic/preload_file');
var inflateRaw = require('pako/dist/pako_inflate.min').inflateRaw;
var ApiError = api_error.ApiError;
var ErrorCode = api_error.ErrorCode;
var ActionType = file_flag.ActionType;
(function (ExternalFileAttributeType) {
    ExternalFileAttributeType[ExternalFileAttributeType["MSDOS"] = 0] = "MSDOS";
    ExternalFileAttributeType[ExternalFileAttributeType["AMIGA"] = 1] = "AMIGA";
    ExternalFileAttributeType[ExternalFileAttributeType["OPENVMS"] = 2] = "OPENVMS";
    ExternalFileAttributeType[ExternalFileAttributeType["UNIX"] = 3] = "UNIX";
    ExternalFileAttributeType[ExternalFileAttributeType["VM_CMS"] = 4] = "VM_CMS";
    ExternalFileAttributeType[ExternalFileAttributeType["ATARI_ST"] = 5] = "ATARI_ST";
    ExternalFileAttributeType[ExternalFileAttributeType["OS2_HPFS"] = 6] = "OS2_HPFS";
    ExternalFileAttributeType[ExternalFileAttributeType["MAC"] = 7] = "MAC";
    ExternalFileAttributeType[ExternalFileAttributeType["Z_SYSTEM"] = 8] = "Z_SYSTEM";
    ExternalFileAttributeType[ExternalFileAttributeType["CP_M"] = 9] = "CP_M";
    ExternalFileAttributeType[ExternalFileAttributeType["NTFS"] = 10] = "NTFS";
    ExternalFileAttributeType[ExternalFileAttributeType["MVS"] = 11] = "MVS";
    ExternalFileAttributeType[ExternalFileAttributeType["VSE"] = 12] = "VSE";
    ExternalFileAttributeType[ExternalFileAttributeType["ACORN_RISC"] = 13] = "ACORN_RISC";
    ExternalFileAttributeType[ExternalFileAttributeType["VFAT"] = 14] = "VFAT";
    ExternalFileAttributeType[ExternalFileAttributeType["ALT_MVS"] = 15] = "ALT_MVS";
    ExternalFileAttributeType[ExternalFileAttributeType["BEOS"] = 16] = "BEOS";
    ExternalFileAttributeType[ExternalFileAttributeType["TANDEM"] = 17] = "TANDEM";
    ExternalFileAttributeType[ExternalFileAttributeType["OS_400"] = 18] = "OS_400";
    ExternalFileAttributeType[ExternalFileAttributeType["OSX"] = 19] = "OSX";
})(exports.ExternalFileAttributeType || (exports.ExternalFileAttributeType = {}));
var ExternalFileAttributeType = exports.ExternalFileAttributeType;
(function (CompressionMethod) {
    CompressionMethod[CompressionMethod["STORED"] = 0] = "STORED";
    CompressionMethod[CompressionMethod["SHRUNK"] = 1] = "SHRUNK";
    CompressionMethod[CompressionMethod["REDUCED_1"] = 2] = "REDUCED_1";
    CompressionMethod[CompressionMethod["REDUCED_2"] = 3] = "REDUCED_2";
    CompressionMethod[CompressionMethod["REDUCED_3"] = 4] = "REDUCED_3";
    CompressionMethod[CompressionMethod["REDUCED_4"] = 5] = "REDUCED_4";
    CompressionMethod[CompressionMethod["IMPLODE"] = 6] = "IMPLODE";
    CompressionMethod[CompressionMethod["DEFLATE"] = 8] = "DEFLATE";
    CompressionMethod[CompressionMethod["DEFLATE64"] = 9] = "DEFLATE64";
    CompressionMethod[CompressionMethod["TERSE_OLD"] = 10] = "TERSE_OLD";
    CompressionMethod[CompressionMethod["BZIP2"] = 12] = "BZIP2";
    CompressionMethod[CompressionMethod["LZMA"] = 14] = "LZMA";
    CompressionMethod[CompressionMethod["TERSE_NEW"] = 18] = "TERSE_NEW";
    CompressionMethod[CompressionMethod["LZ77"] = 19] = "LZ77";
    CompressionMethod[CompressionMethod["WAVPACK"] = 97] = "WAVPACK";
    CompressionMethod[CompressionMethod["PPMD"] = 98] = "PPMD";
})(exports.CompressionMethod || (exports.CompressionMethod = {}));
var CompressionMethod = exports.CompressionMethod;
function msdos2date(time, date) {
    var day = date & 0x1F;
    var month = ((date >> 5) & 0xF) - 1;
    var year = (date >> 9) + 1980;
    var second = time & 0x1F;
    var minute = (time >> 5) & 0x3F;
    var hour = time >> 11;
    return new Date(year, month, day, hour, minute, second);
}
function safeToString(buff, useUTF8, start, length) {
    return length === 0 ? "" : buff.toString(useUTF8 ? 'utf8' : 'extended_ascii', start, start + length);
}
var FileHeader = (function () {
    function FileHeader(data) {
        this.data = data;
        if (data.readUInt32LE(0) !== 0x04034b50) {
            throw new ApiError(ErrorCode.EINVAL, "Invalid Zip file: Local file header has invalid signature: " + this.data.readUInt32LE(0));
        }
    }
    FileHeader.prototype.versionNeeded = function () { return this.data.readUInt16LE(4); };
    FileHeader.prototype.flags = function () { return this.data.readUInt16LE(6); };
    FileHeader.prototype.compressionMethod = function () { return this.data.readUInt16LE(8); };
    FileHeader.prototype.lastModFileTime = function () {
        return msdos2date(this.data.readUInt16LE(10), this.data.readUInt16LE(12));
    };
    FileHeader.prototype.crc32 = function () { return this.data.readUInt32LE(14); };
    FileHeader.prototype.fileNameLength = function () { return this.data.readUInt16LE(26); };
    FileHeader.prototype.extraFieldLength = function () { return this.data.readUInt16LE(28); };
    FileHeader.prototype.fileName = function () {
        return safeToString(this.data, this.useUTF8(), 30, this.fileNameLength());
    };
    FileHeader.prototype.extraField = function () {
        var start = 30 + this.fileNameLength();
        return this.data.slice(start, start + this.extraFieldLength());
    };
    FileHeader.prototype.totalSize = function () { return 30 + this.fileNameLength() + this.extraFieldLength(); };
    FileHeader.prototype.useUTF8 = function () { return (this.flags() & 0x800) === 0x800; };
    return FileHeader;
})();
exports.FileHeader = FileHeader;
var FileData = (function () {
    function FileData(header, record, data) {
        this.header = header;
        this.record = record;
        this.data = data;
    }
    FileData.prototype.decompress = function () {
        var buff = this.data;
        var compressionMethod = this.header.compressionMethod();
        switch (compressionMethod) {
            case CompressionMethod.DEFLATE:
                if (buff.getBufferCore() instanceof buffer_core_arraybuffer.BufferCoreArrayBuffer) {
                    var bcore = buff.getBufferCore();
                    var dview = bcore.getDataView();
                    var start = dview.byteOffset + buff.getOffset();
                    var uarray = (new Uint8Array(dview.buffer)).subarray(start, start + this.record.compressedSize());
                    var data = inflateRaw(uarray, {
                        chunkSize: this.record.uncompressedSize()
                    });
                    return new buffer.Buffer(new buffer_core_arraybuffer.BufferCoreArrayBuffer(data.buffer), data.byteOffset, data.byteOffset + data.length);
                }
                else {
                    var newBuff = buff.slice(0, this.record.compressedSize());
                    return new buffer.Buffer((inflateRaw(newBuff.toJSON().data, { chunkSize: this.record.uncompressedSize() })));
                }
            case CompressionMethod.STORED:
                return buff.sliceCopy(0, this.record.uncompressedSize());
            default:
                var name = CompressionMethod[compressionMethod];
                name = name ? name : "Unknown: " + compressionMethod;
                throw new ApiError(ErrorCode.EINVAL, "Invalid compression method on file '" + this.header.fileName() + "': " + name);
        }
    };
    return FileData;
})();
exports.FileData = FileData;
var DataDescriptor = (function () {
    function DataDescriptor(data) {
        this.data = data;
    }
    DataDescriptor.prototype.crc32 = function () { return this.data.readUInt32LE(0); };
    DataDescriptor.prototype.compressedSize = function () { return this.data.readUInt32LE(4); };
    DataDescriptor.prototype.uncompressedSize = function () { return this.data.readUInt32LE(8); };
    return DataDescriptor;
})();
exports.DataDescriptor = DataDescriptor;
var ArchiveExtraDataRecord = (function () {
    function ArchiveExtraDataRecord(data) {
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x08064b50) {
            throw new ApiError(ErrorCode.EINVAL, "Invalid archive extra data record signature: " + this.data.readUInt32LE(0));
        }
    }
    ArchiveExtraDataRecord.prototype.length = function () { return this.data.readUInt32LE(4); };
    ArchiveExtraDataRecord.prototype.extraFieldData = function () { return this.data.slice(8, 8 + this.length()); };
    return ArchiveExtraDataRecord;
})();
exports.ArchiveExtraDataRecord = ArchiveExtraDataRecord;
var DigitalSignature = (function () {
    function DigitalSignature(data) {
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x05054b50) {
            throw new ApiError(ErrorCode.EINVAL, "Invalid digital signature signature: " + this.data.readUInt32LE(0));
        }
    }
    DigitalSignature.prototype.size = function () { return this.data.readUInt16LE(4); };
    DigitalSignature.prototype.signatureData = function () { return this.data.slice(6, 6 + this.size()); };
    return DigitalSignature;
})();
exports.DigitalSignature = DigitalSignature;
var CentralDirectory = (function () {
    function CentralDirectory(zipData, data) {
        this.zipData = zipData;
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x02014b50)
            throw new ApiError(ErrorCode.EINVAL, "Invalid Zip file: Central directory record has invalid signature: " + this.data.readUInt32LE(0));
    }
    CentralDirectory.prototype.versionMadeBy = function () { return this.data.readUInt16LE(4); };
    CentralDirectory.prototype.versionNeeded = function () { return this.data.readUInt16LE(6); };
    CentralDirectory.prototype.flag = function () { return this.data.readUInt16LE(8); };
    CentralDirectory.prototype.compressionMethod = function () { return this.data.readUInt16LE(10); };
    CentralDirectory.prototype.lastModFileTime = function () {
        return msdos2date(this.data.readUInt16LE(12), this.data.readUInt16LE(14));
    };
    CentralDirectory.prototype.crc32 = function () { return this.data.readUInt32LE(16); };
    CentralDirectory.prototype.compressedSize = function () { return this.data.readUInt32LE(20); };
    CentralDirectory.prototype.uncompressedSize = function () { return this.data.readUInt32LE(24); };
    CentralDirectory.prototype.fileNameLength = function () { return this.data.readUInt16LE(28); };
    CentralDirectory.prototype.extraFieldLength = function () { return this.data.readUInt16LE(30); };
    CentralDirectory.prototype.fileCommentLength = function () { return this.data.readUInt16LE(32); };
    CentralDirectory.prototype.diskNumberStart = function () { return this.data.readUInt16LE(34); };
    CentralDirectory.prototype.internalAttributes = function () { return this.data.readUInt16LE(36); };
    CentralDirectory.prototype.externalAttributes = function () { return this.data.readUInt32LE(38); };
    CentralDirectory.prototype.headerRelativeOffset = function () { return this.data.readUInt32LE(42); };
    CentralDirectory.prototype.fileName = function () {
        var fileName = safeToString(this.data, this.useUTF8(), 46, this.fileNameLength());
        return fileName.replace(/\\/g, "/");
    };
    CentralDirectory.prototype.extraField = function () {
        var start = 44 + this.fileNameLength();
        return this.data.slice(start, start + this.extraFieldLength());
    };
    CentralDirectory.prototype.fileComment = function () {
        var start = 46 + this.fileNameLength() + this.extraFieldLength();
        return safeToString(this.data, this.useUTF8(), start, this.fileCommentLength());
    };
    CentralDirectory.prototype.totalSize = function () {
        return 46 + this.fileNameLength() + this.extraFieldLength() + this.fileCommentLength();
    };
    CentralDirectory.prototype.isDirectory = function () {
        var fileName = this.fileName();
        return (this.externalAttributes() & 0x10 ? true : false) || (fileName.charAt(fileName.length - 1) === '/');
    };
    CentralDirectory.prototype.isFile = function () { return !this.isDirectory(); };
    CentralDirectory.prototype.useUTF8 = function () { return (this.flag() & 0x800) === 0x800; };
    CentralDirectory.prototype.isEncrypted = function () { return (this.flag() & 0x1) === 0x1; };
    CentralDirectory.prototype.getData = function () {
        var start = this.headerRelativeOffset();
        var header = new FileHeader(this.zipData.slice(start));
        var filedata = new FileData(header, this, this.zipData.slice(start + header.totalSize()));
        return filedata.decompress();
    };
    CentralDirectory.prototype.getStats = function () {
        return new node_fs_stats.Stats(node_fs_stats.FileType.FILE, this.uncompressedSize(), 0x16D, new Date(), this.lastModFileTime());
    };
    return CentralDirectory;
})();
exports.CentralDirectory = CentralDirectory;
var EndOfCentralDirectory = (function () {
    function EndOfCentralDirectory(data) {
        this.data = data;
        if (this.data.readUInt32LE(0) !== 0x06054b50)
            throw new ApiError(ErrorCode.EINVAL, "Invalid Zip file: End of central directory record has invalid signature: " + this.data.readUInt32LE(0));
    }
    EndOfCentralDirectory.prototype.diskNumber = function () { return this.data.readUInt16LE(4); };
    EndOfCentralDirectory.prototype.cdDiskNumber = function () { return this.data.readUInt16LE(6); };
    EndOfCentralDirectory.prototype.cdDiskEntryCount = function () { return this.data.readUInt16LE(8); };
    EndOfCentralDirectory.prototype.cdTotalEntryCount = function () { return this.data.readUInt16LE(10); };
    EndOfCentralDirectory.prototype.cdSize = function () { return this.data.readUInt32LE(12); };
    EndOfCentralDirectory.prototype.cdOffset = function () { return this.data.readUInt32LE(16); };
    EndOfCentralDirectory.prototype.cdZipComment = function () {
        return safeToString(this.data, true, 22, this.data.readUInt16LE(20));
    };
    return EndOfCentralDirectory;
})();
exports.EndOfCentralDirectory = EndOfCentralDirectory;
var ZipFS = (function (_super) {
    __extends(ZipFS, _super);
    function ZipFS(data, name) {
        if (name === void 0) { name = ''; }
        _super.call(this);
        this.data = data;
        this.name = name;
        this._index = new file_index.FileIndex();
        this.populateIndex();
    }
    ZipFS.prototype.getName = function () {
        return 'ZipFS' + (this.name !== '' ? ' ' + this.name : '');
    };
    ZipFS.isAvailable = function () { return true; };
    ZipFS.prototype.diskSpace = function (path, cb) {
        cb(this.data.length, 0);
    };
    ZipFS.prototype.isReadOnly = function () {
        return true;
    };
    ZipFS.prototype.supportsLinks = function () {
        return false;
    };
    ZipFS.prototype.supportsProps = function () {
        return false;
    };
    ZipFS.prototype.supportsSynch = function () {
        return true;
    };
    ZipFS.prototype.statSync = function (path, isLstat) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw new ApiError(ErrorCode.ENOENT, "" + path + " not found.");
        }
        var stats;
        if (inode.isFile()) {
            stats = inode.getData().getStats();
        }
        else {
            stats = inode.getStats();
        }
        return stats;
    };
    ZipFS.prototype.openSync = function (path, flags, mode) {
        if (flags.isWriteable()) {
            throw new ApiError(ErrorCode.EPERM, path);
        }
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw new ApiError(ErrorCode.ENOENT, "" + path + " is not in the FileIndex.");
        }
        if (inode.isDir()) {
            throw new ApiError(ErrorCode.EISDIR, "" + path + " is a directory.");
        }
        var cdRecord = inode.getData();
        var stats = cdRecord.getStats();
        switch (flags.pathExistsAction()) {
            case ActionType.THROW_EXCEPTION:
            case ActionType.TRUNCATE_FILE:
                throw new ApiError(ErrorCode.EEXIST, "" + path + " already exists.");
            case ActionType.NOP:
                return new preload_file.NoSyncFile(this, path, flags, stats, cdRecord.getData());
            default:
                throw new ApiError(ErrorCode.EINVAL, 'Invalid FileMode object.');
        }
        return null;
    };
    ZipFS.prototype.readdirSync = function (path) {
        var inode = this._index.getInode(path);
        if (inode === null) {
            throw new ApiError(ErrorCode.ENOENT, "" + path + " not found.");
        }
        else if (inode.isFile()) {
            throw new ApiError(ErrorCode.ENOTDIR, "" + path + " is a file, not a directory.");
        }
        return inode.getListing();
    };
    ZipFS.prototype.readFileSync = function (fname, encoding, flag) {
        var fd = this.openSync(fname, flag, 0x1a4);
        try {
            var fdCast = fd;
            var fdBuff = fdCast.getBuffer();
            if (encoding === null) {
                if (fdBuff.length > 0) {
                    return fdBuff.sliceCopy();
                }
                else {
                    return new buffer.Buffer(0);
                }
            }
            return fdBuff.toString(encoding);
        }
        finally {
            fd.closeSync();
        }
    };
    ZipFS.prototype.getEOCD = function () {
        var startOffset = 22;
        var endOffset = Math.min(startOffset + 0xFFFF, this.data.length - 1);
        for (var i = startOffset; i < endOffset; i++) {
            if (this.data.readUInt32LE(this.data.length - i) === 0x06054b50) {
                return new EndOfCentralDirectory(this.data.slice(this.data.length - i));
            }
        }
        throw new ApiError(ErrorCode.EINVAL, "Invalid ZIP file: Could not locate End of Central Directory signature.");
    };
    ZipFS.prototype.populateIndex = function () {
        var eocd = this.getEOCD();
        if (eocd.diskNumber() !== eocd.cdDiskNumber())
            throw new ApiError(ErrorCode.EINVAL, "ZipFS does not support spanned zip files.");
        var cdPtr = eocd.cdOffset();
        if (cdPtr === 0xFFFFFFFF)
            throw new ApiError(ErrorCode.EINVAL, "ZipFS does not support Zip64.");
        var cdEnd = cdPtr + eocd.cdSize();
        while (cdPtr < cdEnd) {
            var cd = new CentralDirectory(this.data, this.data.slice(cdPtr));
            cdPtr += cd.totalSize();
            var filename = cd.fileName();
            if (filename.charAt(0) === '/')
                throw new Error("WHY IS THIS ABSOLUTE");
            if (filename.charAt(filename.length - 1) === '/') {
                filename = filename.substr(0, filename.length - 1);
            }
            if (cd.isDirectory()) {
                this._index.addPath('/' + filename, new file_index.DirInode());
            }
            else {
                this._index.addPath('/' + filename, new file_index.FileInode(cd));
            }
        }
    };
    return ZipFS;
})(file_system.SynchronousFileSystem);
exports.ZipFS = ZipFS;
browserfs.registerFileSystem('ZipFS', ZipFS);
//# sourceMappingURL=zipfs.js.map