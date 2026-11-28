import { describe, expect, it } from 'vitest';
import { parentPath } from './use-close-group-modal';

describe('parentPath', () => {
  it('drops the modal segment', () => {
    expect(parentPath('/uk/w/nordick/groups/g1/assign-teacher')).toBe('/uk/w/nordick/groups/g1');
    expect(parentPath('/uk/w/nordick/groups/g1/add-students/')).toBe('/uk/w/nordick/groups/g1');
  });

  it('never returns an empty path', () => {
    expect(parentPath('/assign-teacher')).toBe('/');
  });
});
