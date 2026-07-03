import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      const t = this.props.t || { bg: "#1a1a2e", tx: "#eee", tx2: "#888", acc: "#7c5cfc" };
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: t.bg, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚙</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.tx, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: t.tx2, maxWidth: 400, lineHeight: 1.5, marginBottom: 20 }}>
            An unexpected error occurred. Your data is safe — projects are saved automatically.
          </div>
          <button onClick={() => window.location.reload()}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: t.acc, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
