// Supabase auth-js needs secure randomness, SHA-256 and UTF-8 before creating
// its client. Native runtimes need only these missing WebCrypto operations;
// browsers and existing implementations remain untouched.
import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

class Utf8Encoder implements TextEncoder {
  readonly encoding = 'utf-8';
  encode(input = ''): Uint8Array<ArrayBuffer> {
    const bytes: number[] = [];
    for (const char of String(input)) {
      let cp = char.codePointAt(0)!;
      if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
      if (cp < 0x80) bytes.push(cp);
      else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return new Uint8Array(bytes);
  }
  encodeInto(input: string, destination: Uint8Array): TextEncoderEncodeIntoResult {
    let read = 0, written = 0;
    for (const char of String(input)) {
      const bytes = this.encode(char);
      if (written + bytes.length > destination.length) break;
      destination.set(bytes, written);
      read += char.length;
      written += bytes.length;
    }
    return { read, written };
  }
}

if (Platform.OS !== 'web') {
  if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = Utf8Encoder;
  if (typeof globalThis.crypto === 'undefined') {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true });
  }
  const crypto = globalThis.crypto;
  crypto.getRandomValues ??= <T extends ArrayBufferView | null>(array: T): T => {
    if (!(array instanceof Int8Array || array instanceof Uint8Array || array instanceof Uint8ClampedArray
      || array instanceof Int16Array || array instanceof Uint16Array || array instanceof Int32Array || array instanceof Uint32Array)) {
      throw new TypeError('Secure random values require an integer typed array');
    }
    if (array.byteLength > 65536) throw new RangeError('Secure random request exceeds 65536 bytes');
    ExpoCrypto.getRandomValues(array);
    return array;
  };
  if (!crypto.subtle) Object.defineProperty(crypto, 'subtle', { value: {}, configurable: true });
  crypto.subtle.digest ??= async (algorithm, data) => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
    if (name.toUpperCase() !== 'SHA-256') throw new Error('Native PKCE supports SHA-256 only');
    return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
  };
}
