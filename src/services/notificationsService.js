import { api } from './apiClient';

/*
  The bell in the navbar.

  **The table already exists** — `Notification` in `schema.prisma`, with
  `recipientMembershipId`, `type`, `title`, `body` and `readAt`. Only the router
  is missing, which makes this one of the two cheapest domains to build first
  (the other is classes).

  Two mismatches to settle while writing it, both in `docs/api-contract.md`:
  the column is `body` but the screen reads `message`, and `readAt` is a
  timestamp while the screen reads a boolean `isRead`.

  **This list is polled every ten seconds** (`Navbar.jsx:121`). Today that is six
  silent 404s a minute, forever, seen by nobody. Worth knowing before choosing
  how expensive the query is allowed to be.
*/
export const notificationsService = {
  list: () => api.get('/notifications'),

  markRead: (id) => api.put(`/notifications/${id}/read`),

  markAllRead: () => api.put('/notifications/read-all'),

  remove: (id) => api.del(`/notifications/${id}`),
};

export default notificationsService;
