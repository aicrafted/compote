import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HostResourceListProps {
  title: string;
  icon: ReactNode;
  values: string[];
  discoveredValues: string[];
  placeholder: string;
  defaultPrefix: string;
  addLabel: string;
  onChange: (values: string[]) => void;
  onRename: (oldName: string, newName: string) => void;
}

export function HostResourceList({
  title,
  icon,
  values,
  discoveredValues,
  placeholder,
  defaultPrefix,
  addLabel,
  onChange,
  onRename,
}: HostResourceListProps) {
  const [draftValues, setDraftValues] = useState(values);

  useEffect(() => {
    setDraftValues(values);
  }, [values]);

  const handleUpdate = (index: number, value: string) => {
    const next = [...draftValues];
    next[index] = value;
    setDraftValues(next);
  };

  const commit = (nextValues = draftValues, index?: number) => {
    const normalized = nextValues.map((item) => item.trim()).filter(Boolean);
    if (index !== undefined) {
      const oldName = values[index]?.trim();
      const newName = nextValues[index]?.trim();
      if (oldName && newName && oldName !== newName) {
        onRename(oldName, newName);
      }
    }
    onChange(normalized);
  };

  const revert = () => {
    setDraftValues(values);
  };

  const additionalDiscoveredValues = discoveredValues.filter((value) => !values.includes(value));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        <Button
          variant="quiet-outline"
          size="sm"
          onClick={() => {
            const next = [...draftValues, `${defaultPrefix}_${Math.random().toString(36).slice(2, 7)}`];
            setDraftValues(next);
            commit(next);
          }}
        >
          <Plus size={14} /> {addLabel}
        </Button>
      </div>

      <div className="space-y-2">
        {draftValues.map((value, index) => (
          <div key={index} className="group/resource flex items-center gap-2">
            <Input
              value={value}
              onChange={(event) => handleUpdate(index, event.target.value)}
              onBlur={() => commit(undefined, index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commit(undefined, index);
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  revert();
                  event.currentTarget.blur();
                }
              }}
              className="h-8 font-mono text-xs"
              placeholder={placeholder}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const next = draftValues.filter((_, itemIndex) => itemIndex !== index);
                setDraftValues(next);
                commit(next);
              }}
              className="opacity-0 group-hover/resource:opacity-100"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {draftValues.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground">
            No resources registered.
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">Discovered in compose projects</div>
        <div className="flex min-h-4 flex-wrap gap-2">
          {additionalDiscoveredValues.map((value) => (
            <span key={value} className="rounded border border-border/40 bg-muted/20 px-1.5 py-px font-mono text-[11px] leading-4 text-muted-foreground">
              {value}
            </span>
          ))}
          {additionalDiscoveredValues.length === 0 && (
            <span className="px-1 py-1 text-xs text-muted-foreground">No additional discovered resources.</span>
          )}
        </div>
      </div>
    </div>
  );
}
