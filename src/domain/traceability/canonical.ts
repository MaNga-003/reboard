// Kanonik JSON (RFC 8785 JCS'nin alt kümesi). Anahtarlar UTF-16 sırasıyla dizilir, boşluk yazılmaz.
// Kesirli sayı kabul edilmez: kg gibi ondalık değerler sabit ölçekli metin olarak taşınır ("1250.000").
// Böylece olay jsonb'ye yazılıp geri okunduğunda da aynı metin, dolayısıyla aynı hash çıkar.
import { Decimal } from "../result";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };

export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isSafeInteger(value)) throw new CanonicalJsonError(`Yalnızca güvenli tamsayı yazılır, ondalık metin olmalı: ${value}`);
      return String(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value
          .map((v) => {
            if (v === undefined) throw new CanonicalJsonError("Dizide undefined olamaz");
            return canonicalJson(v);
          })
          .join(",")}]`;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) throw new CanonicalJsonError("Yalnızca düz nesne yazılır (Date, Decimal önce metne çevrilir)");
      const obj = value as Record<string, unknown>;
      // undefined alanlar jsonb'de de kaybolur; hash'e girmez.
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
    }
    default:
      throw new CanonicalJsonError(`Desteklenmeyen tür: ${typeof value}`);
  }
}

/** kg değerini numeric(14,3) ile aynı ölçekte metne çevirir. */
export const kgText = (v: Decimal.Value) => new Decimal(v).toFixed(3);
