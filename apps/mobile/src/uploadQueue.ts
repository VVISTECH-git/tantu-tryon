import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as api from "./api";
import type { UploadResult } from "@tantu/shared/views";
import { editRect, type PhotoEdit } from "@tantu/shared/photoEdit";

/**
 * Photos send in the background (28 Sep): the photographer taps "Use photo"
 * and carries on, instead of waiting ~9 s for a 7-15 MB original to go up.
 *
 * Each photo is copied into the app's own documents (the camera's copy sits
 * in a cache the phone may clear) and listed in a small file there, so a
 * photo still waiting survives the app being closed and sends on the next
 * start. One photo goes at a time, oldest first. No internet: it waits and
 * tries again by itself. A photo the server refuses (unreadable, product
 * deleted) is dropped and reported, so it can be taken again.
 *
 * The photo goes up as the edit screen left it (full resolution); beside it
 * the phone sends a 1600 px screen copy, so the server reads only the
 * photo's first bytes.
 */

export interface QueuedPhoto {
  id: string;
  garmentId: string;
  productCode: string | null;
  slot: string;
  label: string;
  type: string;
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  queuedAt: string;
  /** Crop, turns, straighten, brightness from the edit screen; burned in before sending. */
  edit?: PhotoEdit | null;
  /** The edit screen's small copy, shown on the phone until the upload lands. */
  shownUri?: string | null;
  /**
   * Where the camera (or the edit) left the photo: the image tool reads from
   * here. The kept copy in the app's folder is for sending and for a restart;
   * in the Expo Go test app that folder's name has "%" in it and the image
   * tool cannot open files there (28 Sep).
   */
  sourceUri?: string | null;
}

export interface QueueState {
  items: QueuedPhoto[];
  /** Set while the oldest item is going up. */
  sending: boolean;
  /** Set after a network failure, until the next try. */
  waitingForInternet: boolean;
}

type Done = (item: QueuedPhoto, result: UploadResult) => void;
type Failed = (item: QueuedPhoto, message: string) => void;

const dir = new Directory(Paths.document, "tantu-uploads");
const listFile = new File(Paths.document, "tantu-upload-queue.json");

let items: QueuedPhoto[] = [];
let sending = false;
let waitingForInternet = false;
let loaded = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
const listeners = new Set<(state: QueueState) => void>();
let onDone: Done = () => undefined;
let onFailed: Failed = () => undefined;

function publish() {
  const state = { items: [...items], sending, waitingForInternet };
  for (const l of listeners) l(state);
}

function save() {
  try {
    listFile.write(JSON.stringify(items));
  } catch {
    // The list stays in memory for this run.
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (listFile.exists) {
      const saved = JSON.parse(listFile.textSync()) as QueuedPhoto[];
      items = saved.filter((it) => new File(it.uri).exists);
    }
  } catch {
    items = [];
  }
}

export function subscribe(listener: (state: QueueState) => void): () => void {
  load();
  listeners.add(listener);
  listener({ items: [...items], sending, waitingForInternet });
  return () => listeners.delete(listener);
}

export function setHandlers(done: Done, failed: Failed) {
  onDone = done;
  onFailed = failed;
}

/** Products with photos still to send: their numbers are used, whatever the server has yet. */
export function pendingGarmentIds(): string[] {
  load();
  return [...new Set(items.map((it) => it.garmentId))];
}

export function pendingCount(): number {
  load();
  return items.length;
}

/** Keep the photo and queue it; returns at once. */
export function enqueue(photo: api.LocalPhoto, meta: Omit<QueuedPhoto, "id" | "uri" | "mimeType" | "width" | "height" | "queuedAt">): QueuedPhoto {
  load();
  const id = api.newKey();
  let uri = photo.uri;
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const kept = new File(dir, `${id}.${/png/i.test(photo.mimeType ?? "") ? "png" : "jpg"}`);
    new File(photo.uri).copy(kept);
    uri = kept.uri;
  } catch {
    // Could not copy: send from where the camera left it.
  }
  // A newer photo for the same slot replaces one still waiting.
  // (Not the one already going up: it lands first and this one replaces it.)
  const replaced = items.filter((it, i) => it.garmentId === meta.garmentId && it.slot === meta.slot && !(i === 0 && sending));
  items = items.filter((it) => !replaced.includes(it));
  for (const old of replaced) removeFile(old.uri);
  const item: QueuedPhoto = { ...meta, id, uri, sourceUri: photo.uri, mimeType: photo.mimeType ?? "image/jpeg", width: photo.width, height: photo.height, queuedAt: new Date().toISOString() };
  items.push(item);
  save();
  publish();
  kick();
  return item;
}

/** Start (or restart) sending: on app start, after sign-in, when the network may be back. */
export function kick() {
  load();
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  void run();
}

function removeFile(uri: string) {
  try {
    if (uri.includes("tantu-uploads")) new File(uri).delete();
  } catch {
    // Left in the app's folder; harmless.
  }
}

/**
 * The edit burned into the photo, at full resolution and the highest JPEG
 * quality (28 Sep: what the edit screen shows is what is saved). Crop, turns
 * and straighten are done here in one pass; brightness, which the phone has
 * no tool for, goes to the server with the photo. Done once, before the first
 * try, and kept in the app's folder, so a retry sends the same file.
 */
async function bakeEdit(item: QueuedPhoto): Promise<void> {
  const e = item.edit;
  if (!e || !(e.quarter || e.angle || e.crop)) return;
  const { canvas, cut } = editRect(item.width, item.height, e);
  const source = readable(item);
  // Turned first and measured (the phone's canvas can differ from the arithmetic),
  // then cut from that same image in memory: one save, at the highest quality.
  const turned = await (e.quarter || e.angle ? ImageManipulator.manipulate(source).rotate((e.quarter ?? 0) + (e.angle ?? 0)) : ImageManipulator.manipulate(source)).renderAsync();
  const sx = turned.width / canvas.width;
  const sy = turned.height / canvas.height;
  const originX = Math.min(Math.max(0, Math.round(cut.left * sx)), turned.width - 2);
  const originY = Math.min(Math.max(0, Math.round(cut.top * sy)), turned.height - 2);
  const width = Math.max(1, Math.min(Math.round(cut.width * sx), turned.width - originX));
  const height = Math.max(1, Math.min(Math.round(cut.height * sy), turned.height - originY));
  const final = e.crop || e.angle ? await ImageManipulator.manipulate(turned).crop({ originX, originY, width, height }).renderAsync() : turned;
  const rendered = await final.saveAsync({ compress: 1, format: SaveFormat.JPEG });
  let uri = rendered.uri;
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const kept = new File(dir, `${item.id}-edited.jpg`);
    new File(rendered.uri).copy(kept);
    uri = kept.uri;
  } catch {
    // Sent from the render's own place.
  }
  removeFile(item.uri);
  items = items.map((it) =>
    it.id === item.id
      ? { ...it, uri, sourceUri: rendered.uri, width: rendered.width, height: rendered.height, mimeType: "image/jpeg", edit: e.brightness ? { brightness: e.brightness } : null }
      : it,
  );
  save();
}

/** The photo's file for the image tool: the camera's (or the edit's) own copy while it is there. */
function readable(item: QueuedPhoto): string {
  try {
    if (item.sourceUri && new File(item.sourceUri).exists) return item.sourceUri;
  } catch {
    // Fall through to the kept copy.
  }
  return item.uri;
}

/** The 1600 px screen copy of the photo as it will be saved. */
async function makePreview(item: QueuedPhoto): Promise<string | null> {
  try {
    const context = ImageManipulator.manipulate(readable(item));
    if (Math.max(item.width, item.height) > 1600) context.resize(item.width >= item.height ? { width: 1600 } : { height: 1600 });
    const saved = await (await context.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return null;
  }
}

async function run() {
  if (sending || items.length === 0) return;
  sending = true;
  publish();
  while (items.length) {
    let item = items[0]!;
    try {
      try {
        await bakeEdit(item);
      } catch (problem) {
        throw new api.ApiError(`The edit could not be applied to this photo (${problem instanceof Error ? problem.message : "unknown"}).`, 422);
      }
      item = items[0]!;
      const previewUri = await makePreview(item);
      const result = await api.uploadPart(
        { uri: item.uri, width: item.width, height: item.height, mimeType: item.mimeType },
        item.slot,
        item.garmentId,
        item.type,
        previewUri,
        item.edit?.brightness ?? 0,
      );
      if (previewUri) removeFile(previewUri);
      failures = 0;
      waitingForInternet = false;
      items = items.filter((it) => it.id !== item.id);
      save();
      removeFile(item.uri);
      publish();
      onDone(item, result);
    } catch (problem) {
      const status = problem instanceof api.ApiError ? problem.status : 0;
      const message = problem instanceof Error ? problem.message : "The photo could not be sent.";
      // 0: no internet. 5xx / 408 / 429: the server, for now. Both: wait and try again.
      if (status === 0 || status >= 500 || status === 408 || status === 429 || status === 401) {
        failures++;
        waitingForInternet = status === 0;
        sending = false;
        publish();
        const wait = Math.min(60_000, 3000 * 2 ** Math.min(failures - 1, 4));
        timer = setTimeout(() => void run(), wait);
        return;
      }
      // Refused for good (unreadable photo, product deleted): drop it and say so.
      items = items.filter((it) => it.id !== item.id);
      save();
      removeFile(item.uri);
      publish();
      onFailed(item, message);
    }
  }
  sending = false;
  waitingForInternet = false;
  publish();
}
