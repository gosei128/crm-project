import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LoginScreen from "./screens/Login";
import AppLayout from "./screens/AppLayout";
import Dashboard from "./screens/Dashboard";
import Services from "./screens/Services";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/services" element={<Services />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
