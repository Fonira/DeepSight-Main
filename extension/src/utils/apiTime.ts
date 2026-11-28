/**
 * Horodatages renvoyés par l'API DeepSight.
 *
 * Les colonnes `DateTime` du backend sont sans fuseau et remplies en UTC
 * (`func.now()`) : Pydantic les sérialise donc sans suffixe, par exemple
 * « 2026-11-28T08:00:00.123456 ». Or `Date.parse` lit une date-heure ISO
 * sans décalage en heure LOCALE, ce qui décalerait chaque message du fuseau
 * de l'utilisateur (dans le futur à l'ouest de l'UTC). On lit donc une
 * chaîne sans décalage comme de l'UTC ; une chaîne avec `Z` ou `±hh:mm`
 * est lue telle quelle.
 */
export function parseApiTimestamp(raw: string | null | undefined): number {
  if (!raw) return NaN;
  const hasOffset = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  return Date.parse(hasOffset ? raw : `${raw}Z`);
}
