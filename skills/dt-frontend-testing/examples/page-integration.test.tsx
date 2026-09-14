// EXAMPLE: Page Integration. See dt-frontend-testing/patterns/integration-page.md
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
// 실제 프로젝트에서는 위치 조정 필요
import { server } from '../../src/mocks/server';
import { PostListPage } from '../../src/pages/PostListPage';

test('/posts 진입 시 글 목록 표시', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () =>
      HttpResponse.json([{ id: 1, userId: 1, title: '글', body: '' }]),
    ),
  );

  const router = createMemoryRouter(
    [{ path: '/posts', element: <PostListPage /> }],
    { initialEntries: ['/posts'] },
  );

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText('글')).toBeInTheDocument();
});
