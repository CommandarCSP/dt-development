// EXAMPLE: Unit test pattern. See dt-frontend-testing/patterns/<rule>.md for the rule.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostList } from '../PostList';
import { usePostUiStore } from '../../../store/stores/postUiStore';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PostList', () => {
  beforeEach(() => {
    usePostUiStore.setState({ viewMode: 'list' });
  });

  it('로딩 중에 로딩 텍스트를 표시해야 한다', () => {
    renderWithProviders(<PostList />);
    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('게시글 목록을 렌더링해야 한다', async () => {
    renderWithProviders(<PostList />);

    await waitFor(() =>
      expect(screen.getByText('첫 번째 게시글')).toBeInTheDocument()
    );
    expect(screen.getByText('두 번째 게시글')).toBeInTheDocument();
  });

  it('뷰 모드 전환 버튼이 있어야 한다', async () => {
    renderWithProviders(<PostList />);

    await waitFor(() =>
      expect(screen.getByText('첫 번째 게시글')).toBeInTheDocument()
    );

    expect(screen.getByRole('button', { name: '리스트뷰' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '그리드뷰' })).toBeInTheDocument();
  });

  it('그리드뷰 버튼 클릭 시 그리드뷰 버튼이 비활성화되어야 한다', async () => {
    renderWithProviders(<PostList />);

    await waitFor(() =>
      expect(screen.getByText('첫 번째 게시글')).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: '그리드뷰' }));

    expect(screen.getByRole('button', { name: '그리드뷰' })).toBeDisabled();
  });
});
