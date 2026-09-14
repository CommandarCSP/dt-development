import { createBrowserRouter, RouterProvider } from 'react-router-dom';
const router = createBrowserRouter([
  { path: '/', element: <MainPage /> },
  { path: '/feed/:id', element: <FeedPostDetailPage /> },
  { path: '/users/me/edit', element: <RequireAuth><ProfileEditPage /></RequireAuth> },
]);
export function App() { return <RouterProvider router={router} />; }
