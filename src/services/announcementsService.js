import { api } from './apiClient';

/*
  The school noticeboard.

  **No route and no table.** `Notification` is the nearest thing in the schema
  and it is not this: it is addressed to one membership, while an announcement is
  written once and read by everybody. See `docs/api-contract.md`.

  The screens read `author_name` and `created_at` in snake_case, which Prisma
  does not produce — one of the open naming questions.
*/
export const announcementsService = {
  list: () => api.get('/announcements'),

  create: ({ title, content }) => api.post('/announcements', { title, content }),

  remove: (id) => api.del(`/announcements/${id}`),

  /*
    Not an announcement at all, despite the path: it returns each class's task
    progress for the student dashboard. Its only caller, MyCoursesCatalog, is
    imported by nothing — so this stays until somebody decides whether that
    screen is coming back, and the endpoint probably belongs elsewhere.
  */
  studentDashboardWidgets: () => api.get('/announcements/student/dashboard-widgets'),
};

export default announcementsService;
