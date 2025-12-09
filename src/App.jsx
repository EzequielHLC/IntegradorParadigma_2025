import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import { TaskCard } from './components/TaskCard';
import { createGroup, joinGroup, leaveGroup, deleteGroup, toggleTaskCompletion, resetPersonalTasks, deleteUserAccountData } from './services';
import { db } from './firebase';
import { 
    collection, query, orderBy, onSnapshot, addDoc, doc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove 
} from 'firebase/firestore';
import { 
    LogOut, Plus, Users, Layout, MailWarning, Trash2, Home, CheckCircle, AlertTriangle, 
    UserPlus, Search, X, Save, Tag, Hash, Calendar, Settings, AlertOctagon, RotateCcw, MessageCircle
} from 'lucide-react';
import { ChatRoom } from './components/chat/ChatRoom';

/*
    App.jsx - Componente principal de la aplicación TaskFlow

    Contiene la lógica de UI y sincronización con Firestore:
    - Gestión de estado local (contexto actual, tareas, grupos, formularios y UI)
    - Efectos que escuchan documentos/colecciones en tiempo real
    - Operaciones CRUD delegadas a los servicios (crear/unirse/salir/borrar grupos, tareas)

    Comentarios en este archivo: explicativos y en español. No modificar la lógica aquí
    sin revisar también `src/services.js` y `src/context/AuthContext.jsx`.
*/

const DEFAULT_TAGS = ['Trabajo', 'Personal', 'Urgente', 'Idea', 'Hogar'];

export default function App() {
    const { user, logout, linkRealEmail, verifyEmail, deleteAuthUser } = useAuth();
  
  // Estado Global
  const [context, setContext] = useState('personal'); 
  const [tasks, setTasks] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [userProfile, setUserProfile] = useState(null); // Para tags personalizados guardados

  // Estados UI
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Estado Formulario Tarea (RECUPERADO)
  const [formTask, setFormTask] = useState({
    name: '', details: '', dueDate: '', tags: []
  });
  const [newTagInput, setNewTagInput] = useState('');

  // Estado Formulario Grupo
  const [groupFormData, setGroupFormData] = useState({ name: '', code: '', mode: 'create', completionType: 'single' });
  
  // Estado Email
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  
    // Estado Configuración
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // Estado Chat
    const [showChat, setShowChat] = useState(false);

  // 1. Cargar Grupos del Usuario con AUTO-LIMPIEZA
  useEffect(() => {
    if (!user) return;
    
    // Escuchamos cambios en el documento del usuario
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // Actualizamos el perfil local (para tags, username, etc)
            setUserProfile(userData);

            const groupIds = userData.groups || [];
            
            if (groupIds.length > 0) {
                // Obtenemos los documentos de todos los grupos referenciados
                const groupDocs = await Promise.all(groupIds.map(gid => getDoc(doc(db, 'groups', gid))));
                
                const validGroups = [];
                const invalidIds = [];

                // Clasificamos entre grupos vivos y grupos fantasma
                groupDocs.forEach(gDoc => {
                    if (gDoc.exists()) {
                        validGroups.push({ id: gDoc.id, ...gDoc.data() });
                    } else {
                        // Si el documento no existe, guardamos el ID para borrarlo
                        invalidIds.push(gDoc.id);
                    }
                });

                setUserGroups(validGroups);

                // --- LÓGICA DE AUTO-REPARACIÓN ---
                // Si detectamos IDs de grupos que ya no existen, los borramos del usuario
                if (invalidIds.length > 0) {
                    // Si detectamos IDs de grupos que ya no existen, intentar eliminarlos
                    // del array `groups` del usuario para evitar entradas fantasma.
                    try {
                        await updateDoc(doc(db, 'users', user.uid), {
                            groups: arrayRemove(...invalidIds)
                        });
                    } catch (err) {
                        // Registrar error de manera clara para diagnóstico.
                        console.error("Error auto-limpiando grupos:", err);
                    }
                }
            } else {
                setUserGroups([]);
            }
        }
    });
    return () => unsubUser();
  }, [user]);

  // 2. Cargar Tareas según Contexto
  useEffect(() => {
    if (!user) return;
    const collectionPath = context === 'personal' ? `users/${user.uid}/tasks` : `groups/${context.id}/tasks`;
    const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
        setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, context]);

  // --- LÓGICA DE ETIQUETAS ---
  const availableTags = useMemo(() => {
    const custom = userProfile?.customTags || [];
    const groupTags = context !== 'personal' ? (context.customTags || []) : [];
    // Unimos tags por defecto + tags del usuario + tags del grupo actual
    return Array.from(new Set([...DEFAULT_TAGS, ...custom, ...groupTags]));
  }, [userProfile, context]);

  const toggleFormTag = (tag) => {
    setFormTask(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  const handleAddNewTagInput = (e) => {
    e.preventDefault();
    const tag = newTagInput.trim();
    if(tag && !formTask.tags.includes(tag)) {
        setFormTask(prev => ({ ...prev, tags: [...prev.tags, tag] }));
        setNewTagInput('');
    }
  };

  // --- CREAR TAREA (FULL) ---
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!formTask.name.trim()) return;

    try {
        const collectionPath = context === 'personal' ? `users/${user.uid}/tasks` : `groups/${context.id}/tasks`;
        
        // 1. Guardar nuevos tags en el perfil si es personal
        const existingTags = new Set(availableTags);
        const newTagsToSave = formTask.tags.filter(t => !existingTags.has(t));
        
        if (newTagsToSave.length > 0 && context === 'personal') {
            await updateDoc(doc(db, 'users', user.uid), { customTags: arrayUnion(...newTagsToSave) });
        }

        // 2. Guardar Tarea Completa
        await addDoc(collection(db, collectionPath), {
            name: formTask.name,
            details: formTask.details,
            dueDate: formTask.dueDate || null,
            tags: formTask.tags,
            completed: false,
            completedBy: [],
            createdAt: new Date().toISOString()
        });

        setFormTask({ name: '', details: '', dueDate: '', tags: [] });
        setShowAddForm(false);
    } catch (err) {
        console.error(err);
        alert("Error al crear tarea");
    }
  };

  // --- ACCIONES TAREA ---
  const handleTaskToggle = async (task) => {
    const path = context === 'personal' ? `users/${user.uid}/tasks` : `groups/${context.id}/tasks`;
    const mode = context === 'personal' ? 'single' : context.completionMode;
    // Extraemos la colección base de la ruta
    const collectionRef = path.split('/tasks')[0] + '/tasks';
    await toggleTaskCompletion(collectionRef, task.id, user.uid, task, mode);
  };

  const handleDeleteTask = async (taskId) => {
    if(window.confirm('¿Eliminar tarea?')) {
        const path = context === 'personal' ? `users/${user.uid}/tasks` : `groups/${context.id}/tasks`;
        await deleteDoc(doc(db, path, taskId));
    }
  };

  // --- OTRAS ACCIONES (Grupos / Email) ---
  const handleGroupAction = async (e) => { 
    e.preventDefault();
    try {
        if (groupFormData.mode === 'create') await createGroup(user.uid, groupFormData.name, groupFormData.code, groupFormData.completionType);
        else await joinGroup(user.uid, groupFormData.name, groupFormData.code);
        setShowGroupModal(false); setGroupFormData({ name: '', code: '', mode: 'create', completionType: 'single' });
    } catch (err) { alert(err.message); }
  };

  const handleAddEmail = async (e) => { /* ... Lógica existente ... */
    e.preventDefault();
    if(!emailInput.includes('@')) return alert("Email inválido");
    try {
        await linkRealEmail(emailInput);
        setEditingEmail(false);
        alert(`Enlace enviado a ${emailInput}.`);
    } catch (error) { alert(error.message); }
  };

  const handleDeleteGroup = async () => {
    if (!context || context === 'personal') return;
    
    const confirmMessage = `¿Estás seguro de que quieres eliminar el grupo "${context.name}"?\n\nEsta acción no se puede deshacer y eliminará el acceso para todos los miembros.`;
    
    if (window.confirm(confirmMessage)) {
        try {
            await deleteGroup(context.id);
            setContext('personal'); // Volver a inicio
            alert("Grupo eliminado correctamente.");
        } catch (error) {
            console.error(error);
            alert("Error al eliminar el grupo: " + error.message);
        }
    }
  };

  const handleResetTasks = async () => {
    const confirmMsg = "ADVERTENCIA: ¿Estás seguro de que quieres borrar TODAS tus tareas personales?\n\nEsta acción no se puede deshacer.";
    if (window.confirm(confirmMsg)) {
        try {
            await resetPersonalTasks(user.uid);
            alert("Tareas eliminadas correctamente.");
            setShowSettingsModal(false);
        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }
    }
  };

  const handleDeleteAccount = async () => {
    const confirmMsg = "PELIGRO CRÍTICO: \n\n¿Estás seguro de que quieres eliminar tu cuenta PERMANENTEMENTE?\n\n- Se borrarán tus tareas.\n- Se eliminarán los grupos que creaste.\n- Se perderá tu acceso.\n\nEscribe 'ELIMINAR' para confirmar.";
    
    const input = window.prompt(confirmMsg);
    
    if (input === 'ELIMINAR') {
        try {
            // 1. Limpiar datos en Firestore
            await deleteUserAccountData(user.uid);
            // 2. Borrar usuario de Auth
            await deleteAuthUser(); 
            // El usuario será redirigido al login automáticamente por el AuthContext
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Por seguridad, debes cerrar sesión y volver a entrar antes de eliminar tu cuenta.");
            } else {
                alert("Error al eliminar cuenta: " + error.message);
            }
        }
    }
  };

    // --- NUEVO: MONITOR DE INTEGRIDAD DEL GRUPO ACTUAL ---
    // Si estoy en un grupo y alguien (el admin) lo borra, este efecto me detecta
    // que el documento desapareció y me envía a 'personal' automáticamente.
    useEffect(() => {
        if (context === 'personal') return;

        // Escuchamos el documento del grupo actual en tiempo real
        const unsubGroup = onSnapshot(doc(db, 'groups', context.id), (docSnapshot) => {
                // Si el snapshot indica que NO existe, es que fue borrado
                if (!docSnapshot.exists()) {
                        alert(`El grupo "${context.name}" ha sido eliminado por el administrador.`);
                        setContext('personal'); // Expulsión inmediata
            
                        // Opcional: Limpiar localmente la lista para evitar clickear de nuevo
                        setUserGroups(prev => prev.filter(g => g.id !== context.id));
                } else {
                        // Si el grupo se actualizó (ej. cambiaron el nombre), actualizamos el contexto
                        setContext(prev => ({ ...prev, ...docSnapshot.data() }));
                }
        });

        return () => unsubGroup();
    }, [context.id]); // Solo se reinicia si cambio de grupo manualmente

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col md:flex-row">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-4 flex flex-col h-auto md:h-screen sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center"><Layout className="w-4 h-4"/></div>
            <span className="font-bold tracking-tight">TaskFlow</span>
        </div>

        {/* User Info & Verification Block */}
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                    {user.email?.includes('taskflow.local') ? user.email[0].toUpperCase() : user.email?.[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 truncate">
                        {user.email?.includes('taskflow.local') ? user.email.split('@')[0] : user.email}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {user.emailVerified ? 'Verificado' : 'No verificado'}
                    </p>
                </div>
            </div>

            {/* Lógica de Email Opcional */}
            {!user.emailVerified && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    {user.email?.includes('taskflow.local') ? (
                        editingEmail ? (
                            <form onSubmit={handleAddEmail} className="space-y-2">
                                <input 
                                    type="email" 
                                    placeholder="tu@email.com" 
                                    className="w-full text-xs p-1.5 border rounded"
                                    value={emailInput}
                                    onChange={e => setEmailInput(e.target.value)}
                                />
                                <div className="flex gap-1">
                                    <button type="submit" className="flex-1 bg-black text-white text-[10px] py-1 rounded">Guardar</button>
                                    <button type="button" onClick={() => setEditingEmail(false)} className="px-2 bg-gray-200 text-[10px] rounded">X</button>
                                </div>
                            </form>
                        ) : (
                            <button onClick={() => setEditingEmail(true)} className="w-full text-left text-[11px] text-blue-600 hover:underline flex items-center gap-1">
                                <UserPlus className="w-3 h-3" /> Agregar Email de contacto
                            </button>
                        )
                    ) : (
                        <div className="bg-amber-50 text-amber-700 p-2 rounded text-[10px] flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Falta verificar tu correo. Revisa tu bandeja de spam.</span>
                        </div>
                    )}
                </div>
            )}
            
            {user.emailVerified && (
                <div className="mt-2 text-[10px] text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Cuenta protegida
                </div>
            )}
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto">
            <button onClick={() => setContext('personal')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${context === 'personal' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Home className="w-4 h-4" /> Personal
            </button>
            <div className="pt-4 pb-2 text-xs font-bold text-gray-400 uppercase px-3 flex justify-between items-center">
                Grupos <button onClick={() => setShowGroupModal(true)} className="hover:text-black"><Plus className="w-3 h-3" /></button>
            </div>
            {userGroups.map(group => (
                <button key={group.id} onClick={() => setContext(group)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${context.id === group.id ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <Users className="w-4 h-4" /> {group.name}
                </button>
            ))}
                </nav>
                <div className="mt-auto px-2 space-y-1">
                         <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-black hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
                                <Settings className="w-4 h-4" /> Configuración
                        </button>
            
                        <button onClick={logout} className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                                <LogOut className="w-4 h-4" /> Cerrar Sesión
                        </button>
                </div>
            </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">
        <header className="mb-8 flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold">{context === 'personal' ? 'Mis Tareas' : context.name}</h1>
                <p className="text-gray-500 text-sm mt-1">
                    {context === 'personal' ? 'Tu espacio privado' : (
                        <span className="flex items-center gap-2">
                            <span>ID: {context.id}</span>
                            <span>•</span>
                            <span>{context.completionMode === 'all' ? 'Todos deben completar' : 'Colaborativo'}</span>
                        </span>
                    )}
                </p>
            </div>
            
            {/* LÓGICA DE BOTONES DE ADMINISTRACIÓN DE GRUPO */}
            {context !== 'personal' && (
                <div className="flex gap-2">
                   {/* <button 
                        onClick={() => setShowChat(!showChat)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${
                            showChat 
                            ? 'bg-blue-100 text-blue-700 border-blue-200' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <MessageCircle className="w-4 h-4" />
                        {showChat ? 'Ocultar Chat' : 'Chat'}
                    </button>*/}

                    {context.ownerId === user.uid ? (
                        <button 
                            onClick={handleDeleteGroup} 
                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                            title="Eliminar grupo permanentemente"
                        >
                            <Trash2 className="w-4 h-4" />
                            Eliminar Grupo
                        </button>
                    ) : (
                        <button 
                            onClick={() => { 
                                if(window.confirm('¿Salir del grupo?')) {
                                    leaveGroup(user.uid, context.id).then(() => setContext('personal'));
                                }
                            }} 
                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-colors"
                        >
                            <LogOut className="w-3 h-3" />
                            Abandonar
                        </button>
                    )}
                </div>
            )}
        </header>

        {/* CHAT FLOTANTE - Estilo Facebook */}
        {context !== 'personal' && showChat && (
            <div className="fixed bottom-0 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                <ChatRoom 
                    groupId={context.id} 
                    onClose={() => setShowChat(false)} 
                />
            </div>
        )}
        
        {/* BOTÓN FLOTANTE PARA ABRIR CHAT (Opcional, si quieres abrirlo desde abajo también) */}
        {context !== 'personal' && !showChat && (
            <button
                onClick={() => setShowChat(true)}
                className="fixed bottom-4 right-4 z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
                <MessageCircle size={24} />
                <span className="font-medium pr-1">Chat</span>
            </button>
        )}

        {/* BOTÓN NUEVA TAREA (Abre formulario completo) */}
        {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} className="w-full mb-6 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-black hover:text-black transition-colors flex items-center justify-center gap-2 font-medium">
                <Plus className="w-5 h-5" /> Nueva Tarea
            </button>
        ) : (
            // --- FORMULARIO RESTAURADO ---
            <div className="mb-8 bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
                <h3 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-500">Crear Tarea</h3>
                <form onSubmit={handleSaveTask} className="space-y-4">
                    {/* Nombre */}
                    <input required autoFocus className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:bg-white focus:ring-2 focus:ring-black outline-none" 
                        value={formTask.name} onChange={e => setFormTask({...formTask, name: e.target.value})} placeholder="¿Qué hay que hacer?" />
                    
                    {/* Detalles */}
                    <textarea className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm h-20 resize-none focus:bg-white focus:ring-2 focus:ring-black outline-none" 
                        value={formTask.details} onChange={e => setFormTask({...formTask, details: e.target.value})} placeholder="Detalles adicionales..." />

                    {/* Etiquetas */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400"><Tag className="w-3 h-3" /> Etiquetas</div>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map(tag => (
                                <button key={tag} type="button" onClick={() => toggleFormTag(tag)} className={`px-2 py-1 rounded-full text-xs border transition-colors ${formTask.tags.includes(tag) ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'}`}>{tag}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <Hash className="w-3 h-3 text-gray-400" />
                            <input type="text" className="text-xs bg-transparent outline-none w-full placeholder:text-gray-400" placeholder="Nueva etiqueta..." 
                                value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleAddNewTagInput(e); }}
                            />
                        </div>
                    </div>

                    {/* Fecha */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2">
                        <Calendar className="w-4 h-4" />
                        <input type="datetime-local" className="bg-transparent w-full outline-none text-gray-800" value={formTask.dueDate} onChange={e => setFormTask({...formTask, dueDate: e.target.value})} />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="flex-[2] bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center justify-center gap-2"><Save className="w-4 h-4" /> Guardar Tarea</button>
                    </div>
                </form>
            </div>
        )}

        {/* LISTA DE TAREAS */}
        <div className="space-y-2">
            {tasks.map(task => (
                <TaskCard 
                    key={task.id} 
                    task={task} 
                    context={context} 
                    currentUserId={user.uid}
                    onToggle={() => handleTaskToggle(task)}
                    onDelete={() => handleDeleteTask(task.id)}
                />
            ))}
            {tasks.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">No hay tareas pendientes.</div>}
        </div>
      </main>

      {/* MODAL GRUPOS (Mismo código anterior) */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Gestión de Grupos</h3>
                <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setGroupFormData({...groupFormData, mode: 'create'})} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${groupFormData.mode === 'create' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}>Crear</button>
                    <button onClick={() => setGroupFormData({...groupFormData, mode: 'join'})} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${groupFormData.mode === 'join' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}>Unirse</button>
                </div>
                <form onSubmit={handleGroupAction} className="space-y-3">
                    {groupFormData.mode === 'create' && (
                        <select className="w-full p-2 border rounded text-sm bg-white" value={groupFormData.completionType} onChange={e => setGroupFormData({...groupFormData, completionType: e.target.value})}>
                            <option value="single">Colaborativo (Cualquiera completa)</option>
                            <option value="all">Estricto (Todos completan)</option>
                        </select>
                    )}
                    
                    {/* CAMBIO AQUÍ: Eliminamos la condición ternaria en el placeholder */}
                    <input 
                        required 
                        placeholder="Nombre del Grupo (Exacto)" 
                        className="w-full p-2 border rounded text-sm" 
                        value={groupFormData.name} 
                        onChange={e => setGroupFormData({...groupFormData, name: e.target.value})} 
                    />

                    <input required placeholder="Contraseña de Acceso" type="password" className="w-full p-2 border rounded text-sm" value={groupFormData.code} onChange={e => setGroupFormData({...groupFormData, code: e.target.value})} />
                    
                    <div className="flex gap-2 mt-4">
                        <button type="button" onClick={() => setShowGroupModal(false)} className="flex-1 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 text-sm bg-black text-white rounded hover:bg-gray-800">Confirmar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      {/* MODAL CONFIGURACIÓN */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5" /> Configuración
                    </h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-black"><X className="w-5 h-5"/></button>
                </div>

                <div className="space-y-4">
                    {/* Opción 1: Resetear Tareas */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <h4 className="font-bold text-sm text-gray-700 mb-1">Zona de Tareas</h4>
                        <p className="text-xs text-gray-500 mb-3">Elimina todas las tareas de tu lista personal. Los grupos no se ven afectados.</p>
                        <button onClick={handleResetTasks} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-black py-2 rounded text-xs font-medium transition-all">
                            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar Mis Tareas
                        </button>
                    </div>

                    {/* Opción 2: Eliminar Cuenta */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                        <h4 className="font-bold text-sm text-red-700 mb-1">Zona de Peligro</h4>
                        <p className="text-xs text-red-600/70 mb-3">Esta acción es irreversible. Se borrarán todos tus datos.</p>
                        <button onClick={handleDeleteAccount} className="w-full flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700 py-2 rounded text-xs font-medium transition-all shadow-sm">
                            <AlertOctagon className="w-3.5 h-3.5" /> Eliminar Cuenta
                        </button>
                    </div>
                </div>
                
                <p className="text-center text-[10px] text-gray-300 mt-6">TaskFlow v1.0 • ID: {user.uid.slice(0,6)}</p>
            </div>
        </div>
      )}
    </div>
  );
}