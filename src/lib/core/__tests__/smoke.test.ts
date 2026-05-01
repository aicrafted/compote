import { getNextFreePort } from '@/lib/core/bundle-utils';

describe('test infrastructure', () => {
  it('vitest resolves @/ path aliases', async () => {
    const { uniqueComposeName } = await import('@/lib/core/bundle-utils');

    expect(uniqueComposeName([], 'stack')).toBe('stack');
  });

  it('getNextFreePort skips occupied ports', () => {
    const occupied = new Set([3000, 3001, 3002]);

    expect(getNextFreePort(3000, occupied)).toBe(3003);
  });
});
