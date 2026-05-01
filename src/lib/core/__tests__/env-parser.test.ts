import { describe, it, expect } from 'vitest';
import { parseEnvInput, isValidEnvKey } from '@/lib/core/env-parser';

describe('parseEnvInput', () => {
  it('parses a simple KEY=value pair', () => {
    const { values } = parseEnvInput('KEY=value');
    expect(values).toEqual({ KEY: 'value' });
  });

  it('parses KEY:value (colon separator)', () => {
    const { values } = parseEnvInput('KEY:value');
    expect(values).toEqual({ KEY: 'value' });
  });

  it('strips double quotes from value', () => {
    const { values } = parseEnvInput('KEY="hello world"');
    expect(values['KEY']).toBe('hello world');
  });

  it('strips single quotes from value', () => {
    const { values } = parseEnvInput("KEY='hello world'");
    expect(values['KEY']).toBe('hello world');
  });

  it('strips export prefix', () => {
    const { values } = parseEnvInput('export KEY=value');
    expect(values['KEY']).toBe('value');
  });

  it('handles empty value', () => {
    const { values } = parseEnvInput('KEY=');
    expect(values['KEY']).toBe('');
  });

  it('only splits on first = when value contains =', () => {
    const { values } = parseEnvInput('KEY=a=b=c');
    expect(values['KEY']).toBe('a=b=c');
  });

  it('skips full-line comments', () => {
    const { values } = parseEnvInput('# this is a comment\nKEY=value');
    expect(Object.keys(values)).toEqual(['KEY']);
  });

  it('skips blank lines', () => {
    const { values } = parseEnvInput('\n\nKEY=value\n\n');
    expect(values).toEqual({ KEY: 'value' });
  });

  it('parses multiple lines', () => {
    const { values } = parseEnvInput('A=1\nB=2\nC=3');
    expect(values).toEqual({ A: '1', B: '2', C: '3' });
  });

  it('parses comma-separated pairs', () => {
    const { values } = parseEnvInput('A=1,B=2');
    expect(values['A']).toBe('1');
    expect(values['B']).toBe('2');
  });

  it('parses semicolon-separated pairs', () => {
    const { values } = parseEnvInput('A=1;B=2');
    expect(values['A']).toBe('1');
    expect(values['B']).toBe('2');
  });

  it('ignores invalid tokens and records them in ignored', () => {
    const { ignored } = parseEnvInput('not-valid');
    expect(ignored.length).toBeGreaterThan(0);
  });

  it('rejects keys with invalid characters', () => {
    const { values, ignored } = parseEnvInput('123INVALID=value');
    expect(values['123INVALID']).toBeUndefined();
    expect(ignored.length).toBeGreaterThan(0);
  });

  it('accepts underscore-prefixed keys', () => {
    const { values } = parseEnvInput('_PRIVATE=secret');
    expect(values['_PRIVATE']).toBe('secret');
  });

  it('handles mixed-case keys', () => {
    const { values } = parseEnvInput('MyKey=value');
    expect(values['MyKey']).toBe('value');
  });
});

// ── isValidEnvKey ────────────────────────────────────────────────────────────

describe('isValidEnvKey', () => {
  it('accepts uppercase letters', () => expect(isValidEnvKey('FOO')).toBe(true));
  it('accepts lowercase letters', () => expect(isValidEnvKey('foo')).toBe(true));
  it('accepts underscore prefix', () => expect(isValidEnvKey('_FOO')).toBe(true));
  it('accepts letters + digits', () => expect(isValidEnvKey('FOO1')).toBe(true));
  it('rejects digit prefix', () => expect(isValidEnvKey('1FOO')).toBe(false));
  it('rejects hyphen', () => expect(isValidEnvKey('FOO-BAR')).toBe(false));
  it('rejects empty string', () => expect(isValidEnvKey('')).toBe(false));
  it('rejects dot', () => expect(isValidEnvKey('FOO.BAR')).toBe(false));
});
