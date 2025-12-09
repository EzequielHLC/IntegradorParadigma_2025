import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import { TaskCard } from './components/TaskCard';
import { createGroup, joinGroup, leaveGroup, deleteGroup, toggleTaskCompletion, resetPersonalTasks, deleteUserAccountData, subscribeToGroupMessages } from './services';
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
    const [hasUnreadMessages, setHasUnreadMessages] = useState({});

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

  // Escuchar nuevos mensajes solo cuando el chat está CERRADO
    useEffect(() => {
        if (!user || context === 'personal' || showChat) return;

        let firstSnapshot = true;
  
        const unsubscribe = subscribeToGroupMessages(context.id, (updatedMessages) => {
        // La primera vez que se ejecuta el callback, ignoramos los mensajes existentes
        if (firstSnapshot) {
            firstSnapshot = false;
            return;
        }
        
        // A partir de aquí, cualquier nuevo mensaje marca como no leído
        if (updatedMessages.length > 0) {
            setHasUnreadMessages(prev => ({
                ...prev,
                [context.id]: true
            }));
        }
    });

        return () => unsubscribe();
    }, [context, showChat, user]);

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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR PROFESIONAL */}
      <aside className="w-full md:w-72 bg-slate-900 text-slate-300 flex flex-col h-auto md:h-screen sticky top-0 z-20 shadow-xl">
        {/* Header Sidebar */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <Layout className="w-6 h-6"/>
            </div>
            <div>
                <h1 className="font-bold text-white text-lg tracking-tight">TaskFlow</h1>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Workspace</p>
            </div>
        </div>

        {/* User Profile Compact */}
        <div className="px-4 py-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
                        {user.email?.includes('taskflow.local') ? user.email[0].toUpperCase() : user.email?.[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">
                            {user.email?.includes('taskflow.local') ? user.email.split('@')[0] : user.email}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${user.emailVerified ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                                {user.emailVerified ? 'Verificado' : 'Pendiente'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Email Verification Action */}
                {!user.emailVerified && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                        {user.email?.includes('taskflow.local') ? (
                            editingEmail ? (
                                <form onSubmit={handleAddEmail} className="space-y-2">
                                    <input 
                                        type="email" 
                                        placeholder="tu@email.com" 
                                        className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded text-white focus:border-blue-500 outline-none"
                                        value={emailInput}
                                        onChange={e => setEmailInput(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] py-1.5 rounded font-medium transition-colors">Guardar</button>
                                        <button type="button" onClick={() => setEditingEmail(false)} className="px-3 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded transition-colors">✕</button>
                                    </div>
                                </form>
                            ) : (
                                <button onClick={() => setEditingEmail(true)} className="w-full text-left text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 transition-colors">
                                    <UserPlus className="w-3 h-3" /> Vincular correo real
                                </button>
                            )
                        ) : (
                            <div className="bg-amber-900/20 text-amber-200 p-2 rounded border border-amber-900/30 text-[10px] flex items-start gap-2">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>Verifica tu correo para asegurar tu cuenta.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Principal</p>
            <button onClick={() => setContext('personal')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${context === 'personal' ? 'bg-slate-800 text-white border border-slate-700 shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
                <Home className={`w-5 h-5 ${context === 'personal' ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'}`} /> 
                Mis Tareas
            </button>

            <div className="pt-6 pb-2 px-4 flex justify-between items-center group">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Grupos de Trabajo</p>
                <button onClick={() => setShowGroupModal(true)} className="text-slate-500 hover:text-white hover:bg-slate-800 p-1 rounded transition-all" title="Crear o unirse a grupo">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            
            <div className="space-y-1">
                {userGroups.map(group => (
                    <button key={group.id} onClick={() => setContext(group)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${context.id === group.id ? 'bg-slate-800 text-white border border-slate-700 shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
                        <Users className={`w-5 h-5 ${context.id === group.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'}`} /> 
                        <span className="truncate">{group.name}</span>
                    </button>
                ))}
                {userGroups.length === 0 && (
                    <div className="px-4 py-8 text-center border-2 border-dashed border-slate-800 rounded-xl mx-2">
                        <p className="text-xs text-slate-600 mb-2">No tienes grupos</p>
                        <button onClick={() => setShowGroupModal(true)} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Crear uno ahora</button>
                    </div>
                )}
            </div>
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 mt-auto border-t border-slate-800 space-y-1">
            <button onClick={() => setShowSettingsModal(true)} className="w-full flex items-center gap-3 text-sm text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-3 rounded-xl transition-colors">
                <Settings className="w-5 h-5" /> Configuración
            </button>
            <button onClick={logout} className="w-full flex items-center gap-3 text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/20 px-4 py-3 rounded-xl transition-colors">
                <LogOut className="w-5 h-5" /> Cerrar Sesión
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-sm">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    {context === 'personal' ? (
                        <>
                            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Home className="w-6 h-6"/></span>
                            Mis Tareas Personales
                        </>
                    ) : (
                        <>
                            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><Users className="w-6 h-6"/></span>
                            {context.name}
                        </>
                    )}
                </h1>
                <p className="text-slate-500 text-sm mt-1 ml-12 flex items-center gap-2">
                    {context === 'personal' ? 'Gestiona tus pendientes privados' : (
                        <>
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-600">ID: {context.id}</span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                {context.completionMode === 'all' ? <CheckCircle className="w-3 h-3"/> : <Users className="w-3 h-3"/>}
                                {context.completionMode === 'all' ? 'Modo Estricto' : 'Modo Colaborativo'}
                            </span>
                        </>
                    )}
                </p>
            </div>
            
            {/* Group Actions */}
            {context !== 'personal' && (
                <div className="flex items-center gap-3">
                    {context.ownerId === user.uid ? (
                        <button 
                            onClick={handleDeleteGroup} 
                            className="btn-danger flex items-center gap-2 text-sm"
                            title="Eliminar grupo permanentemente"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Eliminar Grupo</span>
                        </button>
                    ) : (
                        <button 
                            onClick={() => { 
                                if(window.confirm('¿Salir del grupo?')) {
                                    leaveGroup(user.uid, context.id).then(() => setContext('personal'));
                                }
                            }} 
                            className="btn-secondary flex items-center gap-2 text-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Abandonar</span>
                        </button>
                    )}
                </div>
            )}
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
            <div className="max-w-4xl mx-auto">
                
                {/* Add Task Button / Form */}
                <div className="mb-8">
                    {!showAddForm ? (
                        <button onClick={() => setShowAddForm(true)} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-200 flex items-center justify-center gap-2 font-medium group">
                            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span>Crear Nueva Tarea</span>
                        </button>
                    ) : (
                        <div className="card-modern animate-in fade-in slide-in-from-top-4 ring-4 ring-slate-50">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center"><Plus className="w-5 h-5"/></div>
                                    Nueva Tarea
                                </h3>
                                <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                            </div>
                            
                            <form onSubmit={handleSaveTask} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                                    <input required autoFocus className="input-modern text-lg font-medium" 
                                        value={formTask.name} onChange={e => setFormTask({...formTask, name: e.target.value})} placeholder="Ej: Revisar reporte mensual" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Detalles</label>
                                    <textarea className="input-modern h-24 resize-none" 
                                        value={formTask.details} onChange={e => setFormTask({...formTask, details: e.target.value})} placeholder="Añade notas, enlaces o sub-tareas..." />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">Etiquetas</label>
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-h-[80px]">
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {availableTags.map(tag => (
                                                    <button key={tag} type="button" onClick={() => toggleFormTag(tag)} 
                                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${formTask.tags.includes(tag) ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Hash className="w-4 h-4 text-slate-400" />
                                                <input type="text" className="text-sm bg-transparent outline-none w-full placeholder:text-slate-400" placeholder="Crear nueva etiqueta..." 
                                                    value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') handleAddNewTagInput(e); }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">Fecha de Vencimiento</label>
                                        <div className="input-modern flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-slate-400" />
                                            <input type="datetime-local" className="bg-transparent w-full outline-none text-slate-800" value={formTask.dueDate} onChange={e => setFormTask({...formTask, dueDate: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary flex-1">Cancelar</button>
                                    <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> Guardar Tarea
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Task List */}
                <div className="space-y-4 pb-20">
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
                    
                    {tasks.length === 0 && (
                        <div className="text-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">Todo listo por ahora</h3>
                            <p className="text-slate-500 max-w-xs mx-auto mt-1">No tienes tareas pendientes en este espacio. ¡Disfruta tu tiempo libre!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </main>

      {/* CHAT WIDGET */}
      {context !== 'personal' && (
        <>
            {showChat && (
                <div className="fixed bottom-0 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300 shadow-2xl rounded-t-xl overflow-hidden">
                    <ChatRoom 
                        groupId={context.id} 
                        onClose={() => setShowChat(false)} 
                    />
                </div>
            )}
            
            {!showChat && (
                <button
                    onClick={() => {
                        setShowChat(true);
                        setHasUnreadMessages(prev => ({ ...prev, [context.id]: false }));
                    }}
                    className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-full shadow-xl hover:bg-slate-800 hover:scale-110 transition-all duration-200 flex items-center gap-2 group"
                >
                    <MessageCircle className="w-6 h-6" />
                    <span className="font-bold pr-1 hidden group-hover:inline-block transition-all">Chat</span>
                    {hasUnreadMessages[context.id] && (
                        <span className="absolute top-0 right-0 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                        </span>
                    )}
                </button>
            )}
        </>
      )}

      {/* MODAL GRUPOS */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-100">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Gestión de Grupos</h3>
                    <p className="text-slate-500 text-sm">Colabora con tu equipo en tiempo real</p>
                </div>

                <div className="flex gap-1 mb-6 bg-slate-100 p-1.5 rounded-xl">
                    <button onClick={() => setGroupFormData({...groupFormData, mode: 'create'})} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all shadow-sm ${groupFormData.mode === 'create' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Crear Nuevo</button>
                    <button onClick={() => setGroupFormData({...groupFormData, mode: 'join'})} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all shadow-sm ${groupFormData.mode === 'join' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Unirse a Existente</button>
                </div>

                <form onSubmit={handleGroupAction} className="space-y-4">
                    {groupFormData.mode === 'create' && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Modo de Completado</label>
                            <select className="input-modern" value={groupFormData.completionType} onChange={e => setGroupFormData({...groupFormData, completionType: e.target.value})}>
                                <option value="single">Colaborativo (Cualquiera completa)</option>
                                <option value="all">Estricto (Todos deben completar)</option>
                            </select>
                        </div>
                    )}
                    
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nombre del Grupo</label>
                        <div className="relative">
                            <Users className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input 
                                required 
                                placeholder="Ej: Proyecto Final" 
                                className="input-modern pl-10" 
                                value={groupFormData.name} 
                                onChange={e => setGroupFormData({...groupFormData, name: e.target.value})} 
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Código de Acceso</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input required placeholder="Contraseña secreta" type="password" className="input-modern pl-10" value={groupFormData.code} onChange={e => setGroupFormData({...groupFormData, code: e.target.value})} />
                        </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6 pt-2">
                        <button type="button" onClick={() => setShowGroupModal(false)} className="btn-secondary flex-1">Cancelar</button>
                        <button type="submit" className="btn-primary flex-1">
                            {groupFormData.mode === 'create' ? 'Crear Grupo' : 'Unirse al Grupo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                        <Settings className="w-5 h-5 text-slate-500" /> Configuración
                    </h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"><X className="w-5 h-5"/></button>
                </div>

                <div className="space-y-4">
                    {/* Opción 1: Resetear Tareas */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-sm text-slate-800 mb-1 flex items-center gap-2"><RotateCcw className="w-4 h-4 text-blue-500"/> Zona de Tareas</h4>
                        <p className="text-xs text-slate-500 mb-4">Elimina todas las tareas de tu lista personal. Los grupos no se ven afectados.</p>
                        <button onClick={handleResetTasks} className="w-full btn-secondary text-xs py-2">
                            Reiniciar Mis Tareas
                        </button>
                    </div>

                    {/* Opción 2: Eliminar Cuenta */}
                    <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                        <h4 className="font-bold text-sm text-red-800 mb-1 flex items-center gap-2"><AlertOctagon className="w-4 h-4 text-red-500"/> Zona de Peligro</h4>
                        <p className="text-xs text-red-600/80 mb-4">Esta acción es irreversible. Se borrarán todos tus datos y grupos.</p>
                        <button onClick={handleDeleteAccount} className="w-full btn-danger bg-red-600 text-white border-transparent hover:bg-red-700 hover:border-transparent text-xs py-2 shadow-red-200 shadow-lg">
                            Eliminar Cuenta Permanentemente
                        </button>
                    </div>
                </div>
                
                <div className="mt-8 text-center">
                    <p className="text-[10px] text-slate-400 font-mono">TaskFlow v2.0 • Build 2025</p>
                    <p className="text-[10px] text-slate-300 mt-1">ID: {user.uid.slice(0,8)}...</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}