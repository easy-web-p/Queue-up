import React from "react";

/**
 * SILENT ERROR BOUNDARY
 * Prevents error popups or dialog cards from blocking the user screen.
 * Always renders children cleanly.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: false };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("Silent ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    return this.props.children;
  }
}
