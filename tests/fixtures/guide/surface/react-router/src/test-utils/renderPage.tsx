import { createBrowserRouter } from 'react-router-dom';
export const r = { path: '/should-not-appear' };
export const renderPage = () => createBrowserRouter([r]);
