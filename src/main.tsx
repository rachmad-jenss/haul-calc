import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "@/App";
import Dashboard from "@/routes/Dashboard";
import FleetTraffic from "@/routes/FleetTraffic";
import PavementDesign from "@/routes/PavementDesign";
import Economics from "@/routes/Economics";
import Reports from "@/routes/Reports";
import Settings from "@/routes/Settings";
import SensitivityAnalysis from "@/routes/SensitivityAnalysis";
import "@/styles/globals.css";

function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <RouteErrorBoundary><Dashboard /></RouteErrorBoundary> },
      { path: "fleet", element: <RouteErrorBoundary><FleetTraffic /></RouteErrorBoundary> },
      { path: "pavement", element: <RouteErrorBoundary><PavementDesign /></RouteErrorBoundary> },
      { path: "economics", element: <RouteErrorBoundary><Economics /></RouteErrorBoundary> },
      { path: "reports", element: <RouteErrorBoundary><Reports /></RouteErrorBoundary> },
      { path: "sensitivity", element: <RouteErrorBoundary><SensitivityAnalysis /></RouteErrorBoundary> },
      { path: "settings", element: <RouteErrorBoundary><Settings /></RouteErrorBoundary> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </ErrorBoundary>
  </React.StrictMode>,
);
