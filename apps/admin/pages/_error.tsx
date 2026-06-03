// Custom error page — hook-free to avoid React dual-instance issues in
// pnpm monorepos where pages/_error is SSR-rendered with a different React
// instance than the app's local node_modules/react.
import type { NextPageContext } from "next";

interface Props { statusCode?: number }

function ErrorPage({ statusCode }: Props) {
  return (
    <div style={{ fontFamily: "sans-serif", background: "#000", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 64, fontWeight: 900, margin: 0, color: "#E85068" }}>{statusCode || "Error"}</h1>
        <p style={{ color: "#6B6B6B", marginTop: 8 }}>
          {statusCode === 404 ? "Page not found" : statusCode === 500 ? "Internal server error" : "An error occurred"}
        </p>
        <a href="/dashboard" style={{ color: "#E85068", fontSize: 14 }}>← Go to dashboard</a>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
