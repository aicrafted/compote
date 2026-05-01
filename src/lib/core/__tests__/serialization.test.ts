import { describe, it, expect } from 'vitest';
import { parseStackConfig, serializeStackConfig } from '@/lib/core/serialization';
import type { ComposeConfig } from '@/types';

const validConfig = {
  id: 'c1',
  name: 'test',
  hostId: 'h1',
  services: {},
  settings: {},        // parseStackConfig requires this key
} as unknown as ComposeConfig;

describe('parseStackConfig', () => {
  it('returns parsed object when both services and settings are present', () => {
    const json = JSON.stringify({ services: {}, settings: {} });
    const result = parseStackConfig(json);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({ services: {}, settings: {} });
  });

  it('returns null when settings key is missing', () => {
    expect(parseStackConfig(JSON.stringify({ services: {} }))).toBeNull();
  });

  it('returns null when services key is missing', () => {
    expect(parseStackConfig(JSON.stringify({ settings: {} }))).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseStackConfig('{ not valid json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseStackConfig('')).toBeNull();
  });

  it('returns null for JSON null literal', () => {
    expect(parseStackConfig('null')).toBeNull();
  });

  it('does not throw on any input', () => {
    expect(() => parseStackConfig('garbage')).not.toThrow();
    expect(() => parseStackConfig('')).not.toThrow();
    expect(() => parseStackConfig('null')).not.toThrow();
  });
});

describe('serializeStackConfig', () => {
  it('returns a string', () => {
    expect(typeof serializeStackConfig(validConfig)).toBe('string');
  });

  it('output is valid JSON', () => {
    const json = serializeStackConfig(validConfig);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('output is pretty-printed (contains newlines)', () => {
    const json = serializeStackConfig(validConfig);
    expect(json).toContain('\n');
  });

  it('round-trip preserves data', () => {
    const json = serializeStackConfig(validConfig);
    expect(JSON.parse(json)).toMatchObject({ id: 'c1', name: 'test' });
  });
});
