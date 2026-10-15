/**
 * Encodes text as Windows-1252 ("ANSI"), the encoding the SUNAT PLE program reads.
 * Characters outside Latin-1 are replaced with "?" so the file never contains invalid bytes.
 */
export function encodeWindows1252(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  let length = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0x3f;
    bytes[length++] = code <= 0xff ? code : 0x3f;
  }
  return bytes.slice(0, length);
}
