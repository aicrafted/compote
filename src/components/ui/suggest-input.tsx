import React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface SuggestInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange'> {
  suggestions?: string[];
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export function SuggestInput({ suggestions = [], value, onValueChange, onChange, className, onFocus, onBlur, ...props }: SuggestInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const focusValueRef = React.useRef('');
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [dropdownWidth, setDropdownWidth] = React.useState<number>();
  const uniqueSuggestions = Array.from(new Set(suggestions.filter(Boolean)));
  const currentValue = String(value || '');
  const visibleSuggestions = uniqueSuggestions.filter((suggestion) =>
    suggestion.toLowerCase().includes(currentValue.toLowerCase())
  );

  React.useEffect(() => {
    if (!open) return;
    if (activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    if (onChange) {
      onChange(event);
    } else {
      onValueChange?.(event.target.value);
    }
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
    focusValueRef.current = currentValue;
    setDropdownWidth(event.currentTarget.offsetWidth);
    setOpen(uniqueSuggestions.length > 0);
    setActiveIndex(-1);
    onFocus?.(event);
  };

  const handleBlur: React.FocusEventHandler<HTMLInputElement> = (event) => {
    window.setTimeout(() => setOpen(false), 80);
    onBlur?.(event);
  };

  const handlePick = (suggestion: string) => {
    onValueChange?.(suggestion);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      onValueChange?.(focusValueRef.current);
      setOpen(false);
      setActiveIndex(-1);
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, visibleSuggestions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp' && visibleSuggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index < 0 ? visibleSuggestions.length - 1 : Math.max(index - 1, 0)));
      return;
    }

    if (event.key === 'Enter' && open && activeIndex >= 0 && visibleSuggestions[activeIndex]) {
      event.preventDefault();
      handlePick(visibleSuggestions[activeIndex]);
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      event.currentTarget.blur();
    }
  };

  return (
    <span className="relative z-0 block focus-within:z-[200]">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={className}
        {...props}
      />
      {open && visibleSuggestions.length > 0 && (
        <div
          className="absolute left-0 top-full z-[100] mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-card p-1 text-card-foreground shadow-xl"
          style={{ width: dropdownWidth }}
        >
          {visibleSuggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onMouseDown={(event) => {
                event.preventDefault();
                handlePick(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium outline-none hover:bg-accent hover:text-accent-foreground',
                index === activeIndex && 'bg-accent text-accent-foreground',
                suggestion === currentValue && index !== activeIndex && 'text-foreground'
              )}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
