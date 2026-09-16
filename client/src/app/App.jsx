import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

/**
 * The site is six pages, not one document. Each page owns exactly one parent
 * question, in the order a parent asks them — discover the school, trust the
 * institution, evaluate the education, picture the experience, decide, act —
 * and never repeats another page's answer. See `routes.jsx` for the map.
 */
const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
