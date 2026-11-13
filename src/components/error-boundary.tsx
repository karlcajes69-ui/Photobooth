import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Kiosk uncaught error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '28px', textAlign: 'center', fontFamily: 'sans-serif', background: '#f5f2ec', minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <div style={{ maxWidth: 420, background: '#fffefa', padding: '32px', borderRadius: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <h2 style={{ margin: '0 0 12px', fontFamily: 'Georgia, serif', color: '#302d29' }}>Something went wrong</h2>
            <p style={{ color: '#716b63', fontSize: '14px', lineHeight: 1.6 }}>
              {this.state.error?.message || 'An unexpected issue occurred in the kiosk.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '20px',
                padding: '12px 24px',
                backgroundColor: '#a9684d',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                letterSpacing: '0.05em',
              }}
            >
              RELOAD KIOSK
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
