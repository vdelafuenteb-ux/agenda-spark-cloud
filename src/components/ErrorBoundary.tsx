import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Last-resort safety net. Any uncaught render error from descendants lands here
// and surfaces a human-readable screen with stack trace, instead of the blank
// white page that React otherwise produces in production builds.
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (err: Error, reset: () => void) => ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-lg w-full rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Se produjo un error en la vista</h2>
            <p className="text-xs text-muted-foreground">Puedes reintentar o recargar la página</p>
          </div>
        </div>
        <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-60 whitespace-pre-wrap break-words">
          {error.message}
          {error.stack ? '\n\n' + error.stack : ''}
        </pre>
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={onReset}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reintentar
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  );
}
