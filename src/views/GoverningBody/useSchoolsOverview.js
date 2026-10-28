import { useCallback, useEffect, useState } from 'react';

import { governingBodyService } from '../../services/governingBodyService';

/*
  The reads behind the top of a Governing Body's home (owner 2026-10-26, 1-8): the
  Schools, the requests to join and the admins, at once. Only the Schools failing fails
  the summary; either side read failing only leaves its "Perlu perhatian" row out
  (null, never counted as none). Shared by the stat cards and "Perlu perhatian", which
  sit apart on the page since 2026-10-27.

  `read` is null while reading; `failed` true when the Schools could not be read.
*/
export function useSchoolsOverview() {
  const [read, setRead] = useState(null);
  const [failed, setFailed] = useState(false);

  const fetchAll = useCallback(
    () =>
      Promise.allSettled([governingBodyService.schools(), governingBodyService.affiliationRequests(), governingBodyService.admins()]).then(([schools, requests, admins]) => {
        if (schools.status !== 'fulfilled') {
          setFailed(true);
          return;
        }
        setRead({
          schools: schools.value,
          affiliationRequests: requests.status === 'fulfilled' ? requests.value : null,
          admins: admins.status === 'fulfilled' ? admins.value : null,
        });
      }),
    []
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const retry = useCallback(() => {
    setFailed(false);
    setRead(null);
    fetchAll();
  }, [fetchAll]);

  return { read, failed, retry };
}

export default useSchoolsOverview;
