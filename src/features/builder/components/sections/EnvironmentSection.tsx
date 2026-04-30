import React, { useMemo, useState } from 'react';
import { ClipboardPaste, Plus, Terminal, X } from 'lucide-react';
import { ServiceSpec } from '@/types';
import { cn } from '@/lib/utils';
import { isValidEnvKey, parseEnvInput } from '@/lib/core/env-parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsSection } from '../SettingsSection';

interface EnvironmentSectionProps {
  serviceId: string;
  env: Record<string, string>;
  spec: ServiceSpec;
  onChange: (env: Record<string, string>) => void;
}

interface EnvRow {
  id: string;
  key: string;
  value: string;
  required: boolean;
  lockedKey: boolean;
  secret: boolean;
}

function buildRows(env: Record<string, string>, spec: ServiceSpec): EnvRow[] {
  const requiredRows = spec.requiredEnv.map((field) => ({
    id: `required:${field.name}`,
    key: field.name,
    value: env[field.name] || field.defaultValue || '',
    required: field.required,
    lockedKey: true,
    secret: Boolean(field.isSecret),
  }));

  const catalogKeys = new Set(spec.requiredEnv.map((field) => field.name));
  const customRows = Object.entries(env)
    .filter(([key]) => !catalogKeys.has(key))
    .map(([key, value]) => ({
      id: `custom:${key}`,
      key,
      value,
      required: false,
      lockedKey: false,
      secret: false,
    }));

  return [...requiredRows, ...customRows];
}

function rowsToEnv(rows: EnvRow[]): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, row) => {
    const key = row.key.trim();
    if (!key || !isValidEnvKey(key)) return acc;
    acc[key] = row.value;
    return acc;
  }, {});
}

function getDuplicateKeys(rows: EnvRow[]): Set<string> {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.key.trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return new Set(Object.entries(counts).filter(([, count]) => count > 1).map(([key]) => key));
}

function getEnvSignature(env: Record<string, string>): string {
  return Object.entries(env)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function EnvironmentSection({ serviceId, env, spec, onChange }: EnvironmentSectionProps) {
  const [rows, setRows] = useState<EnvRow[]>(() => buildRows(env, spec));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const valueInputsRef = React.useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusKeyRef = React.useRef<string | null>(null);
  const requiredEnvKey = useMemo(
    () => spec.requiredEnv.map((field) => `${field.name}:${field.defaultValue || ''}:${field.required ? '1' : '0'}`).join('|'),
    [spec.requiredEnv]
  );
  const envSignature = useMemo(() => getEnvSignature(env), [env]);
  const syncSignature = `${requiredEnvKey}\n${envSignature}`;
  const lastSyncedSignature = React.useRef(syncSignature);

  const duplicateKeys = useMemo(() => getDuplicateKeys(rows), [rows]);
  const parsedPaste = useMemo(() => parseEnvInput(pasteText), [pasteText]);
  const currentEnv = useMemo(() => rowsToEnv(rows), [rows]);
  const currentEnvSignature = useMemo(() => getEnvSignature(currentEnv), [currentEnv]);

  React.useEffect(() => {
    if (lastSyncedSignature.current === syncSignature) return;
    lastSyncedSignature.current = syncSignature;
    if (`${requiredEnvKey}\n${currentEnvSignature}` === syncSignature) return;
    setRows(buildRows(env, spec));
  }, [currentEnvSignature, env, requiredEnvKey, spec, syncSignature]);

  React.useEffect(() => {
    const focusValue = (key: string) => {
      const input = valueInputsRef.current[key];
      if (input) {
        input.focus();
        input.select();
        pendingFocusKeyRef.current = null;
      } else {
        pendingFocusKeyRef.current = key;
      }
    };

    const handleFocusEnv = (event: Event) => {
      const detail = (event as CustomEvent<{ serviceId: string; key: string }>).detail;
      if (detail?.serviceId !== serviceId || !detail.key) return;
      focusValue(detail.key);
    };

    window.addEventListener('compote:focus-env-value', handleFocusEnv);
    return () => window.removeEventListener('compote:focus-env-value', handleFocusEnv);
  }, [serviceId]);

  React.useEffect(() => {
    const key = pendingFocusKeyRef.current;
    if (!key) return;
    const input = valueInputsRef.current[key];
    if (!input) return;
    input.focus();
    input.select();
    pendingFocusKeyRef.current = null;
  }, [rows]);

  const pasteSummary = useMemo(() => {
    const entries = Object.entries(parsedPaste.values);
    return {
      newCount: entries.filter(([key]) => currentEnv[key] === undefined).length,
      overwriteCount: entries.filter(([key]) => currentEnv[key] !== undefined).length,
      ignoredCount: parsedPaste.ignored.length,
    };
  }, [currentEnv, parsedPaste]);

  const commitRows = (nextRows: EnvRow[]) => {
    setRows(nextRows);
    onChange(rowsToEnv(nextRows));
  };

  const handleAdd = () => {
    setRows([
      ...rows,
      {
        id: `custom:new:${crypto.randomUUID()}`,
        key: '',
        value: '',
        required: false,
        lockedKey: false,
        secret: false,
      },
    ]);
  };

  const handleUpdate = (id: string, patch: Partial<EnvRow>) => {
    commitRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleRemove = (id: string) => {
    commitRows(rows.filter((row) => row.id !== id || row.required));
  };

  const handleApplyPaste = () => {
    const incoming = Object.entries(parsedPaste.values);
    if (incoming.length === 0) return;

    const nextRows = [...rows];
    incoming.forEach(([key, value]) => {
      const existingIndex = nextRows.findIndex((row) => row.key === key);
      if (existingIndex >= 0) {
        nextRows[existingIndex] = { ...nextRows[existingIndex], value };
      } else {
        nextRows.push({
          id: `custom:${key}:${crypto.randomUUID()}`,
          key,
          value,
          required: false,
          lockedKey: false,
          secret: false,
        });
      }
    });

    commitRows(nextRows);
    setPasteText('');
    setPasteOpen(false);
  };

  return (
    <SettingsSection
      title="Environment"
      icon={<Terminal size={14} />}
      action={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={handleAdd}>
            <Plus size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste size={14} /> Paste
          </Button>
        </div>
      }
    >
      <form
        className="overflow-hidden rounded-lg border border-border/40 bg-background/30"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="grid grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
          <div className="px-2.5 py-2">Name</div>
          <div className="border-l border-border/40 px-2.5 py-2">Value</div>
          <div />
        </div>

        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No variables</div>
        ) : (
          <div className="divide-y divide-border/20">
            {rows.map((row) => {
              const trimmedKey = row.key.trim();
              const invalidKey = Boolean(trimmedKey) && !isValidEnvKey(trimmedKey);
              const duplicateKey = Boolean(trimmedKey) && duplicateKeys.has(trimmedKey);

              return (
                <div
                  key={row.id}
                  className="group/env-row grid grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)_2rem] items-center"
                >
                  <Input
                    value={row.required ? `${row.key} *` : row.key}
                    disabled={row.lockedKey}
                    onChange={(event) => handleUpdate(row.id, { key: event.target.value })}
                    onBlur={() => commitRows(rows)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitRows(rows);
                        event.currentTarget.blur();
                      }
                    }}
                    aria-invalid={invalidKey || duplicateKey}
                    className={cn(
                      'h-8 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0',
                      row.lockedKey && 'disabled:bg-transparent disabled:opacity-100',
                      (invalidKey || duplicateKey) && 'text-destructive'
                    )}
                    placeholder="VARIABLE_NAME"
                  />
                  <Input
                    type="text"
                    value={row.value}
                    ref={(input) => { valueInputsRef.current[row.key] = input; }}
                    onChange={(event) => handleUpdate(row.id, { value: event.target.value })}
                    onBlur={() => commitRows(rows)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitRows(rows);
                        event.currentTarget.blur();
                      }
                    }}
                    className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                    placeholder="value"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={row.required}
                    onClick={() => handleRemove(row.id)}
                    className="mx-auto opacity-0 group-hover/env-row:opacity-100 disabled:opacity-0"
                  >
                    <X size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </form>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Paste Environment Variables</DialogTitle>
            <DialogDescription>
              Paste env lines, shell pairs, YAML pairs, or Docker list entries.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            className="min-h-40 font-mono text-xs"
            placeholder={'FOO=bar\nBAR="quoted value"\nBAZ: value'}
          />

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{pasteSummary.newCount} new</span>
            <span>{pasteSummary.overwriteCount} overwritten</span>
            <span>{pasteSummary.ignoredCount} ignored</span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyPaste} disabled={Object.keys(parsedPaste.values).length === 0}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
