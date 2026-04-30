import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './Select';
import { cn } from '@/lib/utils';

interface CustomSelectProps {
  label?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export function CustomSelect({ label, value, options, onChange, className, variant = 'default' }: CustomSelectProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className={cn(
          "font-medium tracking-wide text-muted-foreground/60 block ml-1",
          isCompact ? "text-[8px]" : "text-[10px]"
        )}>
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(
          "w-full bg-background/30 border border-border/50 rounded-lg px-3 font-medium tracking-normal transition-all cursor-pointer",
          isCompact ? "h-8 text-xs px-2.5" : "h-8 text-xs"
        )}>
          <SelectValue placeholder={label ? `Select ${label}` : undefined} />
        </SelectTrigger>
        <SelectContent className={cn(isCompact && "min-w-[var(--radix-select-trigger-width)]")}>
          {options.map((opt) => (
            <SelectItem 
                key={opt.value} 
                value={opt.value}
                className="text-xs font-medium tracking-normal py-1.5 px-3 focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent/10 data-[state=checked]:text-foreground"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
