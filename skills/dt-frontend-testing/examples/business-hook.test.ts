// EXAMPLE: Unit test pattern. See dt-frontend-testing/patterns/<rule>.md for the rule.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePostListViewModel } from '../usePostListViewModel';
import { createQueryWrapper } from '../../../../test-utils/queryWrapper';

describe('usePostListViewModel', () => {
  it('PostDto 배열을 Post 배열로 변환해야 한다 (userId → authorId)', async () => {
    const { result } = renderHook(() => usePostListViewModel(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.posts[0]).toEqual({
      id: 1,
      title: '첫 번째 게시글',
      body: '첫 번째 내용입니다.',
      authorId: 1,
    });
    // userId 필드가 없어야 한다
    expect(result.current.posts[0]).not.toHaveProperty('userId');
  });

  it('데이터 로딩 중에는 isLoading이 true여야 한다', () => {
    const { result } = renderHook(() => usePostListViewModel(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('데이터가 없을 때 posts는 빈 배열이어야 한다', async () => {
    const { result } = renderHook(() => usePostListViewModel(), {
      wrapper: createQueryWrapper(),
    });

    // 로딩 중에는 빈 배열
    expect(result.current.posts).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.posts).toHaveLength(2);
  });
});
