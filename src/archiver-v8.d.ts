declare module "archiver" {
  import type { Writable } from "stream";

  export interface ZipArchiveOptions {
    zlib?: { level?: number };
  }

  export class ZipArchive {
    constructor(options?: ZipArchiveOptions);
    pipe<T extends Writable>(destination: T): T;
    file(filepath: string, data?: { name?: string }): this;
    append(source: string | Buffer, data?: { name?: string }): this;
    finalize(): Promise<void>;
    on(event: "error", listener: (error: Error) => void): this;
  }
}
