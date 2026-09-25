/**
 * Runs one file import in a Web Worker. Returns a handle with the result promise and a
 * cancel() that terminates the worker (the parse stops immediately).
 */
import type { ImportWorkerMessage } from '../../workers/importWorker';

export type ImportOutcome = Exclude<ImportWorkerMessage, { type: 'progress' }>;

export interface ImportHandle {
  result: Promise<ImportOutcome | { type: 'cancelled' }>;
  cancel: () => void;
}

export function startImport(file: File, onProgress: (stage: string, fraction: number) => void): ImportHandle {
  const worker = new Worker(new URL('../../workers/importWorker.ts', import.meta.url), { type: 'module' });
  let settle: (v: ImportOutcome | { type: 'cancelled' }) => void = () => {};
  const result = new Promise<ImportOutcome | { type: 'cancelled' }>((resolve) => {
    settle = resolve;
  });
  worker.onmessage = (e: MessageEvent<ImportWorkerMessage>) => {
    const m = e.data;
    if (m.type === 'progress') {
      onProgress(m.stage, m.fraction);
      return;
    }
    worker.terminate();
    settle(m);
  };
  worker.onerror = (e) => {
    worker.terminate();
    settle({ type: 'error', message: { vi: `Lỗi xử lý file: ${e.message}`, en: `Import failed: ${e.message}` } });
  };
  worker.postMessage({ file });
  return {
    result,
    cancel: () => {
      worker.terminate();
      settle({ type: 'cancelled' });
    },
  };
}
