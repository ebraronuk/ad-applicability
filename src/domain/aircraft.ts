/**
 * An aircraft as a registry publishes it.
 *
 * Only published fields are modelled. Installed parts, incorporated service
 * bulletins and modification state are absent on purpose: the evaluator reports
 * them as missing facts rather than assuming values it does not have.
 */
export interface Aircraft {
  /** Registration mark, e.g. "N798BC". */
  readonly nNumber: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly serialNumber: string;
  /** ICAO type designator, where the registry carries one. */
  readonly typeDesignator?: string;
}

export interface Fleet {
  readonly name: string;
  readonly aircraft: readonly Aircraft[];
}

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
 * Registries and directives disagree predictably: "BOEING" against "The Boeing
 * Company". Both sides reduce to significant tokens, so a mismatch is a bug in
 * one function rather than scattered across the evaluator.
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
