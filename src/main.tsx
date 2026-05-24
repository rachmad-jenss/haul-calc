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
import Compare from "@/routes/Compare";
import "@fontsource-variable/google-sans-flex/wght.css";
import "@/styles/globals.css";

const wrap = (el: React.ReactElement) => <ErrorBoundary>{el}</ErrorBoundary>;

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: wrap(<Dashboard />) },
      { path: "fleet", element: wrap(<FleetTraffic />) },
      { path: "pavement", element: wrap(<PavementDesign />) },
      { path: "economics", element: wrap(<Economics />) },
      { path: "reports", element: wrap(<Reports />) },
      { path: "sensitivity", element: wrap(<SensitivityAnalysis />) },
      { path: "compare", element: wrap(<Compare />) },
      { path: "settings", element: wrap(<Settings />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: "border border-border bg-card text-foreground shadow-md",
            title: "text-strong font-medium",
            description: "text-subtle",
            actionButton: "bg-primary text-primary-foreground",
            cancelButton: "bg-muted text-foreground",
            closeButton: "bg-background border-border text-subtle",
          },
        }}
      />
    </ErrorBoundary>
  </React.StrictMode>,
);
