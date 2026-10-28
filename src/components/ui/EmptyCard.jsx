import React from 'react';

import { HomeEmpty } from '../../views/Dashboard/components/HomeCard';

/*
  An empty state standing on its own (Subjects, Members) (owner, 2026-10-28): a
  white card holding the dashboards' empty state, where a dashed box stood.
*/
export const EmptyCard = ({ icon, title, body, action }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm">
    <HomeEmpty icon={icon} title={title} body={body} action={action} />
  </div>
);

export default EmptyCard;
