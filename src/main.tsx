import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@fontsource-variable/geist';
import App from './App';
import { ErrorFallback } from '@/components/layout/ErrorFallback';
import './index.css';

document.documentElement.classList.add('dark');

const router = createBrowserRouter([
  {
    path: '*',
    element: <App />,
    errorElement: <ErrorFallback />,
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </React.StrictMode>,
);
