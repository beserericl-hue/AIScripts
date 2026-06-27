import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Human label for the surface, e.g. "Review". */
  label?: string;
  /** Optional reset hook (e.g. reload data) when the user clicks "Reload". */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions in a surface (Review / Matrix / editor) and
 * shows a recoverable message INSTEAD of letting the whole React tree unmount
 * to a blank white page. Without a boundary, one thrown render crashed the
 * entire app to a blank screen (reported on the per-card file upload).
 */
export class SurfaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown): void {
    // Surface it to the console for debugging; never rethrow (that would blank
    // the page again).
    // eslint-disable-next-line no-console
    console.error('SurfaceErrorBoundary caught a render error:', error, info);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          data-testid="surface-error"
          className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <p className="text-sm font-semibold text-red-700">
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.
          </p>
          <p className="max-w-md break-words text-xs text-gray-500">
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Reload this view
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
