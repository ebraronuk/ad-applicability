/**
 * Serial comparison, defined only where an ordering actually exists.
 *
 * Registries hold "29000", "0450", "S-123", "MSN 41925" and "41925A". Number()
 * on those yields NaN or a wrong order, and a wrong order here clears an
 * aircraft that should be grounded. So comparison is defined only between
 * serials of the same recognised shape; everything else returns null and
 * surfaces as undetermined. Refusing to compare is the feature.
 */

interface ParsedSerial {
  readonly prefix: string;
  readonly value: number;
}

const PLAIN = /^(\d+)$/;
const PREFIXED = /^([A-Z][A-Z\s-]*?)[\s-]*(\d+)$/;

function parse(serial: string): ParsedSerial | null {
  const normalized = serial.trim().toUpperCase();

  const plain = PLAIN.exec(normalized);
  if (plain) return { prefix: "", value: Number(plain[1]) };

  const prefixed = PREFIXED.exec(normalized);
  if (prefixed) {
    return {
      prefix: prefixed[1]!.replace(/[\s-]+/g, ""),
      value: Number(prefixed[2]),
    };
  }

  // Not understood: dotted serials, block designations, embedded letters.
  return null;
}

/**
 * -1, 0 or 1 when comparable, null when not.
 *
 * Differing prefixes return null rather than an order: "S-100" and "T-100" are
 * different manufacturer blocks, so a directive naming one says nothing about
 * the other.
 */
export function compareSerial(left: string, right: string): -1 | 0 | 1 | null {
  const a = parse(left);
  const b = parse(right);
  if (!a || !b || a.prefix !== b.prefix) return null;
  if (a.value === b.value) return 0;
  return a.value < b.value ? -1 : 1;
}

export function isComparableSerial(serial: string): boolean {
  return parse(serial) !== null;
}
