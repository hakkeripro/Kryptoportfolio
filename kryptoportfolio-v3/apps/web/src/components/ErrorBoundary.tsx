import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * App-level safety net.
 *
 * We keep this intentionally small: show the error and give the user a way out.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="p-6">
        <div className="rounded-2xl border border-rose-900/30 bg-rose-950/30 p-5 max-w-2xl">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Something went wrong</div>
              <div data-testid="badge-error" className="mt-1 text-xs text-rose-200">
                UI recovered via ErrorBoundary
              </div>
            </div>
            <button
              data-testid="btn-reload"
              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>

          <div className="mt-4 text-sm text-rose-100">{this.state.error.message}</div>
          <pre className="mt-3 text-xs text-rose-200/70 whitespace-pre-wrap">
            {String(this.state.error.stack ?? '')}
          </pre>

          <div className="mt-4 text-sm text-slate-200">
            If this keeps happening, go to <a className="underline" href="/onboarding">Onboarding</a> and unlock the vault.
          </div>
        </div>
      </div>
    );
  }
}
