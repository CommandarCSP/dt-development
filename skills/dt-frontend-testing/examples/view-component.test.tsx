// EXAMPLE: Unit test pattern. See dt-frontend-testing/patterns/<rule>.md for the rule.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PostCard } from '../PostCard';
import type { Post } from '../../../types/post';

const mockPost: Post = {
  id: 1,
  title: '테스트 게시글',
  body: '내용입니다.',
  authorId: 42,
};

describe('PostCard', () => {
  it('게시글 제목을 렌더링해야 한다', () => {
    render(<PostCard post={mockPost} onClick={vi.fn()} />);
    expect(screen.getByText('테스트 게시글')).toBeInTheDocument();
  });

  it('authorId를 표시해야 한다', () => {
    render(<PostCard post={mockPost} onClick={vi.fn()} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('클릭 시 onClick이 post.id와 함께 호출되어야 한다', async () => {
    const onClick = vi.fn();
    render(<PostCard post={mockPost} onClick={onClick} />);

    await userEvent.click(screen.getByRole('article'));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledWith(1);
  });
});
