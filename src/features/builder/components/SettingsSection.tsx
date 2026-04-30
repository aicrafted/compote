import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SettingsSectionProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface SettingsSectionSubtitleProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function SettingsSectionRoot({
  title,
  icon,
  action,
  className = 'space-y-3',
  children,
  collapsible,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
}: SettingsSectionProps) {
  const [internalOpen, setInternalOpen] = React.useState(openProp !== undefined ? openProp : defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const handleOpenChange = (value: boolean) => {
    if (!isControlled) setInternalOpen(value);
    onOpenChange?.(value);
  };

  if (!collapsible) {
    return (
      <section className={className}>
        <SettingsSectionHeader title={title} icon={icon} action={action} />
        {children}
      </section>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide transition-colors hover:text-foreground">
          {icon && <span className="flex items-center text-primary">{icon}</span>}
          {title}
          <ChevronDown
            size={12}
            className={cn('text-muted-foreground/50 transition-transform duration-200', !open && '-rotate-90')}
          />
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent>
        <div className={className}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SettingsSectionHeader({ title, icon, action }: SettingsSectionSubtitleProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {icon && <span className="flex items-center text-primary">{icon}</span>}
        {title}
      </h3>
      {action}
    </div>
  );
}

function SettingsSectionSubtitle({ title, icon, action }: SettingsSectionSubtitleProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {icon && <span className="flex items-center text-primary">{icon}</span>}
        {title}
      </h4>
      {action}
    </div>
  );
}

export const SettingsSection = Object.assign(SettingsSectionRoot, {
  Subtitle: SettingsSectionSubtitle,
});
