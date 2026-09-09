import type { Metadata } from "next";
import { ProductLookup } from "@/components/product/ProductLookup";

export const metadata: Metadata = {
  title: "Find a product",
  robots: { index: false, follow: false },
};

export default function ProductPage() {
  return <ProductLookup />;
}
