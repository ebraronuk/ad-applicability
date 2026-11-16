/**
 * An aircraft as the FAA Releasable Aircraft Database describes it.
 *
 * Only the fields the registry actually publishes are modelled. Anything an
 * applicability clause asks for that is not here (installed part numbers,
 * incorporated service bulletins, modification state) is absent by design, and
 * the evaluator reports it as a missing fact rather than assuming a value.
 *
 * Source: https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download/
 */
export interface Aircraft {
  /** Registration mark without the country prefix, e.g. "12345" for N12345. */
  readonly nNumber: string;
  /** Manufacturer name as the registry spells it, e.g. "BOEING". */
  readonly manufacturer: string;
  /** Model designation as the registry spells it, e.g. "787-9". */
  readonly model: string;
  readonly serialNumber: string;
  /** ICAO type designator when the registry carries one. */
  readonly typeDesignator?: string;
}

/** A named set of aircraft to evaluate a directive against. */
export interface Fleet {
  readonly name: string;
  readonly aircraft: readonly Aircraft[];
}

/**
 * Registry spellings and directive spellings disagree in predictable ways:
 * the registry writes "BOEING" where a directive writes "The Boeing Company",
 * and model case and spacing vary. Normalising both sides through one function
 * keeps the comparison in a single place, so a mismatch is a bug in one
 * function rather than scattered across the evaluator.
 */
export function normalizeDesignation(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s‐-―]+/g, " ")
    .replace(/[.,]/g, "")
    .trim();
}

const MANUFACTURER_NOISE =
  /\b(THE|COMPANY|CO|CORPORATION|CORP|INCORPORATED|INC|LIMITED|LTD|LLC|GMBH|SAS|SA|AG|NV|BV|PLC|AIRPLANES|HELICOPTERS|AVIATION|AIRCRAFT)\b/g;

/**
 * Compare a directive's manufacturer wording against a registry record.
 * Reduced to the significant tokens on both sides: "The Boeing Company" and
 * "BOEING" agree, while "Airbus" and "Boeing" do not.
 */
export function manufacturerMatches(directiveWording: string, registryValue: string): boolean {
  const reduce = (value: string): string =>
    normalizeDesignation(value).replace(MANUFACTURER_NOISE, " ").replace(/\s+/g, " ").trim();
  const fromDirective = reduce(directiveWording);
  const fromRegistry = reduce(registryValue);
  if (!fromDirective || !fromRegistry) return false;
  return fromDirective.includes(fromRegistry) || fromRegistry.includes(fromDirective);
}

export function modelMatches(directiveModel: string, registryModel: string): boolean {
  return normalizeDesignation(directiveModel) === normalizeDesignation(registryModel);
}
