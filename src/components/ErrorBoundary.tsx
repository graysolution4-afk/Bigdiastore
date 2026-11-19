import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Database access notice (${parsed.operationType} on ${parsed.path}): ${parsed.error}`;
        }
      } catch {
        // standard message
      }

      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-neutral-200 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-3">DIAMOND STORE</p>
            <h1 className="text-2xl font-display font-semibold text-[#111111] mb-3">
              Something needs attention
            </h1>
            <p className="text-sm text-neutral-600 mb-6 break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest hover:bg-[#222222] transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
