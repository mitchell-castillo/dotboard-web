export const CARD_TIMEZONE = 'America/Santo_Domingo';
export const CARD_TIMEZONE_LABEL = 'Hora de Rep. Dominicana';
const fullDate = new Intl.DateTimeFormat('es-DO', {
  timeZone: CARD_TIMEZONE, dateStyle: 'medium', timeStyle: 'short',
});
const shortDate = new Intl.DateTimeFormat('es-DO', {
  timeZone: CARD_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric',
});

// Never infer an original creation date from edits, comments or a trigger schedule.
export function cardCreationDate(createdAt: unknown) {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return { iso: date.toISOString(), full: fullDate.format(date), short: shortDate.format(date) };
}
