import { db } from './firebase';
import { 
  collection, doc, addDoc, getDoc, updateDoc, deleteDoc, 
  arrayUnion, arrayRemove, runTransaction, writeBatch,
  query, where, getDocs 
} from 'firebase/firestore';

/*
  services.js - Funciones compartidas para operaciones en Firestore

  Incluye utilidades relacionadas con grupos y tareas que se usan desde
  la UI (crear, unirse, salir, eliminar grupos) y operaciones sobre tareas.
  También contiene funciones de limpieza y borrado para cuentas de usuario.
*/

// --- GRUPOS ---

export const createGroup = async (userId, groupName, accessCode, completionMode) => {
  // 1. VALIDACIÓN: Verificar que el nombre NO exista ya
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('name', '==', groupName));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    throw new Error(`El nombre de grupo "${groupName}" ya existe. Elige otro.`);
  }

  // 2. CREACIÓN
  const groupRef = await addDoc(collection(db, 'groups'), {
    name: groupName,
    accessCode: accessCode,
    ownerId: userId,
    completionMode: completionMode || 'single', 
    members: [userId],
    customTags: ['Grupo', 'Urgente'],
    createdAt: new Date().toISOString()
  });
  
  // 3. VINCULACIÓN: Agregar referencia al creador
  await updateDoc(doc(db, 'users', userId), {
    groups: arrayUnion(groupRef.id)
  });
  return groupRef.id;
};

export const joinGroup = async (userId, groupName, inputCode) => {
  // 1. BÚSQUEDA: Buscar el grupo por NOMBRE (no por ID)
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('name', '==', groupName));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error("No existe un grupo con ese nombre.");
  }

  const groupDoc = querySnapshot.docs[0]; // Tomamos el primero encontrado
  const groupData = groupDoc.data();
  const groupId = groupDoc.id;

  // 2. VALIDACIONES
  if (groupData.accessCode !== inputCode) {
    throw new Error("Contraseña de grupo incorrecta.");
  }

  if (groupData.members?.includes(userId)) {
    throw new Error("Ya eres miembro de este grupo.");
  }
  
  // 3. UNIÓN ATÓMICA
  const groupRef = doc(db, 'groups', groupId);
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    transaction.update(groupRef, { members: arrayUnion(userId) });
    transaction.update(userRef, { groups: arrayUnion(groupId) });
  });

  return groupId;
};

export const leaveGroup = async (userId, groupId) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', groupId);
  const userRef = doc(db, 'users', userId);

  batch.update(groupRef, { members: arrayRemove(userId) });
  batch.update(userRef, { groups: arrayRemove(groupId) });
  
  await batch.commit();
};

export const deleteGroup = async (groupId) => {
  // 1. Obtener datos del grupo ANTES de borrarlo para tener la lista de miembros
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);

  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data();
  const members = groupData.members || [];

  const batch = writeBatch(db);

  // 2. Recorrer a TODOS los miembros y quitarles el ID del grupo de su perfil
  // Al hacer esto, el onSnapshot que cada usuario tiene en su App.jsx (línea 50 aprox)
  // detectará el cambio en su perfil y quitará el grupo de la barra lateral automáticamente.
  members.forEach(memberId => {
    const userRef = doc(db, 'users', memberId);
    batch.update(userRef, { 
        groups: arrayRemove(groupId) 
    });
  });

  // 3. Finalmente, borrar el grupo
  batch.delete(groupRef);
  
  // 4. Ejecutar todo junto
  await batch.commit();
};

// --- TAREAS (Lógica compartida sin cambios) ---

export const toggleTaskCompletion = async (path, taskId, userId, currentStatus, completionMode) => {
  const taskRef = doc(db, path, taskId);
  
  if (completionMode === 'all') {
    if (currentStatus.completedBy?.includes(userId)) {
      await updateDoc(taskRef, { completedBy: arrayRemove(userId) });
    } else {
      await updateDoc(taskRef, { completedBy: arrayUnion(userId) });
    }
  } else {
    const newStatus = !currentStatus.completed;
    await updateDoc(taskRef, { 
      completed: newStatus,
      completedBy: newStatus ? arrayUnion(userId) : [], 
      completedAt: newStatus ? new Date().toISOString() : null
    });
  }
};

// --- FUNCIONES DE LIMPIEZA DE USUARIO ---

// 1. Reiniciar Tareas Personales
export const resetPersonalTasks = async (userId) => {
  const tasksRef = collection(db, `users/${userId}/tasks`);
  const snapshot = await getDocs(tasksRef);
  
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
};

// 2. Eliminar Datos del Usuario (Firestore)
export const deleteUserAccountData = async (userId) => {
  // A. Obtener datos del usuario para ver sus grupos
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const groupIds = userData.groups || [];

  const batch = writeBatch(db);

  // B. Manejo de Grupos:
  // Recorremos los grupos a los que pertenece
  for (const groupId of groupIds) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      
      if (groupData.ownerId === userId) {
        // OPCIÓN 1: Si es el DUEÑO, borramos el grupo entero (más limpio)
        // Nota: Esto deja referencias huérfanas en otros usuarios, 
        // pero el sistema de "Auto-Limpieza" en App.jsx lo arregla.
        batch.delete(groupRef); 
      } else {
        // OPCIÓN 2: Si es MIEMBRO, solo lo sacamos de la lista
        batch.update(groupRef, { members: arrayRemove(userId) });
      }
    }
  }

  // C. Borrar Tareas Personales (Subcolección)
  const tasksQuery = await getDocs(collection(db, `users/${userId}/tasks`));
  tasksQuery.forEach(tDoc => batch.delete(tDoc.ref));

  // D. Borrar el Documento del Usuario
  batch.delete(userRef);

  await batch.commit();
};

// ------CHAT ----------
import { onSnapshot, orderBy, serverTimestamp, limit } from 'firebase/firestore';

          // Enviar mensaje
export const sendGroupMessage = async (groupId, user, text) => {
  if (!text.trim()) return;
  
  const messagesRef = collection(db, 'groups', groupId, 'messages');
  await addDoc(messagesRef, {
    text: text,
    uid: user.uid,
    displayName: user.displayName || user.email || "Usuario", // Fallback simple
    createdAt: serverTimestamp()
  });
};

// Escuchar mensajes
export const subscribeToGroupMessages = (groupId, callback) => {
  const messagesRef = collection(db, 'groups', groupId, 'messages');
  const q = query(
    messagesRef, 
    orderBy('createdAt', 'asc'), 
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};