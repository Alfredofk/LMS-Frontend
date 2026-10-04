/** Up to two initials for an avatar tile: "Kevin Aprilian" → "KA". */
export const initialsOf = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Lower-cased and trimmed, for matching a search box against a name or a number. */
export const foldText = (value) => String(value ?? '').trim().toLocaleLowerCase();
