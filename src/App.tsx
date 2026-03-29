import { BrowserRouter as Router, Routes, Route, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import MenuPage from './components/MenuPage';
import ManagerDashboard from './components/ManagerDashboard';
import AdminLogin from './components/AdminLogin';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#050505]">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-gold-500 font-serif italic text-2xl"
        >
          Opal
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/admin" element={user ? <ManagerDashboard /> : <AdminLogin />} />
        </Routes>
      </AnimatePresence>
    </Router>
  );
}

