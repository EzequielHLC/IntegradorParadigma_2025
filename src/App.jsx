import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  addDoc,
  setDoc,
  getDoc,
  orderBy,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { 
  Check, 
  Plus, 
  Trash2, 
  Search, 
  X,
  Loader2,
  Settings,
  Save,
  Edit2,
  LogOut,
  Calendar,
  Clock,
  Layout,
  ListTodo,
  Tag,
  Hash
} from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE SEGURA ---
// Se usan variables de entorno. Hay un archivo .env.local en la raíz
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

if (typeof window !== 'undefined') {
  try { getAnalytics(app); } catch (e) { console.warn('Analytics unavailable'); }
}

// --- CONSTANTES ---
const DEFAULT_TAGS = ['Trabajo', 'Personal', 'Urgente', 'Idea', 'Hogar'];

// --- COMPONENTE DE LOGIN ---
const UserLogin = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);

    const normalizedId = username.trim().toLowerCase().replace(/\s+/g, '-');
    const userRef = doc(db, 'users', normalizedId, 'profile', 'data');

    try {
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          displayName: username.trim(),
          createdAt: new Date().toISOString(),
          customTags: [] // Inicializamos array de tags personalizados
        });
      }
      localStorage.setItem('task_user_id', normalizedId);
      onLoginSuccess(normalizedId);
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión. Verifica tus variables de entorno.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 bg-black text-white rounded-lg mx-auto flex items-center justify-center mb-4">
            <Layout className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Gestor de Tareas</h1>
          <p className="text-gray-500 mt-2 text-sm">Ingresa tu ID para sincronizar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" required autoFocus 
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-all"
            placeholder="Nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" disabled={loading || !username.trim()} className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- MODAL DE AJUSTES ---
const SettingsModal = ({ userId, profile, onClose, onLogout, onDeleteAccount }) => (
  <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md shadow-2xl p-6 space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
        <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Configuración</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="text-xs uppercase font-bold text-gray-400 mb-1">Usuario</p>
          <p className="text-lg font-medium">{profile?.displayName || userId}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <p className="text-xs uppercase font-bold text-gray-400 mb-2">Etiquetas Personalizadas</p>
          <div className="flex flex-wrap gap-1">
            {profile?.customTags && profile.customTags.length > 0 ? (
                profile.customTags.map(tag => <span key={tag} className="text-[10px] px-2 py-1 bg-white border rounded text-gray-600">{tag}</span>)
            ) : <span className="text-xs text-gray-400 italic">No tienes etiquetas propias aún.</span>}
          </div>
        </div>
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-colors"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
        <button onClick={() => { if(window.confirm('¿Borrar todo permanentemente?')) onDeleteAccount(); }} className="w-full text-red-600 hover:text-red-700 text-sm hover:underline py-2 text-center">Eliminar cuenta</button>
      </div>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  
  // Estados de la UI
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editModeTask, setEditModeTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all'); 

  // Estado del formulario de tarea
  const [formTask, setFormTask] = useState({
    name: '', details: '', dueDate: '', tags: []
  });
  const [newTagInput, setNewTagInput] = useState('');

  // Inicialización y Autenticación Anónima
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    onAuthStateChanged(auth, (u) => { setFirebaseUser(u); setLoadingAuth(false); });
    const storedId = localStorage.getItem('task_user_id');
    if (storedId) setCurrentUserId(storedId);
  }, []);

  // Carga de Perfil y Tareas
  useEffect(() => {
    if (!currentUserId || !firebaseUser) return;
    setLoadingData(true);
    const unsubProfile = onSnapshot(doc(db, 'users', currentUserId, 'profile', 'data'), (d) => setProfile(d.exists() ? d.data() : null));
    const q = query(collection(db, 'users', currentUserId, 'tasks'), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(q, (s) => { setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingData(false); });
    return () => { unsubProfile(); unsubTasks(); };
  }, [currentUserId, firebaseUser]);

  // Combinación de etiquetas por defecto y personalizadas
  const availableTags = useMemo(() => {
    const custom = profile?.customTags || [];
    // Unir y eliminar duplicados
    return Array.from(new Set([...DEFAULT_TAGS, ...custom]));
  }, [profile]);

  // Acciones
  const handleLogout = () => {
    localStorage.removeItem('task_user_id');
    setCurrentUserId(null); setProfile(null); setTasks([]); setShowSettings(false);
  };

  const handleDeleteAccount = async () => {
    if (!currentUserId) return;
    const batch = writeBatch(db);
    tasks.forEach(t => batch.delete(doc(db, 'users', currentUserId, 'tasks', t.id)));
    batch.delete(doc(db, 'users', currentUserId, 'profile', 'data'));
    await batch.commit();
    handleLogout();
  };

  const toggleFormTag = (tag) => {
    setFormTask(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag) 
        : [...prev.tags, tag]
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

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!formTask.name || !currentUserId) return;

    try {
      // 1. Identificar etiquetas nuevas para guardarlas en el perfil
      const existingTags = new Set(availableTags);
      const newTagsToSave = formTask.tags.filter(t => !existingTags.has(t));

      // 2. Actualizar perfil si hay etiquetas nuevas
      if (newTagsToSave.length > 0) {
        await updateDoc(doc(db, 'users', currentUserId, 'profile', 'data'), {
            customTags: arrayUnion(...newTagsToSave)
        });
      }

      // 3. Guardar la tarea
      const taskData = {
        name: formTask.name,
        details: formTask.details,
        dueDate: formTask.dueDate || null,
        tags: formTask.tags
      };

      if (editModeTask) {
        await updateDoc(doc(db, 'users', currentUserId, 'tasks', editModeTask), { ...taskData, updatedAt: new Date().toISOString() });
        setEditModeTask(null);
      } else {
        await addDoc(collection(db, 'users', currentUserId, 'tasks'), { ...taskData, completed: false, createdAt: new Date().toISOString() });
      }
      
      setFormTask({ name: '', details: '', dueDate: '', tags: [] });
      setShowAddForm(false);
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (task) => {
    const isCompleting = !task.completed;
    await updateDoc(doc(db, 'users', currentUserId, 'tasks', task.id), { 
      completed: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null
    });
  };

  const deleteTask = async (id) => {
    if (window.confirm('¿Eliminar esta tarea?')) await deleteDoc(doc(db, 'users', currentUserId, 'tasks', id));
  };

  const startEditTask = (task) => {
    setEditModeTask(task.id);
    setFormTask({
        name: task.name,
        details: task.details || '',
        dueDate: task.dueDate || '',
        tags: task.tags || []
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filtros de la UI
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, progress };
  }, [tasks]);

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesTab = filterTab === 'all' ? true : filterTab === 'active' ? !t.completed : t.completed;
    return matchesSearch && matchesTab;
  });

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (!currentUserId) return <UserLogin onLoginSuccess={setCurrentUserId} />;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {showSettings && <SettingsModal userId={currentUserId} profile={profile} onClose={() => setShowSettings(false)} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} />}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{profile?.displayName || 'Mi Espacio'}</h1>
              <p className="text-xs text-gray-500 mt-1">{stats.pending} pendientes · {stats.completed} completadas</p>
            </div>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"><Settings className="w-5 h-5" /></button>
          </div>
          <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-black transition-all duration-500" style={{ width: `${stats.progress}%` }}></div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-4">
        <div className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar tarea o etiqueta..." className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => { setEditModeTask(null); setFormTask({ name: '', details: '', dueDate: '', tags: [] }); setShowAddForm(!showAddForm); }} className={`px-4 rounded-lg flex items-center justify-center transition-colors border ${showAddForm ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-black text-white border-black hover:bg-gray-800'}`}>
                {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
        </div>
        <div className="flex border-b border-gray-100">
            {['all', 'active', 'completed'].map(tab => (
                <button key={tab} onClick={() => setFilterTab(tab)} className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${filterTab === tab ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}>
                    {tab === 'all' ? 'Todas' : tab === 'active' ? 'Pendientes' : 'Hechas'}
                    {filterTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
                </button>
            ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 w-full flex-1 pb-20">
        {showAddForm && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <h3 className="font-bold mb-4 text-sm uppercase tracking-wide text-gray-500">{editModeTask ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <input required autoFocus className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-black transition-colors" value={formTask.name} onChange={e => setFormTask({...formTask, name: e.target.value})} placeholder="¿Qué necesitas hacer?" />
              <textarea className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm h-20 resize-none focus:outline-none focus:border-black transition-colors" value={formTask.details} onChange={e => setFormTask({...formTask, details: e.target.value})} placeholder="Detalles adicionales..." />
              
              {/* SECCIÓN DE ETIQUETAS */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                 <div className="flex items-center gap-2 text-xs font-bold uppercase text-gray-400">
                    <Tag className="w-3 h-3" /> Etiquetas
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleFormTag(tag)} className={`px-2 py-1 rounded-full text-xs border transition-colors ${formTask.tags.includes(tag) ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                            {tag}
                        </button>
                    ))}
                 </div>
                 <div className="flex items-center gap-2 pt-1">
                    <Hash className="w-3 h-3 text-gray-400" />
                    <input type="text" className="text-xs bg-transparent outline-none w-full placeholder:text-gray-400" placeholder="Escribe una nueva etiqueta y presiona Enter..." 
                        value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleAddNewTagInput(e); }}
                    />
                 </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-2">
                <Calendar className="w-4 h-4" />
                <input type="datetime-local" className="bg-transparent w-full outline-none text-gray-800" value={formTask.dueDate} onChange={e => setFormTask({...formTask, dueDate: e.target.value})} />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 py-2.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button type="submit" className="flex-[2] bg-black hover:bg-gray-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editModeTask ? 'Guardar Cambios' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-3">
          {loadingData ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div> : filteredTasks.length === 0 ? 
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <ListTodo className="w-12 h-12 mb-3 stroke-1" />
                <p className="text-sm">No hay tareas para mostrar.</p>
            </div> : 
            filteredTasks.map(task => <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task.id)} onEdit={() => startEditTask(task)} />)
          }
        </div>
      </main>
    </div>
  );
}

// --- TAREAS ---
const TaskCard = ({ task, onToggle, onDelete, onEdit }) => {
  const isCompleted = task.completed;
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const now = new Date();
  const isOverdue = dueDate && now > dueDate && !isCompleted;

  return (
    <div className={`group flex items-start p-4 bg-white border rounded-xl transition-all shadow-sm hover:shadow-md ${isCompleted ? 'border-gray-100 bg-gray-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
      <button onClick={onToggle} className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors mr-3 ${isCompleted ? 'bg-gray-200 border-gray-200 text-gray-500' : 'border-gray-400 hover:border-black text-transparent'}`}>
        <Check className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium leading-tight mb-1 transition-all ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.name}</h4>
        {task.details && <p className={`text-xs mb-2 ${isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>{task.details}</p>}
        
        <div className="flex flex-wrap gap-2 items-center">
            {/* TAGS RENDER */}
            {task.tags && task.tags.map(tag => (
                <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${isCompleted ? 'bg-transparent text-gray-300 border-gray-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {tag}
                </span>
            ))}
            
            {dueDate && !isCompleted && (
            <div className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-medium border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                <Clock className="w-3 h-3" />
                <span>{dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}</span>
            </div>
            )}
        </div>
      </div>

      <div className="flex items-center gap-1 pl-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};