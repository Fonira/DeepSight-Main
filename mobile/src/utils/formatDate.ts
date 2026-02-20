/**
 * Formats a date string as a relative date in French.
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 1) return "\u00C0 l'instant";
  if (diffHour < 1) return `Il y a ${diffMin}min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  if (diffHour < 48) return 'Hier';

  const day = date.getDate();
  const months = [
    'jan', 'f\u00E9v', 'mar', 'avr', 'mai', 'jun',
    'jul', 'ao\u00FB', 'sep', 'oct', 'nov', 'd\u00E9c',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}
