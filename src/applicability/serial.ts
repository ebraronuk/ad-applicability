/**
 * Serial-number comparison.
 *
 * This is the part of the problem that looks trivial and is not. Directives
 * write ranges like "serial numbers 29000 through 30500 inclusive", but the
 * registry holds serials such as "29000", "0450", "S-123", "MSN 41925" and
 * "61-0001". A naive `Number()` on those silently produces NaN or reorders
 * them, and a silently wrong ordering in a compliance tool means an aircraft is
 * cleared when it should be grounded.
 *
 * So comparison is only defined between serials of the SAME recognised shape,
 * and everything else returns null, which the evaluator turns into
 * "undetermined" rather than into a guess. Refusing to compare is a feature.
 */

interface ParsedSerial {
  /** Non-numeric lead-in, normalised. Empty for a plain number. */
  readonly prefix: string;
  readonly value: number;
  /** Digit count as written, so "0450" and "450" are distinguishable if ever needed. */
  readonly width: number;
}

const PLAIN = /^(\d+)$/;
const PREFIXED = /^([A-Z][A-Z\s-]*?)[\s-]*(\d+)$/;

function parse(serial: string): ParsedSerial | null {
  const normalized = serial.trim().toUpperCase();
  if (!normalized) return null;

  const plain = PLAIN.exec(normalized);
  if (plain) {
    const digits = plain[1]!;
    return { prefix: "", value: Number(digits), width: digits.length };
  }

  const prefixed = PREFIXED.exec(normalized);
  if (prefixed) {
    const digits = prefixed[2]!;
    return {
      prefix: prefixed[1]!.replace(/[\s-]+/g, ""),
      value: Number(digits),
      width: digits.length,
    };
  }

  // Shapes this function does not claim to understand: dotted serials,
  // block designations, anything with an embedded letter such as "41925A".
  return null;
}

/**
 * -1, 0 or 1 when the two serials are comparable, and null when they are not.
 *
 * Null is returned both for unparseable input and for serials whose prefixes
 * differ, because "S-100" and "T-100" have no defined order: they belong to
 * different manufacturer blocks and the directive that mentions one says
 * nothing about the other.
 */
export function compareSerial(left: string, right: string): -1 | 0 | 1 | null {
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  if (a.prefix !== b.prefix) return null;
  if (a.value === b.value) return 0;
  return a.value < b.value ? -1 : 1;
}

/** Whether a serial has a shape this module can order at all. */
export function isComparableSerial(serial: string): boolean {
  return parse(serial) !== null;
}
