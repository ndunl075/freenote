import { db } from "./database";
import { newId } from "@/lib/utils/id";
import type { ID, StoredBlob } from "./types";

/** Images and audio live in their own table so note records stay small and
 *  cheap to read on every keystroke. */
export const blobs = {
  async put(blob: Blob): Promise<ID> {
    const id = newId("blob");
    await db().blobs.put({
      id,
      blob,
      mime: blob.type,
      size: blob.size,
      createdAt: Date.now(),
    });
    return id;
  },

  get(id: ID): Promise<StoredBlob | undefined> {
    return db().blobs.get(id);
  },

  async url(id: ID): Promise<string | null> {
    const rec = await db().blobs.get(id);
    return rec ? URL.createObjectURL(rec.blob) : null;
  },

  async remove(id: ID): Promise<void> {
    await db().blobs.delete(id);
  },

  /** Drop blobs no record points at any more. Called after bulk deletes. */
  async collectGarbage(): Promise<number> {
    const d = db();
    const referenced = new Set<ID>();

    for (const page of await d.pages.toArray()) {
      for (const obj of page.objects) {
        if (obj.kind === "image") referenced.add(obj.blobId);
      }
    }
    for (const rec of await d.recordings.toArray()) referenced.add(rec.blobId);
    for (const term of await d.terms.toArray()) {
      if (term.imageBlobId) referenced.add(term.imageBlobId);
    }

    const orphans = (await d.blobs.toCollection().primaryKeys()).filter(
      (id) => !referenced.has(id),
    );
    if (orphans.length) await d.blobs.bulkDelete(orphans);
    return orphans.length;
  },
};
