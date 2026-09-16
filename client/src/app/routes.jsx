import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTH_ROUTES, LEGACY_ROUTES, ROUTES } from '@/constants';
import { Shell } from './Shell';
import { HomePage } from '@/pages/HomePage';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

/**
 * The sitemap's six pages, one route each.
 *
 * Home is imported eagerly because it is the first paint for almost every
 * visitor; the other five are split so a parent who lands on the homepage does
 * not download the admissions FAQ to get there.
 */
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const AcademicsPage = lazy(() =>
  import('@/pages/AcademicsPage').then((m) => ({ default: m.AcademicsPage })),
);
const StudentLifePage = lazy(() =>
  import('@/pages/StudentLifePage').then((m) => ({ default: m.StudentLifePage })),
);
/* The gallery is three routes in one chunk each: the landing page is heavy
   with photography and choreography, and a parent reading an event page has
   no reason to download the landing page's category explorer. */
const GalleryPage = lazy(() =>
  import('@/pages/GalleryPage').then((m) => ({ default: m.GalleryPage })),
);
const GalleryYearPage = lazy(() =>
  import('@/pages/GalleryYearPage').then((m) => ({ default: m.GalleryYearPage })),
);
const GalleryEventPage = lazy(() =>
  import('@/pages/GalleryEventPage').then((m) => ({ default: m.GalleryEventPage })),
);
const AdmissionsPage = lazy(() =>
  import('@/pages/AdmissionsPage').then((m) => ({ default: m.AdmissionsPage })),
);
const ContactPage = lazy(() =>
  import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));

/* The admin console. Split from the public site entirely: a parent never
   downloads a byte of it, and the console never loads the site's scroll
   choreography. */
const ConsoleLayout = lazy(() =>
  import('@/components/console/ConsoleLayout').then((m) => ({ default: m.ConsoleLayout })),
);
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const KnowledgeBasesPage = lazy(() =>
  import('@/pages/console/KnowledgeBasesPage').then((m) => ({ default: m.KnowledgeBasesPage })),
);
const KnowledgeBaseLayout = lazy(() =>
  import('@/pages/console/KnowledgeBaseLayout').then((m) => ({ default: m.KnowledgeBaseLayout })),
);
const OverviewPage = lazy(() =>
  import('@/pages/console/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const DocumentsPage = lazy(() =>
  import('@/pages/console/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const DocumentPage = lazy(() =>
  import('@/pages/console/DocumentPage').then((m) => ({ default: m.DocumentPage })),
);
const SourcesPage = lazy(() =>
  import('@/pages/console/SourcesPage').then((m) => ({ default: m.SourcesPage })),
);
const ProcessingPage = lazy(() =>
  import('@/pages/console/ProcessingPage').then((m) => ({ default: m.ProcessingPage })),
);
const TestRagPage = lazy(() =>
  import('@/pages/console/TestRagPage').then((m) => ({ default: m.TestRagPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/console/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

export const routes = [
  {
    path: ROUTES.home,
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.about.slice(1), element: <AboutPage /> },
      { path: ROUTES.academics.slice(1), element: <AcademicsPage /> },
      { path: ROUTES.studentLife.slice(1), element: <StudentLifePage /> },
      { path: ROUTES.gallery.slice(1), element: <GalleryPage /> },
      { path: `${ROUTES.gallery.slice(1)}/:yearId`, element: <GalleryYearPage /> },
      { path: `${ROUTES.gallery.slice(1)}/:yearId/:eventId`, element: <GalleryEventPage /> },
      { path: ROUTES.admissions.slice(1), element: <AdmissionsPage /> },
      { path: ROUTES.contact.slice(1), element: <ContactPage /> },

      /* The previous architecture's paths. A parent's bookmark or a link in a
         printed prospectus outlives a sitemap revision, so these resolve
         rather than 404 — `replace` so the old path does not sit in history
         and send the back button into a redirect loop. */
      ...LEGACY_ROUTES.map(({ from, to }) => ({
        path: from.slice(1),
        element: <Navigate to={to} replace />,
      })),

      { path: '*', element: <NotFoundPage /> },
    ],
  },

  /* Sign-in and the console behind it, outside the marketing Shell.
     AuthLayout is the only place the session is checked, so the six public
     pages never make an auth request. Login only: there is no registration
     route. */
  {
    element: <AuthLayout />,
    children: [
      { path: AUTH_ROUTES.login, element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: AUTH_ROUTES.dashboard,
            element: <ConsoleLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'knowledge-base', element: <KnowledgeBasesPage /> },
              {
                path: 'knowledge-base/:knowledgeBaseId',
                element: <KnowledgeBaseLayout />,
                children: [
                  { index: true, element: <OverviewPage /> },
                  { path: 'documents', element: <DocumentsPage /> },
                  { path: 'documents/:documentId', element: <DocumentPage /> },
                  { path: 'sources', element: <SourcesPage /> },
                  { path: 'processing', element: <ProcessingPage /> },
                  { path: 'test', element: <TestRagPage /> },
                  { path: 'settings', element: <SettingsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
