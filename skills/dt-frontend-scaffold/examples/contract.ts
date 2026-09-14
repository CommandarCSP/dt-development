// EXAMPLE contract for 'comments' domain.
// Phase 1 generates this file at src/contracts/<domain>.contract.ts.
// Phase 2 agents must import these interfaces and type their implementations
// accordingly. Phase 2 merge gate (tsc --noEmit) catches mismatches.

import type { Comment } from '../types/comment';

export interface UseCommentListQuery {
  (params: { postId: number }): {
    data: Comment[] | undefined;
    isLoading: boolean;
    isError: boolean;
  };
}

export interface UseCommentListViewModel {
  (params: { postId: number }): {
    comments: Comment[];
    isLoading: boolean;
    isError: boolean;
  };
}

export interface CommentItemProps {
  comment: Comment;
  onReply?: (id: number) => void;
}

export interface CommentListProps {
  postId: number;
}
