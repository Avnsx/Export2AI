import * as vscode from "vscode";

export class AsyncPool {
  public static async map<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
    options?: {
      cancellationToken?: vscode.CancellationToken;
      onProgress?: (completed: number, total: number, item: T) => void;
    }
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    let nextIndex = 0;
    let completed = 0;
    const workerCount = Math.max(1, Math.min(concurrency, items.length));

    const worker = async (): Promise<void> => {
      while (true) {
        if (options?.cancellationToken?.isCancellationRequested) {
          throw new vscode.CancellationError();
        }

        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        const item = items[currentIndex];
        results[currentIndex] = await mapper(item, currentIndex);
        completed += 1;
        options?.onProgress?.(completed, items.length, item);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }
}

export class DirectoryQueue {
  private readonly pending: vscode.Uri[] = [];
  private readonly pendingSet = new Set<string>();

  public enqueue(uri: vscode.Uri): void {
    const key = uri.toString();
    if (this.pendingSet.has(key)) {
      return;
    }
    this.pendingSet.add(key);
    this.pending.push(uri);
  }

  public dequeue(): vscode.Uri | undefined {
    const uri = this.pending.shift();
    if (uri) {
      this.pendingSet.delete(uri.toString());
    }
    return uri;
  }

  public get size(): number {
    return this.pending.length;
  }
}
