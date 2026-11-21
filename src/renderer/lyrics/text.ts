const RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;
const LTR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ一-鿿가-힯]/;

/** True when the first strong-direction character is Arabic/Hebrew. */
export function isRtl(text: string): boolean {
  for (const ch of text) {
    if (RTL.test(ch)) return true;
    if (LTR.test(ch)) return false;
  }
  return false;
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
