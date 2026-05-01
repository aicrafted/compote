import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppErrorStore } from '@/lib/errors/errorStore';
import { cn } from '@/lib/utils';

export function AppErrorToaster() {
  const { errors, reportError, dismissError } = useAppErrorStore();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportError(event.error || event.message);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [reportError]);

  if (errors.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {errors.map((error) => (
        <div
          key={error.id}
          role="alert"
          className={cn(
            'pointer-events-auto rounded-lg border bg-background p-3 shadow-lg',
            error.level === 'error' ? 'border-destructive/30' : 'border-secondary/30'
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={16}
              className={cn('mt-0.5 shrink-0', error.level === 'error' ? 'text-destructive' : 'text-secondary')}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{error.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={() => dismissError(error.id)}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
