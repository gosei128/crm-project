import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import LoginScreen from "./screens/Login";
import FacebookFinish from "./screens/FacebookFinish";
import AppLayout from "./screens/AppLayout";
import Book from "./screens/Book";
import Schedule from "./screens/Schedule";
import CustomerDashboard from "./screens/CustomerDashboard";
import { AuthProvider } from "./lib/auth";
import {
  AuthLoading,
  RequireCustomer,
  RequireOwner,
} from "./components/auth/Guards";

// Owner workspace is code-split so customer/public visitors never download
// it (vercel-react-best-practices: bundle-dynamic-imports, bundle-conditional).
const OwnerDashboard = lazy(() => import("./screens/owner/OwnerDashboard"));
const Bookings = lazy(() => import("./screens/owner/Bookings"));
const ShopControls = lazy(() => import("./screens/owner/ShopControls"));

function OwnerFallback() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <AppLayout />
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public client-facing pages — no login required */}
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/book" element={<Book />} />

          {/* Customer area — strict separation: owners redirect to /dashboard */}
          <Route
            path="/customer"
            element={
              <RequireCustomer>
                <CustomerDashboard />
              </RequireCustomer>
            }
          />

          {/* Owner / admin area — strict separation: customers redirect to /customer */}
          <Route path="/" element={<LoginScreen />} />
          <Route path="/auth/facebook/finish" element={<FacebookFinish />} />
          <Route
            element={
              <RequireOwner>
                <OwnerFallback />
              </RequireOwner>
            }
          >
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<AuthLoading />}>
                  <OwnerDashboard />
                </Suspense>
              }
            />
            <Route
              path="/bookings"
              element={
                <Suspense fallback={<AuthLoading />}>
                  <Bookings />
                </Suspense>
              }
            />
            <Route
              path="/controls"
              element={
                <Suspense fallback={<AuthLoading />}>
                  <ShopControls />
                </Suspense>
              }
            />
            {/* Legacy routes: single-haircut shop merged into Shop Controls */}
            <Route path="/services" element={<Navigate to="/controls" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
