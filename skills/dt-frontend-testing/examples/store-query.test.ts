// EXAMPLE: Unit test pattern. See dt-frontend-testing/patterns/<rule>.md for the rule.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePostListQuery } from '../usePostListQuery';
import { createQueryWrapper } from '../../../../test-utils/queryWrapper';

describe('usePostListQuery', () => {
  it('게시글 목록을 서버에서 가져와야 한다', async () => {
    const { result } = renderHook(() => usePostListQuery(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      id: 1,
      title: '첫 번째 게시글',
      body: '첫 번째 내용입니다.',
      userId: 1,
    });
  });

  it('초기 상태는 isLoading이 true여야 한다', () => {
    const { result } = renderHook(() => usePostListQuery(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
