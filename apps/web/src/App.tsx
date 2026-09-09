import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import LoginScreen from "./screens/Login";
import AppLayout from "./screens/AppLayout";
import OwnerDashboard from "./screens/owner/OwnerDashboard";
import Bookings from "./screens/owner/Bookings";
import ShopControls from "./screens/owner/ShopControls";
import Book from "./screens/Book";
import Schedule from "./screens/Schedule";
import CustomerDashboard from "./screens/CustomerDashboard";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public client-facing schedule page — no login required */}
        <Route path="/schedule" element={<Schedule />} />

        {/* Public client-facing booking page — no login required */}
        <Route path="/book" element={<Book />} />

        {/* Customer dashboard (authenticated) */}
        <Route path="/customer" element={<CustomerDashboard />} />

        {/* Owner / admin area */}
        <Route path="/" element={<LoginScreen />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<OwnerDashboard />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/controls" element={<ShopControls />} />
          {/* Legacy routes: single-haircut shop merged into Shop Controls */}
          <Route path="/services" element={<Navigate to="/controls" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
