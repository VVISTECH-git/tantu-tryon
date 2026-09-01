"use client";

import { slotsFor, garment as garmentDef, SLOTS } from "@tantu/engine/catalog";
import type { GarmentId, RenderMode, SlotId } from "@tantu/engine/catalog";
import { Dropzone } from "@/components/Dropzone";
import type { LoadedImage } from "@/lib/image";

export interface RefImage extends LoadedImage {
  id: string;
  slot: SlotId;
}

/**
 * The photographs, given the room they deserve.
 *
 * Loading labelled reference shots is the actual job in this application, and
 * it used to happen in 96px tiles inside a 440px rail while a thousand pixels
 * of canvas showed a paragraph of marketing copy. It now owns the canvas until
 * there are renders to look at.
 */
export function ReferenceBoard({
  garment,
  mode,
  refs,
  person,
  onSet,
  onAddMany,
  onReassign,
  onReplace,
  onRemove,
  onSetPerson,
}: {
  garment: GarmentId;
  mode: RenderMode;
  refs: RefImage[];
  person: LoadedImage | null;
  onSet: (slot: SlotId, image: LoadedImage) => void;
  onAddMany: (images: LoadedImage[]) => void;
  onReassign: (id: string, slot: SlotId) => void;
  onReplace: (id: string, image: LoadedImage) => void;
  onRemove: (id: string) => void;
  onSetPerson: (image: LoadedImage | null) => void;
}) {
  const recommended = new Set(garmentDef(garment).recommendedSlots);
  const named = slotsFor(garment).filter((s) => s.id !== "extra" && s.id !== "mannequin");
  const extras = refs.filter((ref) => ref.slot === "extra");
  const options = [...named, ...SLOTS.filter((s) => s.id === "extra")];
  const find = (slot: SlotId) => refs.find((ref) => ref.slot === slot);

  const labelSelect = (ref: RefImage) => (
    <div className="mt-2">
      <label className="sr-only" htmlFor={`slot-${ref.id}`}>
        What this photograph shows
      </label>
      <select
        id={`slot-${ref.id}`}
        value={ref.slot}
        onChange={(event) => onReassign(ref.id, event.target.value as SlotId)}
        className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink outline-none transition focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="display text-[22px]">Reference photographs</h2>
        <p className="text-[14px] text-ink-soft">
          {refs.length === 0
            ? "Drop all of them at once — you can label them afterwards."
            : `${refs.length} loaded. Change any label below the photograph.`}
        </p>
      </div>

      {mode === "mannequin" && (
        <div className="mb-6 max-w-64">
          <Dropzone
            label="On a mannequin"
            hint="Head to hem, draped as it should sell."
            required
            value={find("mannequin")}
            onPick={(image) => onSet("mannequin", image)}
            onClear={() => {
              const existing = find("mannequin");
              if (existing) onRemove(existing.id);
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {named.map((slot) => {
          const existing = find(slot.id);
          return (
            <div key={slot.id}>
              <Dropzone
                label={slot.label}
                hint={slot.hint}
                value={existing}
                recommended={recommended.has(slot.id) && !existing}
                onPick={(image) => onSet(slot.id, image)}
                onPickMany={onAddMany}
                onClear={existing ? () => onRemove(existing.id) : undefined}
                footer={existing ? labelSelect(existing) : undefined}
              />
            </div>
          );
        })}

        {extras.map((extra) => (
          <div key={extra.id}>
            <Dropzone
              label="Extra"
              value={extra}
              onPick={(image) => onReplace(extra.id, image)}
              onClear={() => onRemove(extra.id)}
              footer={labelSelect(extra)}
            />
          </div>
        ))}

        <div>
          <Dropzone
            label="Add more"
            hint="Several at once is fine."
            onPick={(image) => onAddMany([image])}
            onPickMany={onAddMany}
          />
        </div>
      </div>

      {mode === "person" && (
        <div className="mt-8 border-t border-line pt-6">
          <h3 className="text-[15px] font-medium">The person wearing it</h3>
          <p className="mt-1 text-[14px] text-ink-soft">
            Their face, build and skin tone are preserved; only the clothing changes.
          </p>
          <div className="mt-4 max-w-64">
            <Dropzone
              label="Person"
              required
              value={person ?? undefined}
              onPick={onSetPerson}
              onClear={() => onSetPerson(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
