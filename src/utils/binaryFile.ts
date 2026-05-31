import type { IsBinaryOptions } from "isbinaryfile";

type IsBinaryFileFn = (file: string | Buffer, options?: IsBinaryOptions) => Promise<boolean>;

interface BinaryFileModule {
  isBinaryFile: IsBinaryFileFn;
}

const importEsm = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<BinaryFileModule>;

let binaryFileModulePromise: Promise<BinaryFileModule> | undefined;

async function loadBinaryFileModule(): Promise<BinaryFileModule> {
  if (!binaryFileModulePromise) {
    binaryFileModulePromise = importEsm("isbinaryfile");
  }
  return binaryFileModulePromise;
}

export async function isBinaryBuffer(fileBuffer: Buffer, size?: number): Promise<boolean> {
  const { isBinaryFile } = await loadBinaryFileModule();
  const options = typeof size === "number" && Number.isFinite(size)
    ? { size }
    : undefined;
  return isBinaryFile(fileBuffer, options);
}
