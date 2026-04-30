import React from 'react';
import { Tags, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '../SettingsSection';

interface LabelsSectionProps {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function LabelsSection({ labels, onChange, collapsible, defaultOpen }: LabelsSectionProps) {
  const [rows, setRows] = React.useState(() => Object.entries(labels || {}).map(([key, value]) => ({ id: crypto.randomUUID(), key, value })));

  React.useEffect(() => {
    setRows(Object.entries(labels || {}).map(([key, value]) => ({ id: crypto.randomUUID(), key, value })));
  }, [labels]);

  const commitRows = (nextRows = rows) => {
    onChange(nextRows.reduce<Record<string, string>>((acc, row) => {
      const key = row.key.trim();
      if (key) acc[key] = row.value;
      return acc;
    }, {}));
  };

  const handleAdd = () => {
    const nextRows = [...rows, { id: crypto.randomUUID(), key: '', value: '' }];
    setRows(nextRows);
  };

  const handleUpdate = (id: string, patch: Partial<{ key: string; value: string }>) => {
    setRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleRemove = (id: string) => {
    const nextRows = rows.filter((row) => row.id !== id);
    setRows(nextRows);
    commitRows(nextRows);
  };

  return (
    <SettingsSection
      title="Docker Labels"
      icon={<Tags size={14} />}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> Add Label
        </Button>
      }
    >
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-background/30">
          <div className="grid grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <div className="px-2.5 py-2">Name</div>
            <div className="border-l border-border/40 px-2.5 py-2">Value</div>
            <div />
          </div>

          <div className="divide-y divide-border/20">
            {rows.map((row) => (
              <div
                key={row.id}
                className="group/label grid grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)_2rem] items-center"
              >
                <Input
                  value={row.key}
                  onChange={(e) => handleUpdate(row.id, { key: e.target.value })}
                  onBlur={() => commitRows()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitRows();
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-8 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
                  placeholder="traefik.enable"
                />
              <Input
                  value={row.value}
                  onChange={(e) => handleUpdate(row.id, { value: e.target.value })}
                  onBlur={() => commitRows()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitRows();
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                  placeholder="true"
              />
            <Button
              variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemove(row.id)}
                  className="mx-auto opacity-0 group-hover/label:opacity-100"
            >
                  <X size={12} />
            </Button>
          </div>
            ))}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
