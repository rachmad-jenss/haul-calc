import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import App from "@/App";
import FleetTraffic from "@/routes/FleetTraffic";
import PavementDesign from "@/routes/PavementDesign";
import Economics from "@/routes/Economics";
import Reports from "@/routes/Reports";
import Settings from "@/routes/Settings";
import "@/styles/globals.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/fleet" replace /> },
      { path: "fleet", element: <FleetTraffic /> },
      { path: "pavement", element: <PavementDesign /> },
      { path: "economics", element: <Economics /> },
      { path: "reports", element: <Reports /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <Toaster richColors position="top-right" />
  </React.StrictMode>,
);
