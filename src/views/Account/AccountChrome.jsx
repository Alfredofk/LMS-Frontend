import React from 'react';
import { Outlet } from 'react-router-dom';

import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/AuthContext';

/*
  Which shell /account wears, decided by whether there is a role to build one
  from.

  The page has to serve two people who are in very different places. Somebody
  working as a Student is inside the app, and taking them out of the sidebar and
  navbar to change their own name reads as being signed out and sent back to the
  login screen — which is exactly what it looked like. Somebody who registered an
  hour ago and whose school is still PENDING has no role at all, so Sidebar has
  no menu to draw and MainLayout cannot be used for them.

  So neither shell can be the only one. MainLayout renders an <Outlet /> of its
  own and the route below is the same either way, so both branches land on the
  same page — once framed by the app, once standing alone.

  AccountPage reads the same `activeRole` to decide whether to bring its own
  heading and its own way back, since inside the shell the navbar and the
  sidebar already provide both.
*/
export const AccountChrome = () => {
  const { activeRole } = useAuth();
  return activeRole ? <MainLayout /> : <Outlet />;
};

export default AccountChrome;
