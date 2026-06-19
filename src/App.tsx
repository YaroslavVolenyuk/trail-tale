import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';
import { InstallPrompt } from '@/shared/ui';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <InstallPrompt />
    </>
  );
}
