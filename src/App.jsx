import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import OrderPage from './pages/OrderPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* The first page that opens */}
        <Route path="/" element={<LandingPage />} /> 
        
        {/* Other pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/vendor-dashboard" element={<VendorDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

         <Route path="/order" element={<OrderPage />} />

        <Route path="/order" element={<OrderPage />} />

      </Routes>
    </Router>
  );
}

export default App;