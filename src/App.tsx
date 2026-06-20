import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';
import { InstallPrompt } from '@/shared/ui';

// Router created at module level — stable reference, recreated only on full reload.
// After adding new routes during dev, do a hard refresh (Cmd+Shift+R).
const router = createBrowserRouter(routes);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <InstallPrompt />
    </>
  );
}
