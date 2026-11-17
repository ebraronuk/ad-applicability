/**
 * The committed reference data, read once and typed once.
 *
 * Imported as JSON rather than read from disk so that the same module works
 * under the test runner and inside a server bundle, with no dependency on the
 * process working directory.
 */
import rawCorpus from "../data/corpus/ads.json";
import rawFleet from "../data/fleet/sample-fleet.json";
import type { Aircraft, Fleet } from "./domain/aircraft";
import type { Directive } from "./domain/directive";

export const directives: readonly Directive[] = rawCorpus;

// The registry snapshot stores an absent type designator as null, which is not
// the same thing as the field being optional. Normalised here so no consumer
// has to decide what null means.
const aircraft: readonly Aircraft[] = rawFleet.aircraft.map((entry) => {
  const registered = {
    nNumber: entry.nNumber,
    manufacturer: entry.manufacturer,
    model: entry.model,
    serialNumber: entry.serialNumber,
  };
  const designator: string | null | undefined = entry.typeDesignator;
  return designator ? { ...registered, typeDesignator: designator } : registered;
});

export const fleet: Fleet & { readonly source: string; readonly licence: string } = {
  name: rawFleet.name,
  source: rawFleet.source,
  licence: rawFleet.licence,
  aircraft,
};

export function findDirective(documentNumber: string): Directive | undefined {
  return directives.find((directive) => directive.documentNumber === documentNumber);
}

/** Newest first, which is the order anyone reading a directive list wants. */
export function byPublicationDateDescending(): readonly Directive[] {
  return [...directives].sort((a, b) => b.publicationDate.localeCompare(a.publicationDate));
}
