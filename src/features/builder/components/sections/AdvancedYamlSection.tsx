import React, { useEffect, useState } from 'react';
import { Code } from 'lucide-react';
import yaml from 'js-yaml';
import { Textarea } from '@/components/ui/textarea';
import { SettingsSection } from '../SettingsSection';

const RESERVED_COMPOSE_KEYS = new Set([
  'image', 'build', 'container_name', 'restart', 'environment', 'ports', 'volumes',
  'devices', 'deploy', 'depends_on', 'labels', 'networks', 'configs', 'secrets',
  'healthcheck', 'command', 'entrypoint', 'working_dir', 'user', 'profiles',
  'platform', 'pull_policy',
]);

function rawToYaml(raw: unknown): string {
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return '';
  try {
    return yaml.dump(raw, { indent: 2, lineWidth: -1 });
  } catch {
    return '';
  }
}

interface AdvancedYamlSectionProps {
  raw?: unknown;
  onChange: (raw: Record<string, unknown> | undefined) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function AdvancedYamlSection({ raw, onChange, collapsible, defaultOpen }: AdvancedYamlSectionProps) {
  const [text, setText] = useState(() => rawToYaml(raw));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(rawToYaml(raw));
    setError(null);
  }, [raw]);

  const handleBlur = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(null);
      onChange(undefined);
      return;
    }
    let parsed: unknown;
    try {
      parsed = yaml.load(trimmed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid YAML');
      return;
    }
    if (parsed === null || parsed === undefined) {
      setError(null);
      onChange(undefined);
      return;
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('Must be a YAML mapping (key: value pairs)');
      return;
    }
    const safe: Record<string, unknown> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      if (!RESERVED_COMPOSE_KEYS.has(k)) safe[k] = v;
    });
    setError(null);
    onChange(Object.keys(safe).length > 0 ? safe : undefined);
  };

  return (
    <SettingsSection title="Advanced YAML" icon={<Code size={14} />} collapsible={collapsible} defaultOpen={defaultOpen}>
      <div className="space-y-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          className="min-h-24 font-mono text-xs"
          placeholder={'privileged: true\ncap_add:\n  - NET_ADMIN'}
          aria-invalid={Boolean(error)}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </SettingsSection>
  );
}
