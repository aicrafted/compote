import { ComposeConfig } from '@/types';

/**
 * Validates and parses a JSON string into a ComposeConfig.
 * For now, this is a simple wrapper, but can be extended with Zod for safety.
 */
export function parseStackConfig(json: string): ComposeConfig | null {
  try {
    const parsed = JSON.parse(json);
    // Basic structural check
    if (parsed && typeof parsed === 'object' && 'services' in parsed && 'settings' in parsed) {
      return parsed as ComposeConfig;
    }
  } catch (e) {
    console.error('Failed to parse stack config:', e);
  }
  return null;
}

/**
 * Serializes a ComposeConfig to a JSON string.
 */
export function serializeStackConfig(config: ComposeConfig): string {
  return JSON.stringify(config, null, 2);
}
