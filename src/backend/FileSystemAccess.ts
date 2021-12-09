import { basename, dirname, join } from "path";
import { ApiError, ErrorCode } from "../core/api_error";
import { File } from "../core/file";
import { FileFlag } from "../core/file_flag";
import {
  BaseFileSystem,
  BFSCallback,
  BFSOneArgCallback,
  FileSystem,
  FileSystemOptions,
} from "../core/file_system";
import { default as Stats, FileType } from "../core/node_fs_stats";
import { NoSyncFile } from "../generic/preload_file";

interface FileSystemAccessFileSystemOptions {
  handle: FileSystemDirectoryHandle;
}

type FileSystemKeysIterator = AsyncIterableIterator<string> & {
  next: () => Promise<IteratorResult<string>>;
};

type GlobalFile = globalThis.File & {
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const handleError =
  (cb: BFSCallback<never>, path = "") =>
  (error: Error) => {
    if (error.name === "NotFoundError") {
      return cb(ApiError.ENOENT(path));
    }

    cb(error as ApiError);
  };

const keysToArray = (
  directoryKeys: FileSystemKeysIterator,
  cb: BFSCallback<string[]>,
  path: string
): void => {
  const keys: string[] = [];
  const iterateKeys = (): void => {
    directoryKeys
      .next()
      .then(({ done, value }) => {
        if (done) return cb(null, keys);

        keys.push(value);
        iterateKeys();
      })
      .catch(handleError(cb, path));
  };

  iterateKeys();
};

export default class FileSystemAccessFileSystem
  extends BaseFileSystem
  implements FileSystem
{
  public static readonly Name = "FileSystemAccess";

  public static readonly Options: FileSystemOptions = {};

  private _handles: { [path: string]: FileSystemHandle };

  private getHandle(path: string, cb: BFSCallback<FileSystemHandle>): void {
    if (path === "/") return cb(null, this._handles["/"]);

    let walkedPath = "/";
    const [, ...pathParts] = path.split("/");
    const getHandleParts = ([pathPart, ...remainingPathParts]: string[]) => {
      const walkingPath = join(walkedPath, pathPart);
      const continueWalk = (handle: FileSystemHandle) => {
        walkedPath = walkingPath;
        this._handles[walkedPath] = handle;

        if (remainingPathParts.length === 0) {
          return cb(null, this._handles[path]);
        }

        getHandleParts(remainingPathParts);
      };
      const handle = this._handles[walkedPath] as FileSystemDirectoryHandle;

      handle
        .getDirectoryHandle(pathPart)
        .then(continueWalk)
        .catch((error: Error) => {
          if (error.name === "TypeMismatchError") {
            handle
              .getFileHandle(pathPart)
              .then(continueWalk)
              .catch(handleError(cb, walkingPath));
          } else if (error.message === "Name is not allowed.") {
            cb(new ApiError(ErrorCode.ENOTSUP, error.message, walkingPath));
          } else {
            handleError(cb, walkingPath)(error);
          }
        });
    };

    getHandleParts(pathParts);
  }

  private constructor(handle: FileSystemDirectoryHandle) {
    super();
    this._handles = { "/": handle };
  }

  public static Create(
    { handle }: FileSystemAccessFileSystemOptions,
    cb: BFSCallback<FileSystemAccessFileSystem>
  ): void {
    cb(null, new FileSystemAccessFileSystem(handle));
  }

  public static isAvailable(): boolean {
    return typeof FileSystemHandle === "function";
  }

  public getName(): string {
    return FileSystemAccessFileSystem.Name;
  }

  public isReadOnly(): boolean {
    return false;
  }

  public supportsSymlinks(): boolean {
    return false;
  }

  public supportsProps(): boolean {
    return false;
  }

  public supportsSynch(): boolean {
    return false;
  }

  public rename(oldPath: string, newPath: string, cb: BFSOneArgCallback): void {
    this.getHandle(oldPath, (sourceError, handle) => {
      if (sourceError) return cb(sourceError);
      if (handle instanceof FileSystemDirectoryHandle) {
        this.readdir(oldPath, (readDirError, files = []) => {
          if (readDirError) return cb(readDirError);
          this.mkdir(newPath, "wx", (mkdirError) => {
            if (mkdirError) return cb(mkdirError);
            if (files.length === 0) {
              this.unlink(oldPath, cb);
            } else {
              files.forEach((file) =>
                this.rename(join(oldPath, file), join(newPath, file), () =>
                  this.unlink(oldPath, cb)
                )
              );
            }
          });
        });
      }
      if (handle instanceof FileSystemFileHandle) {
        handle
          .getFile()
          .then((oldFile: GlobalFile) =>
            this.getHandle(dirname(newPath), (destError, destFolder) => {
              if (destError) return cb(destError);
              if (destFolder instanceof FileSystemDirectoryHandle) {
                destFolder
                  .getFileHandle(basename(newPath), { create: true })
                  .then((newFile) =>
                    newFile
                      .createWritable()
                      .then((writable) =>
                        oldFile
                          .arrayBuffer()
                          .then((buffer) =>
                            writable
                              .write(buffer)
                              .then(() => {
                                writable.close();
                                this.unlink(oldPath, cb);
                              })
                              .catch(handleError(cb, newPath))
                          )
                          .catch(handleError(cb, oldPath))
                      )
                      .catch(handleError(cb, newPath))
                  )
                  .catch(handleError(cb, newPath));
              }
            })
          )
          .catch(handleError(cb, oldPath));
      }
    });
  }

  public writeFile(
    fname: string,
    data: any,
    encoding: string | null,
    flag: FileFlag,
    mode: number,
    cb: BFSOneArgCallback
  ): void {
    this.getHandle(dirname(fname), (error, handle) => {
      if (error) return cb(error);
      if (handle instanceof FileSystemDirectoryHandle) {
        handle
          .getFileHandle(basename(fname), { create: true })
          .then((file) =>
            file
              .createWritable()
              .then((writable) =>
                writable
                  .write(data)
                  .then(() => {
                    writable.close();
                    cb(null);
                  })
                  .catch(handleError(cb, fname))
              )
              .catch(handleError(cb, fname))
          )
          .catch(handleError(cb, fname));
      }
    });
  }

  public stat(path: string, isLstat: boolean, cb: BFSCallback<Stats>): void {
    this.getHandle(path, (error, handle) => {
      if (error || !handle) return cb(error);
      if (handle instanceof FileSystemDirectoryHandle) {
        return cb(null, new Stats(FileType.DIRECTORY, 4096));
      }
      if (handle instanceof FileSystemFileHandle) {
        handle
          .getFile()
          .then(({ lastModified, size }) =>
            cb(
              null,
              new Stats(FileType.FILE, size, undefined, undefined, lastModified)
            )
          )
          .catch(handleError(cb, path));
      }
    });
  }

  public exists(p: string, cb: (exists: boolean) => void): void {
    this.getHandle(p, (error) => cb(error === null));
  }

  public openFile(path: string, flags: FileFlag, cb: BFSCallback<File>): void {
    this.getHandle(path, (error, handle) => {
      if (error) return cb(error);
      if (handle instanceof FileSystemFileHandle) {
        handle
          .getFile()
          .then((file: GlobalFile) =>
            file
              .arrayBuffer()
              .then((buffer) =>
                cb(
                  null,
                  new NoSyncFile(
                    this,
                    path,
                    flags,
                    new Stats(
                      FileType.FILE,
                      file.size,
                      undefined,
                      undefined,
                      file.lastModified
                    ),
                    Buffer.from(buffer)
                  )
                )
              )
              .catch(handleError(cb, path))
          )
          .catch(handleError(cb, path));
      }
    });
  }

  public unlink(path: string, cb: BFSOneArgCallback): void {
    this.getHandle(dirname(path), (error, handle) => {
      if (error) return cb(error);
      if (handle instanceof FileSystemDirectoryHandle) {
        handle
          .removeEntry(basename(path), { recursive: true })
          .then(() => cb(null))
          .catch(handleError(cb, path));
      }
    });
  }

  public rmdir(path: string, cb: BFSOneArgCallback): void {
    this.unlink(path, cb);
  }

  public mkdir(p: string, mode: any, cb: BFSOneArgCallback): void {
    const overwrite =
      mode && mode.flag && mode.flag.includes("w") && !mode.flag.includes("x");

    this.getHandle(p, (_existingError, existingHandle) => {
      if (existingHandle && !overwrite) return cb(ApiError.EEXIST(p));

      this.getHandle(dirname(p), (error, handle) => {
        if (error) return cb(error);
        if (handle instanceof FileSystemDirectoryHandle) {
          handle
            .getDirectoryHandle(basename(p), { create: true })
            .then(() => cb(null))
            .catch(handleError(cb, p));
        }
      });
    });
  }

  public readdir(path: string, cb: BFSCallback<string[]>): void {
    this.getHandle(path, (readError, handle) => {
      if (readError) return cb(readError);
      if (handle instanceof FileSystemDirectoryHandle) {
        keysToArray(handle.keys() as FileSystemKeysIterator, cb, path);
      }
    });
  }
}
