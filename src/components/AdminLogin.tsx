import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { LogIn } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] border border-white/10 p-8 rounded-2xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl mb-2 italic">Opal Admin</h1>
          <p className="text-white/50 text-sm">Secure access for managers</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 focus:border-white/30 outline-none transition-colors"
              placeholder="manager@restaurant.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-white/40 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 focus:border-white/30 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            Sign In
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#111] px-2 text-white/30">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full border border-white/10 py-3 rounded-lg hover:bg-white/5 transition-colors text-sm"
        >
          Google Account
        </button>
      </motion.div>
    </div>
  );
}
