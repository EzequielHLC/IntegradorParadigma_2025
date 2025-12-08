import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, Layout, User, Lock, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState(''); // Puede ser usuario o email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validación simple de nombre de usuario (sin espacios, etc) si es registro
    if (!isLogin && identifier.includes('@')) {
       setError("Para registrarte usa un nombre de usuario, no un email.");
       return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(identifier, password);
      } else {
        await signup(identifier, password);
      }
    } catch (err) {
      console.error(err);
      let msg = 'Error de autenticación';
      if (err.code === 'auth/email-already-in-use') msg = 'El nombre de usuario ya está ocupado.';
      if (err.code === 'auth/invalid-login-credentials') msg = 'Usuario o contraseña incorrectos.';
      if (err.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-black text-white rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-gray-200">
            <Layout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{isLogin ? 'Bienvenido' : 'Crear Cuenta'}</h1>
          <p className="text-sm text-gray-500 mt-2">
            {isLogin ? 'Ingresa tus credenciales para continuar' : 'Elige un nombre de usuario único'}
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                {isLogin ? 'Usuario o Email' : 'Usuario'}
            </label>
            <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder={isLogin ? "Ej. juanperez" : "Elige tu usuario"} 
                  required 
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                  value={identifier} 
                  onChange={e => setIdentifier(e.target.value.trim())} 
                />
            </div>
          </div>

          <div className="space-y-1">
             <label className="text-xs font-bold text-gray-500 uppercase ml-1">Contraseña</label>
             <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                />
             </div>
          </div>
          
          <button disabled={loading} className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-all flex justify-center items-center gap-2 shadow-lg shadow-gray-200">
            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : (isLogin ? <><LogIn className="w-4 h-4"/> Iniciar Sesión</> : <><UserPlus className="w-4 h-4"/> Registrarse</>)}
          </button>
        </form>

        <div className="mt-6 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); setIdentifier(''); }} className="text-sm text-gray-500 hover:text-black hover:underline transition-colors">
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
        </div>
      </div>
    </div>
  );
}