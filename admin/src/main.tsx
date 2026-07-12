import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./layout/Shell";
import { Dashboard } from "./pages/Dashboard";
import { KycPage } from "./pages/Kyc";
import { ShopsPage } from "./pages/Shops";
import { setAdminKey, getAdminKey } from "./api";
import "./styles.css";

if (!getAdminKey()) setAdminKey("harvesthub-admin-dev-key");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="kyc" element={<KycPage />} />
          <Route path="shops" element={<ShopsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
