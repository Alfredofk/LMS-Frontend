import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { localOf } from '../views/Attendance/attendance';

/*
  The school's zone (WIB/WITA/WIT) and its date today, 'YYYY-MM-DD' - what the
  server's `todayOf` reads a day against. The membership cached from sign-in is
  the thin one, without `school`, so /users/me is read once to learn the zone;
  until it answers (or with no zone set) the zone is null and the device's own
  date stands in.

  `known` says whether the answer is in (or could not be had): a screen that
  turns instants into the school's clock waits for it, rather than drawing the
  device's clock and then jumping.
*/
export function useSchoolZoneState() {
  const { membership, refreshMe } = useAuth();
  const thin = Boolean(membership) && !membership.school;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (thin) refreshMe().catch(() => setFailed(true));
  }, [thin, refreshMe]);

  return { zone: membership?.school?.timeZone ?? null, known: !thin || failed };
}

export const useSchoolZone = () => useSchoolZoneState().zone;

export function useSchoolToday() {
  const zone = useSchoolZone();
  return localOf(new Date(), zone)?.date ?? '';
}

export default useSchoolToday;
