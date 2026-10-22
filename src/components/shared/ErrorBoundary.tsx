import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('InsightHub ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[140px] p-4 text-center bg-slate-50/70 rounded-lg border border-dashed border-slate-200">
          <AlertTriangle className="w-5 h-5 text-amber-500 mb-1.5" />
          <span className="text-xs font-semibold text-slate-700 mb-1">
            {this.props.fallbackTitle || 'Não foi possível renderizar este componente'}
          </span>
          <span className="text-[11px] text-slate-500 max-w-xs mb-2.5 line-clamp-2">
            {this.state.error?.message || 'Ocorreu uma instabilidade na exibição.'}
          </span>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Recarregar visual
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
