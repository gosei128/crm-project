import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import LoginScreen from "./screens/Login";
import Landing from "./screens/Landing";
import AppLayout from "./screens/AppLayout";
import Book from "./screens/Book";
import Schedule from "./screens/Schedule";
import { AuthProvider } from "./lib/auth";
import { AuthLoading, RequireOwner } from "./components/auth/Guards";

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
          <Route path="/" element={<Landing />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/book" element={<Book />} />
          <Route path="/login" element={<LoginScreen />} />

          {/* Owner login — the only login on the site (admin) */}
          <Route path="/login" element={<LoginScreen />} />

          {/* Legacy customer area (removed — booking needs no account).
              Old bookmarks/phones land on the homepage. */}
          <Route path="/customer" element={<Navigate to="/" replace />} />

          {/* Owner / admin area */}
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

          {/* Unknown paths fall back to the public landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
