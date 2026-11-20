import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">error</span>
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">Could not display this view</h2>
          <p className="text-xs text-slate-500 max-w-md mb-4 font-mono bg-white p-3 rounded border border-slate-200 text-left overflow-auto max-h-32">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => { window.location.hash = '#home'; window.location.reload(); }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
            >
              Go to Spec Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
