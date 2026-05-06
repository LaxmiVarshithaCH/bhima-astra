import React, { useState } from "react";
import { WorkerProvider } from "./context/WorkerContext";
import { LanguageProvider } from "./context/LanguageContext";
import { clearToken } from "./services/api";
import { ManagerProvider } from "../../manager/src/context/ManagerContext";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

// ── CSS strings (processed by Vite + PostCSS/Tailwind, injected dynamically) ──
import landingCSS from "../../landingPage/bhima-astra/src/index.css?inline";
import workerCSS from "./index.css?inline";
import managerCSS from "../../manager/ui/index.css?inline";
import adminCSS from "../../admin/src/styles/index.css?inline";

// ── CSS isolation component ────────────────────────────────────────────────────
import CSSSection from "./CSSSection";

// ── Landing page ──────────────────────────────────────────────────────────────
import LandingApp from "../../landingPage/bhima-astra/src/App";

// ── Worker components ─────────────────────────────────────────────────────────
import WorkerLoginPage from "./components/LoginPage";
import WorkerDashboard from "./components/Dashboard";
import { LoadingProvider } from "./context/LoadingContext";

// ── Admin ─────────────────────────────────────────────────────────────────────
import AdminApp from "../../admin/src/App";

// ── Manager components ────────────────────────────────────────────────────────
import ManagerLoginPage from "../../manager/src/LoginPage";
import ManagerDashboard from "../../manager/Dashboard";
import ManagerWorkers from "../../manager/Workers";
import ManagerFlagHistory from "../../manager/FlagHistory";
import ManagerFlagDisruption from "../../manager/FlagDisruption";

// ─────────────────────────────────────────────────────────────────────────────
//  WORKER SECTION
// ─────────────────────────────────────────────────────────────────────────────
const WorkerSection: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [loggedIn, setLoggedIn] = useState<boolean>(
    () => localStorage.getItem("isLoggedIn") === "true",
  );

  const isLoginRoute = location.pathname === "/worker";

  const handleLogin = () => {
    localStorage.setItem("isLoggedIn", "true");
    setLoggedIn(true);
    navigate("/dashboard");
  };

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
    navigate("/worker");
  };

  if (isLoginRoute || !loggedIn) {
    return (
      <LoadingProvider>
        <WorkerLoginPage onLogin={handleLogin} />
      </LoadingProvider>
    );
  }

  return (
    <LanguageProvider>
      <WorkerProvider>
        <LoadingProvider>
          <WorkerDashboard onLogout={handleLogout} />
        </LoadingProvider>
      </WorkerProvider>
    </LanguageProvider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MANAGER AUTH HELPER
// ─────────────────────────────────────────────────────────────────────────────
const managerLoggedIn = (): boolean =>
  localStorage.getItem("managerLoggedIn") === "true";

const ManagerPage: React.FC<{ Component: React.ComponentType }> = ({
  Component,
}) => {
  if (!managerLoggedIn()) {
    return <Navigate to="/manager/login" replace />;
  }
  return (
    <CSSSection id="manager" css={managerCSS}>
      <ManagerProvider>
        <Component />
      </ManagerProvider>
    </CSSSection>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  WORKER PATHS
// ─────────────────────────────────────────────────────────────────────────────
const WORKER_PATHS = [
  "/worker",
  "/dashboard",
  "/policy",
  "/payouts",
  "/forecasts",
  "/plans",
  "/profile",
];

// ─────────────────────────────────────────────────────────────────────────────
//  APP CONTENT
//
//  Key architectural decision:
//  AdminApp renders its OWN <Routes> internally (path="/admin", etc.).
//  If we put it inside a parent <Route path="/admin/*">, React Router v6
//  gives the inner <Routes> the REMAINING path (empty string for bare /admin)
//  so none of the admin's routes ever match → blank page.
//
//  Solution: detect /admin via useLocation() and render AdminApp OUTSIDE
//  the main <Routes> entirely.  Its internal <Routes> then receives the FULL
//  URL pathname (/admin, /admin/live-triggers, …) and matches correctly.
//
//  The main <Routes> below includes a catch-all that deliberately ignores
//  /admin paths so they are never redirected to "/".
// ─────────────────────────────────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  // ── Admin: render outside <Routes> so internal routing sees full path ──
  if (isAdmin) {
    return (
      <CSSSection id="admin" css={adminCSS}>
        <AdminApp />
      </CSSSection>
    );
  }

  // ── All other sections ────────────────────────────────────────────────
  return (
    <Routes>
      {/* Landing Page */}
      <Route
        path="/"
        element={
          <CSSSection id="landing" css={landingCSS}>
            <LandingApp />
          </CSSSection>
        }
      />

      {/* Worker Section (login + all dashboard tab routes) */}
      {WORKER_PATHS.map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <CSSSection id="worker" css={workerCSS}>
              <WorkerSection />
            </CSSSection>
          }
        />
      ))}

      {/* Manager: Login */}
      <Route
        path="/manager/login"
        element={
          <CSSSection id="manager" css={managerCSS}>
            <ManagerLoginPage
              onLogin={() => {
                /* JWT + metadata already stored by LoginPage.handleSubmit */
                localStorage.setItem("managerLoggedIn", "true");
              }}
            />
          </CSSSection>
        }
      />

      {/* Manager: Protected pages */}
      <Route
        path="/manager/dashboard"
        element={<ManagerPage Component={ManagerDashboard} />}
      />
      <Route
        path="/manager/workers"
        element={<ManagerPage Component={ManagerWorkers} />}
      />
      <Route
        path="/manager/flag-history"
        element={<ManagerPage Component={ManagerFlagHistory} />}
      />
      <Route
        path="/manager/flag-disruption"
        element={<ManagerPage Component={ManagerFlagDisruption} />}
      />

      {/* Catch-all → home (admin paths are handled above, never reach here) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
