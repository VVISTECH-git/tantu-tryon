/**
 * The record of what was tried.
 *
 * A run is one output from the image model, kept with everything that made
 * it: the product, the prompt and its version, the exact text that went out,
 * the choices on the left, and the verdict. The point is that "does Prompt 3
 * work" stops being a memory and becomes a count — and that a rejected run
 * carries the note saying why, which is what the next version is built from.
 *
 * Stored in the browser's IndexedDB rather than on a server: the images are
 * a few megabytes each, they are the tester's own, and nothing else needs
 * them. Ask for a run by product, and the store answers from disk.
 */

export type Verdict = "approved" | "rejected" | null;

export interface Run {
  id: string;
  /** Product code the run was for. */
  code: string;
  promptId: string;
  /** "v2", or "draft" for a prompt not yet frozen. */
  version: string;
  /** The text that went to the model, exactly. */
  prompt: string;
  /** "woman · mid-20s · courtyard · sheet" — the choices, for the eye. */
  selections: string;
  image: Blob;
  at: string;
  verdict: Verdict;
  note: string;
}

const DB = "tantu";
const STORE = "runs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("code", "code", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB refused to open."));
  });
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The request failed."));
  });
}

export async function listRuns(code: string): Promise<Run[]> {
  const db = await open();
  const store = db.transaction(STORE, "readonly").objectStore(STORE);
  const runs = (await done(store.index("code").getAll(code))) as Run[];
  db.close();
  return runs.sort((a, b) => a.at.localeCompare(b.at));
}

export async function addRun(run: Run): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  await done(tx.objectStore(STORE).put(run));
  db.close();
}

export async function updateRun(id: string, patch: Partial<Pick<Run, "verdict" | "note">>): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const existing = (await done(store.get(id))) as Run | undefined;
  if (existing) await done(store.put({ ...existing, ...patch }));
  db.close();
}

export async function deleteRun(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  await done(tx.objectStore(STORE).delete(id));
  db.close();
}

export function runId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
