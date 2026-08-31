"use client";

import type { GarmentId, RenderMode } from "@tantu/engine/catalog";

/**
 * The local render library.
 *
 * Every competing tool advertises that it deletes your renders the moment they
 * are made. That is a good privacy line and a terrible product: it means no
 * re-render, no comparison against the original fabric, and no history to push
 * to a storefront. Renders are kept here, on this machine, until you delete
 * them — and a server-side library lands behind a tenant account later.
 */

const DB_NAME = "tantu-tryon";
const DB_VERSION = 1;
const STORE = "renders";

export interface StoredRender {
  id: string;
  createdAt: number;
  /** Groups the poses that came out of one Generate. */
  batchId: string;
  title: string;
  garment: GarmentId;
  mode: RenderMode;
  poseId: string;
  poseName: string;
  scene: string;
  provider: string;
  model: string;
  prompt: string;
  ms: number;
  /** The render, and the reference it must be judged against. */
  image: string;
  referenceThumb?: string;
  starred?: boolean;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("batchId", "batchId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function saveRenders(records: StoredRender[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    for (const record of records) store.put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function listRenders(): Promise<StoredRender[]> {
  const all = await tx<StoredRender[]>("readonly", (store) => store.getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteRender(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id) as unknown as IDBRequest<undefined>);
}

export async function deleteBatch(batchId: string): Promise<void> {
  const all = await listRenders();
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    for (const record of all) if (record.batchId === batchId) store.delete(record.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function setStarred(id: string, starred: boolean): Promise<void> {
  const record = await tx<StoredRender | undefined>("readonly", (store) => store.get(id));
  if (!record) return;
  await saveRenders([{ ...record, starred }]);
}

/** Rough footprint, so the Library can say how much of the disk it is using. */
export function approximateBytes(records: StoredRender[]): number {
  return records.reduce((total, r) => total + r.image.length * 0.75 + (r.referenceThumb?.length ?? 0) * 0.75, 0);
}
