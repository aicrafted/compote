import { useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorFallback() {
  const error = useRouteError() as Error | undefined;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
      <AlertTriangle size={32} className="text-destructive" />
      <div className="text-center">
        <p className="text-sm font-semibold">Something went wrong</p>
        {error?.message && (
          <p className="mt-1 max-w-sm font-mono text-xs text-muted-foreground">{error.message}</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => window.location.assign('/')}>
        Reload app
      </Button>
    </div>
  );
}
