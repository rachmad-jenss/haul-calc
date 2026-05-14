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
      { path: "settings", element: wrap(<Settings />) },
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
