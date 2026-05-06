import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import ManagerDashboard from "../Dashboard";
import Workers from "../Workers";
import FlagHistory from "../FlagHistory";
import FlagDisruption from "../FlagDisruption";
import { ManagerProvider } from "./context/ManagerContext";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    () => localStorage.getItem("managerLoggedIn") === "true",
  );

  const handleLogin = () => {
    localStorage.setItem("managerLoggedIn", "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("managerLoggedIn");
    setIsLoggedIn(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Login route — always shows the login form regardless of auth state */}
        <Route
          path="/manager/login"
          element={<LoginPage onLogin={handleLogin} />}
        />

        {/* Dashboard */}
        <Route
          path="/manager/dashboard"
          element={
            isLoggedIn ? (
              <ManagerProvider>
                <ManagerDashboard />
              </ManagerProvider>
            ) : (
              <Navigate to="/manager/login" replace />
            )
          }
        />

        {/* Workers list */}
        <Route
          path="/manager/workers"
          element={
            isLoggedIn ? (
              <ManagerProvider>
                <Workers />
              </ManagerProvider>
            ) : (
              <Navigate to="/manager/login" replace />
            )
          }
        />

        {/* Flag history */}
        <Route
          path="/manager/flag-history"
          element={
            isLoggedIn ? (
              <ManagerProvider>
                <FlagHistory />
              </ManagerProvider>
            ) : (
              <Navigate to="/manager/login" replace />
            )
          }
        />

        {/* Flag a disruption */}
        <Route
          path="/manager/flag-disruption"
          element={
            isLoggedIn ? (
              <ManagerProvider>
                <FlagDisruption />
              </ManagerProvider>
            ) : (
              <Navigate to="/manager/login" replace />
            )
          }
        />

        {/* Catch-all: send authenticated users to dashboard, others to login */}
        <Route
          path="*"
          element={
            <Navigate
              to={isLoggedIn ? "/manager/dashboard" : "/manager/login"}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
