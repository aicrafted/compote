export interface EnvParseResult {
  values: Record<string, string>;
  ignored: string[];
}

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function stripValueQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function pushToken(tokens: string[], token: string) {
  const trimmed = token.trim();
  if (trimmed) tokens.push(trimmed);
}

function tokenizeEnvInput(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if ((char === '"' || char === "'") && input[i - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
      current += char;
      continue;
    }

    if (!quote && (char === '\n' || char === '\r' || char === ';' || char === ',')) {
      pushToken(tokens, current);
      current = '';
      continue;
    }

    if (!quote && char === ' ') {
      const rest = input.slice(i + 1);
      if (/^\s*(?:-+\s*)?(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=|:)/.test(rest)) {
        pushToken(tokens, current);
        current = '';
        continue;
      }
    }

    current += char;
  }

  pushToken(tokens, current);
  return tokens;
}

export function parseEnvInput(input: string): EnvParseResult {
  const values: Record<string, string> = {};
  const ignored: string[] = [];

  tokenizeEnvInput(input).forEach((rawToken) => {
    let token = rawToken.trim();
    if (!token || token.startsWith('#')) return;

    token = token.replace(/^-\s*/, '').replace(/^export\s+/, '').trim();

    const match = token.match(/^([^=:]+?)\s*(=|:)\s*(.*)$/);
    if (!match) {
      ignored.push(rawToken);
      return;
    }

    const key = match[1].trim();
    const value = match[3];

    if (!ENV_KEY_RE.test(key)) {
      ignored.push(rawToken);
      return;
    }

    values[key] = stripValueQuotes(value);
  });

  return { values, ignored };
}

export function isValidEnvKey(key: string): boolean {
  return ENV_KEY_RE.test(key);
}
