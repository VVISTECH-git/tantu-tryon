import { describe, expect, it } from "vitest";
import { parsePricing } from "./imageModels";

/** A cut-down copy of Google's pricing page text, in the shape the parser reads. */
const PAGE = `<h2>Gemini 3.1 Flash Image</h2> gemini-3.1-flash-image Try it in Google AI Studio
Standard Free Tier Paid Tier Output price Not available $60.00 (images) Equivalent to $0.045 per 0.5K image * $0.067 per 1K image * , $0.101 per 2K image * , and $0.151 per 4K image * .
Batch Free Tier Paid Tier Equivalent to $0.022 per 0.5K image * $0.034 per 1K image * , $0.050 per 2K image *
<h2>Gemini 3.1 Flash Lite Image</h2> gemini-3.1-flash-lite-image Try it in Google AI Studio
Standard Equivalent to $0.0336 per 1K resolution image * Batch Free Tier Paid Tier Equivalent to $0.0168 per 1K resolution image *
<h2>Gemini 3 Pro Image</h2> gemini-3-pro-image Try it in Google AI Studio
Standard Equivalent to $0.134 per 1K/2K image ** and $0.24 per 4K image ** Batch Free Tier Paid Tier $0.067 per 1K/2K image ** $0.12 per 4K image ** Flex Free Tier Paid Tier $0.067 per 1K/2K image
<h2>Gemini 2.5 Flash Image</h2> gemini-2.5-flash-image Try it in Google AI Studio
Output price Not available $0.039 per image* Batch Free Tier Paid Tier Output price Not available $0.0195 per image* Flex Free Tier $0.0195 per image* Priority Free Tier $0.0702 per image*`;

describe("Google price page", () => {
  it("reads normal and batch prices for every image row", () => {
    const t = parsePricing(PAGE);
    expect(t["lite-1k"]).toEqual({ normal: 0.0336, batch: 0.0168 });
    expect(t["nb2-512"]).toEqual({ normal: 0.045, batch: 0.022 });
    expect(t["nb2-1k"]).toEqual({ normal: 0.067, batch: 0.034 });
    expect(t["nb2-2k"]).toEqual({ normal: 0.101, batch: 0.05 });
    expect(t["pro-1k"]).toEqual({ normal: 0.134, batch: 0.067 });
    expect(t["pro-2k"]).toEqual({ normal: 0.134, batch: 0.067 });
    expect(t["nb-2.5"]).toEqual({ normal: 0.039, batch: 0.0195 });
  });
});
