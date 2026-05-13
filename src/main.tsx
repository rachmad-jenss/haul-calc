import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "@/App";
import FleetTraffic from "@/routes/FleetTraffic";
import PavementDesign from "@/routes/PavementDesign";
import Economics from "@/routes/Economics";
import Reports from "@/routes/Reports";
import Settings from "@/routes/Settings";
import SensitivityAnalysis from "@/routes/SensitivityAnalysis";
import "@/styles/globals.css";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/fleet" replace /> },
      { path: "fleet", element: <FleetTraffic /> },
      { path: "pavement", element: <PavementDesign /> },
      { path: "economics", element: <Economics /> },
      { path: "reports", element: <Reports /> },
      { path: "sensitivity", element: <SensitivityAnalysis /> },
      { path: "settings", element: <Settings /> },
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
