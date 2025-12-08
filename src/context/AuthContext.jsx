import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  verifyBeforeUpdateEmail, // Función de Firebase para enviar verificación al nuevo email
  deleteUser // Función para eliminar al usuario desde Authentication
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();
const DOMAIN_SUFFIX = "@taskflow.local";

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const formatIdentifier = (identifier) => {
    if (identifier.includes('@')) return identifier;
    return `${identifier}${DOMAIN_SUFFIX}`;
  };

  const signup = async (username, password) => {
    const emailFake = formatIdentifier(username);
    const userCredential = await createUserWithEmailAndPassword(auth, emailFake, password);
    
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      username: username,
      email: null,
      groups: [],
      createdAt: new Date().toISOString()
    });
    
    return userCredential;
  };

  const login = (identifier, password) => {
    const email = formatIdentifier(identifier);
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => signOut(auth);

  /*
    linkRealEmail(newEmail): Envia un correo de verificación al email real
    proporcionado por el usuario. Firebase requiere que el usuario confirme
    el enlace antes de actualizar su dirección en Authentication.

    También actualizamos el documento de Firestore del usuario para reflejar
    el email introducido (campo `email`) y marcar `emailVerified: false` hasta
    que el usuario confirme desde su bandeja.
  */
  const linkRealEmail = async (newEmail) => {
    if (!user) throw new Error("No hay sesión activa");

    await verifyBeforeUpdateEmail(user, newEmail);

    await setDoc(doc(db, 'users', user.uid), { 
        email: newEmail,
        emailVerified: false 
    }, { merge: true });
  };
  

  // Función para borrar el usuario de Authentication
  const deleteAuthUser = async () => {
    if (user) {
      await deleteUser(user);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      signup, 
      login, 
      logout, 
      linkRealEmail, 
      verifyBeforeUpdateEmail,
      deleteAuthUser, // <--- Agregado
      loading 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};