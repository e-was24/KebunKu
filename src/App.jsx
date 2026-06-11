import { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route index element={<LandingPage />} />

        <Route path="/" element={<LandingPage />} />
        <Route path="/petani" element={<h1>tes petani</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;