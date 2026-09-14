// EXAMPLE: Unit test pattern. See dt-frontend-testing/patterns/<rule>.md for the rule.
import { describe, it, expect, beforeEach } from 'vitest';
import { usePostUiStore } from '../postUiStore';

describe('postUiStore', () => {
  beforeEach(() => {
    usePostUiStore.setState({ viewMode: 'list' });
  });

  it('초기 viewMode는 list여야 한다', () => {
    expect(usePostUiStore.getState().viewMode).toBe('list');
  });

  it('setViewMode로 grid로 변경할 수 있어야 한다', () => {
    usePostUiStore.getState().setViewMode('grid');
    expect(usePostUiStore.getState().viewMode).toBe('grid');
  });

  it('setViewMode로 다시 list로 변경할 수 있어야 한다', () => {
    usePostUiStore.getState().setViewMode('grid');
    usePostUiStore.getState().setViewMode('list');
    expect(usePostUiStore.getState().viewMode).toBe('list');
  });
});
