/** Turkish labels for the engine's missing-fact kinds. The UI is Turkish; the
 *  engine stays language neutral by returning kinds rather than prose. */
export const MISSING_LABEL: Record<string, string> = {
  service_bulletin: "servis bülteni",
  installed_part: "takılı parça",
  referenced_table: "atıf yapılan tablo",
  referenced_paragraph: "atıf yapılan paragraf",
  modification_state: "modifikasyon durumu",
};

export function missingLabel(kind: string): string {
  return MISSING_LABEL[kind] ?? kind.replace(/_/g, " ");
}
