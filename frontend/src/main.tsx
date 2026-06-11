import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./app/ThemeContext";
import App from "./app/App.tsx";
import "./styles/index.css";
import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error: error?.message || String(error) };
  }
  componentDidCatch(error: any, info: any) {
    console.error("APP CRASH:", error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            background: "#1a0a0a",
            color: "#ff6b6b",
            padding: "32px",
            fontFamily: "monospace",
            minHeight: "100vh",
            whiteSpace: "pre-wrap",
          }}
        >
          <h1
            style={{ color: "#ff4444", fontSize: "20px", marginBottom: "16px" }}
          >
            🔴 App Crash Caught
          </h1>
          <pre style={{ fontSize: "13px", lineHeight: 1.6 }}>
            {this.state.error}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </ErrorBoundary>,
);
