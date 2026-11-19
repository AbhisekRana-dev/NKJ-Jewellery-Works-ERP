import './shared/styles/common.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import App from './app/App'
import {AuthProvider} from './core/auth/AuthProvider'
import RealtimeProvider from './core/realtime/RealtimeProvider'
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("NKJ application render failed:", error, info?.componentStack || "");
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error);
      return (
        <main style={{
          minHeight: "100vh", display: "grid", placeItems: "center",
          padding: 24, background: "#faf7f2", color: "#3b1823",
          fontFamily: "Arial, sans-serif"
        }}>
          <section style={{
            width: "min(680px, 100%)", padding: 28, borderRadius: 16,
            background: "#fff", border: "1px solid #ead9c8",
            boxShadow: "0 12px 36px rgba(60, 15, 30, .08)"
          }}>
            <p style={{ color: "#a07832", fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>
              NANDIKISHOR JEWELLERY WORKS · APPLICATION ERROR
            </p>
            <h1 style={{ margin: "8px 0 12px", color: "#8d1230", fontSize: 24 }}>
              This page could not be displayed
            </h1>
            <p style={{ margin: "0 0 16px", lineHeight: 1.6 }}>
              The React application encountered an error while rendering this page.
              The error details below will help identify the exact component that failed.
            </p>
            <pre style={{
              whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: 14,
              borderRadius: 9, background: "#fff5f1", color: "#84213a",
              border: "1px solid #f0d4ce", fontSize: 13
            }}>{message}</pre>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
              <a href="/designs" style={{
                display: "inline-block", padding: "10px 15px", borderRadius: 8,
                background: "#8e1230", color: "#fff", textDecoration: "none", fontWeight: 700
              }}>Open Jewellery Designs</a>
              <button type="button" onClick={() => window.location.reload()} style={{
                padding: "10px 15px", borderRadius: 8, border: "1px solid #d7bd92",
                background: "#fff9ed", color: "#6e4b17", fontWeight: 700, cursor: "pointer"
              }}>Reload application</button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <RealtimeProvider>
            <App/>
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
)
