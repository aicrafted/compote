import { describe, it, expect } from 'vitest';
import {
  getDefaultPortMappings,
  getExposedPorts,
  formatMappedPorts,
  formatExposedPorts,
} from '@/lib/core/ports';
import type { ServiceSpec } from '@/types';

// minimal ServiceSpec factory
const makeSpec = (overrides: Partial<ServiceSpec> = {}): ServiceSpec => ({
  id: 'test',
  name: 'Test',
  category: 'OTHER',
  description: '',
  image: 'test:latest',
  tags: [],
  containerPorts: [],
  requires: [],
  requiredEnv: [],
  ...overrides,
});

// ── getExposedPorts ──────────────────────────────────────────────────────────

describe('getExposedPorts', () => {
  it('returns unique container ports', () => {
    expect(getExposedPorts({ containerPorts: [80, 443, 80] })).toEqual([80, 443]);
  });

  it('filters out non-positive ports', () => {
    expect(getExposedPorts({ containerPorts: [0, -1, 80] })).toEqual([80]);
  });

  it('returns empty array when containerPorts is empty', () => {
    expect(getExposedPorts({ containerPorts: [] })).toEqual([]);
  });
});

// ── getDefaultPortMappings ──────────────────────────────────────────────────

describe('getDefaultPortMappings', () => {
  it('returns a mapping for the first container port using defaultHostPort', () => {
    const spec = makeSpec({ containerPorts: [80], defaultHostPort: 8080 });
    const mappings = getDefaultPortMappings(spec);
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({ host: 8080, container: 80 });
  });

  it('returns empty array when no defaultHostPort', () => {
    const spec = makeSpec({ containerPorts: [80] });
    expect(getDefaultPortMappings(spec)).toHaveLength(0);
  });

  it('returns empty array when containerPorts is empty', () => {
    const spec = makeSpec({ defaultHostPort: 8080, containerPorts: [] });
    expect(getDefaultPortMappings(spec)).toHaveLength(0);
  });

  it('only maps the first container port', () => {
    const spec = makeSpec({ containerPorts: [80, 443], defaultHostPort: 8080 });
    const mappings = getDefaultPortMappings(spec);
    expect(mappings).toHaveLength(1);
    expect(mappings[0].container).toBe(80);
  });
});

// ── formatMappedPorts ────────────────────────────────────────────────────────

describe('formatMappedPorts', () => {
  it('formats host:container when they differ', () => {
    const result = formatMappedPorts([{ host: 8080, container: 80 }]);
    expect(result).toEqual(['8080->80']);
  });

  it('uses compact form when host === container', () => {
    const result = formatMappedPorts([{ host: 80, container: 80 }]);
    expect(result).toEqual(['80']);
  });

  it('appends protocol when not tcp', () => {
    const result = formatMappedPorts([{ host: 8080, container: 80, protocol: 'udp' }]);
    expect(result).toEqual(['8080->80/udp']);
  });

  it('does not append /tcp for tcp protocol', () => {
    const result = formatMappedPorts([{ host: 8080, container: 80, protocol: 'tcp' }]);
    expect(result[0]).not.toContain('/tcp');
  });

  it('filters out ports with non-finite values', () => {
    const result = formatMappedPorts([{ host: NaN, container: 80 }]);
    expect(result).toHaveLength(0);
  });

  it('handles multiple ports', () => {
    const result = formatMappedPorts([
      { host: 80, container: 80 },
      { host: 8443, container: 443 },
    ]);
    expect(result).toEqual(['80', '8443->443']);
  });
});

// ── formatExposedPorts ───────────────────────────────────────────────────────

describe('formatExposedPorts', () => {
  it('converts port numbers to strings', () => {
    expect(formatExposedPorts([80, 443])).toEqual(['80', '443']);
  });

  it('returns empty array for empty input', () => {
    expect(formatExposedPorts([])).toEqual([]);
  });
});
