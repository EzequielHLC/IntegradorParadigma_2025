import { db } from './firebase';
import {
  collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  arrayUnion, arrayRemove, runTransaction, writeBatch,
  query, where, getDocs, orderBy, serverTimestamp, limit,
  onSnapshot
} from 'firebase/firestore';

/*
  services.js - Funciones compartidas para operaciones en Firestore
  Incluye:
  ✔ creación / unión / abandono de grupos
  ✔ asignación / desasignación de usuarios a tareas
  ✔ tareas personales y grupales
  ✔ limpieza de cuentas
  ✔ chat grupal
*/

// ======================================================
//                     G R U P O S
// ======================================================

export const createGroup = async (userId, groupName, accessCode, completionMode) => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('name', '==', groupName));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    throw new Error(`El nombre de grupo "${groupName}" ya existe.`);
  }

  const groupRef = await addDoc(collection(db, 'groups'), {
    name: groupName,
    accessCode,
    ownerId: userId,
    completionMode: completionMode || 'single',
    members: [userId],
    customTags: ['Grupo', 'Urgente'],
    createdAt: new Date().toISOString()
  });

  await updateDoc(doc(db, 'users', userId), {
    groups: arrayUnion(groupRef.id)
  });

  return groupRef.id;
};

export const joinGroup = async (userId, groupName, inputCode) => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('name', '==', groupName));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error("No existe un grupo con ese nombre.");
  }

  const groupDoc = querySnapshot.docs[0];
  const groupData = groupDoc.data();
  const groupId = groupDoc.id;

  if (groupData.accessCode !== inputCode) {
    throw new Error("Contraseña incorrecta.");
  }

  if (groupData.members?.includes(userId)) {
    throw new Error("Ya eres miembro de este grupo.");
  }

  const groupRef = doc(db, 'groups', groupId);
  const userRef = doc(db, 'users', userId);

  // === UNIÓN ATÓMICA ===
  await runTransaction(db, async (transaction) => {
    transaction.update(groupRef, { members: arrayUnion(userId) });
    transaction.update(userRef, { groups: arrayUnion(groupId) });
  });

  // === NOTIFICACIÓN DE ENTRADA ===
  try {
    const userSnap = await getDoc(userRef);
    const rawName = userSnap.exists()
      ? (userSnap.data().username || userSnap.data().email || "Usuario")
      : "Usuario";

    const shortName = rawName.includes('@') ? rawName.split('@')[0] : rawName;

    await addDoc(collection(db, 'groups', groupId, 'messages'), {
      text: `${shortName} se ha unido al grupo.`,
      uid: 'system',
      displayName: 'Sistema',
      system: true,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Error creando notificación de entrada al grupo:', err);
  }

  return groupId;
};

export const leaveGroup = async (userId, groupId) => {
  // 1. Obtener datos del usuario para mostrar notificación
  let rawName = "Usuario";
  try {
    const uref = doc(db, "users", userId);
    const usnap = await getDoc(uref);
    if (usnap.exists()) {
      const ud = usnap.data();
      rawName = ud.username || ud.email || rawName;
    }
  } catch (err) {
    console.error("Error obteniendo nombre de usuario:", err);
  }

  const shortName = rawName.includes("@")
    ? rawName.split("@")[0]
    : rawName;

  // 2. Referencias
  const groupRef = doc(db, "groups", groupId);
  const userRef = doc(db, "users", userId);
  const tasksRef = collection(db, "groups", groupId, "tasks");

  const groupSnap = await getDoc(groupRef);
  const groupData = groupSnap.data();

  const batch = writeBatch(db);

  // 3. Quitar del grupo
  batch.update(groupRef, { members: arrayRemove(userId) });
  batch.update(userRef, { groups: arrayRemove(groupId) });

  // 4. Procesar tareas del grupo
  const tasksSnap = await getDocs(tasksRef);

  tasksSnap.forEach(taskDoc => {
    const task = taskDoc.data();
    const tRef = taskDoc.ref;

    // Si es colaborativo (single) y la tarea fue creada por el usuario → se borra
    if (groupData.completionMode === "single" && task.createdBy === userId) {
      batch.delete(tRef);
      return;
    }

    // En ALL o SINGLE → quitar al usuario de assignedTo
    if (task.assignedTo?.includes(userId)) {
      batch.update(tRef, {
        assignedTo: task.assignedTo.filter(uid => uid !== userId)
      });
    }

    // Quitar de completedBy
    if (task.completedBy?.includes(userId)) {
      batch.update(tRef, {
        completedBy: task.completedBy.filter(uid => uid !== userId)
      });
    }
  });

  await batch.commit();

  // 5. Notificación
  try {
    const messagesRef = collection(db, "groups", groupId, "messages");
    await addDoc(messagesRef, {
      text: `${shortName} ha abandonado el grupo.`,
      uid: "system",
      displayName: "Sistema",
      system: true,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error creando notificación de salida:", err);
  }
};


export const deleteGroup = async (groupId) => {
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;

  const groupData = groupSnap.data();
  const members = groupData.members || [];

  const batch = writeBatch(db);

  // Quitar grupo de cada usuario
  members.forEach(uid => {
    batch.update(doc(db, 'users', uid), {
      groups: arrayRemove(groupId)
    });
  });

  // Borrar grupo
  batch.delete(groupRef);
  await batch.commit();
};

// ======================================================
//                       T A R E A S
// ======================================================

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

// ======================================================
//          A S I G N A C I Ó N   D E   U S U A R I O S
// ======================================================

export const assignUserToTask = async (groupId, taskId, targetUserId, requesterId) => {
  const taskRef = doc(db, "groups", groupId, "tasks", taskId);
  const groupRef = doc(db, "groups", groupId);

  const taskSnap = await getDoc(taskRef);
  const groupSnap = await getDoc(groupRef);

  if (!taskSnap.exists() || !groupSnap.exists()) return;

  const task = taskSnap.data();
  const group = groupSnap.data();

  if (group.completionMode === 'all') {
    throw new Error("En grupos estrictos no se puede asignar usuarios.");
  }

  if (task.createdBy !== requesterId) {
    throw new Error("Solo el creador puede asignar usuarios.");
  }

  if (!group.members.includes(targetUserId)) {
    throw new Error("El usuario no pertenece al grupo.");
  }

  const updated = task.assignedTo || [];

  if (!updated.includes(targetUserId)) {
    updated.push(targetUserId);
  }

  await updateDoc(taskRef, { assignedTo: updated });
};

export const unassignUserFromTask = async (groupId, taskId, targetUserId, requesterId) => {
  const taskRef = doc(db, "groups", groupId, "tasks", taskId);
  const groupRef = doc(db, "groups", groupId);

  const taskSnap = await getDoc(taskRef);
  const groupSnap = await getDoc(groupRef);

  if (!taskSnap.exists() || !groupSnap.exists()) return;

  const task = taskSnap.data();
  const group = groupSnap.data();

  if (group.completionMode === 'all') {
    throw new Error("En grupos estrictos no se puede desasignar usuarios.");
  }

  if (task.createdBy !== requesterId) {
    throw new Error("Solo el creador puede desasignar usuarios.");
  }

  const updated = (task.assignedTo || []).filter(uid => uid !== targetUserId);

  await updateDoc(taskRef, { assignedTo: updated });
};

// ======================================================
//                       C H A T
// ======================================================

export const sendGroupMessage = async (groupId, user, text) => {
  if (!text.trim()) return;

  const rawName = user.displayName || user.email || "Usuario";
  const displayName = rawName.includes('@') ? rawName.split('@')[0] : rawName;

  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    text,
    uid: user.uid,
    displayName,
    createdAt: serverTimestamp()
  });
};

export const subscribeToGroupMessages = (groupId, callback, onError) => {
  const messagesRef = collection(db, 'groups', groupId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(messages);
    },
    (err) => {
      console.error("Error escuchando mensajes:", err);
      if (onError) onError(err);
    }
  );
};

// ======================================================
//                   C U E N T A   D E   U S U A R I O
// ======================================================

export const resetPersonalTasks = async (userId) => {
  const tasksRef = collection(db, `users/${userId}/tasks`);
  const snapshot = await getDocs(tasksRef);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
};

export const deleteUserAccountData = async (userId) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const groupIds = userData.groups || [];

  const batch = writeBatch(db);

  for (const groupId of groupIds) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (groupSnap.exists()) {
      const groupData = groupSnap.data();

      if (groupData.ownerId === userId) {
        batch.delete(groupRef);
      } else {
        batch.update(groupRef, { members: arrayRemove(userId) });
      }
    }
  }

  const tasksQuery = await getDocs(collection(db, `users/${userId}/tasks`));
  tasksQuery.forEach(t => batch.delete(t.ref));

  batch.delete(userRef);

  await batch.commit();
};
