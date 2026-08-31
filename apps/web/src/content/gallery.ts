/**
 * The gallery is deliberately empty until real renders go in it.
 *
 * Drop files into `public/gallery/` and list them here. Every entry must be an
 * image this engine actually produced, from a garment we actually have — a
 * gallery of borrowed or invented pictures is a promise you cannot keep when a
 * buyer sends their own fabric.
 */

export interface GalleryItem {
  src: string;
  alt: string;
  design: string;
  pose: string;
  mode: "Product to Model" | "Mannequin to Model" | "Virtual Try-On";
  /** The reference photograph it was rendered from, if you want the wipe. */
  reference?: string;
}

export const GALLERY: GalleryItem[] = [];
