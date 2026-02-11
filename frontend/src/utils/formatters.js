export function formatRefereeName(referee) {
  if (!referee) return 'Unassigned';
  return `${referee.last_name}, ${referee.first_name}`;
}

export function formatFencerName(fencer) {
  if (!fencer) return '';
  return `${fencer.last_name}, ${fencer.first_name}`;
}

const EVENT_SHORT_MAP = {
  'cadet men saber': 'CMS',
  'y-14 women foil': 'YWF',
};

export function formatEventShort(event) {
  if (!event) return '';
  const key = event.toLowerCase();
  return EVENT_SHORT_MAP[key] || event;
}

export function formatStripNumber(strip) {
  if (!strip) return '—';
  return `Strip ${strip}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}
