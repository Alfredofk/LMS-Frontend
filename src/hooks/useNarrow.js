import { useSyncExternalStore } from 'react';

/*
  Whether the screen is phone-width (below Tailwind's `sm`, 640px) - for words a
  narrow box cannot hold, where CSS alone cannot pick the text: a <select>'s
  option. Follows the window as it is resized or turned.
*/
const QUERY = '(max-width: 639px)';

const subscribe = (onChange) => {
  const list = window.matchMedia?.(QUERY);
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
};

const isNarrow = () => Boolean(window.matchMedia?.(QUERY).matches);

export const useNarrow = () => useSyncExternalStore(subscribe, isNarrow, () => false);

export default useNarrow;
