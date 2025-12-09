import React from 'react';
import { Check, Trash2, Clock, Users, Edit2, Calendar } from 'lucide-react';

export const TaskCard = ({ task, context, currentUserId, onToggle, onDelete }) => {
  // Lógica de completado (Compatible con Personal y Grupos)
  let isCompleted = false;
  let completionText = "";

  if (context === 'personal') {
    isCompleted = task.completed;
  } else {
    // Contexto Grupo
    if (context.completionMode === 'all') {
      const completedByMe = task.completedBy?.includes(currentUserId);
      const totalCompletions = task.completedBy?.length || 0;
      isCompleted = completedByMe; 
      completionText = `${totalCompletions} listos`;
    } else {
      isCompleted = task.completed;
      if (isCompleted && task.completedBy?.[0]) {
         completionText = "Hecho"; // Simplificado
      }
    }
  }

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && new Date() > dueDate && !isCompleted;

  return (
    <div className={`group flex items-start p-5 rounded-xl mb-3 transition-all duration-200 border-2 ${isCompleted ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'}`}>
      
      {/* Botón Check */}
      <button 
        onClick={onToggle} 
        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mr-4 focus:ring-4 focus:ring-blue-100 ${isCompleted ? 'bg-green-500 border-green-500 text-white scale-90' : 'border-slate-300 hover:border-blue-500 text-transparent'}`}
        aria-label={isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
      >
        <Check className="w-4 h-4 stroke-[3]" />
      </button>

      <div className="flex-1 min-w-0">
        {/* Título */}
        <h4 className={`text-base font-medium leading-snug mb-1.5 ${isCompleted ? 'text-slate-400 line-through decoration-2' : 'text-slate-800'}`}>
          {task.name}
        </h4>
        
        {/* Detalles */}
        {task.details && (
          <p className={`text-sm mb-3 line-clamp-2 ${isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
            {task.details}
          </p>
        )}
        
        {/* Meta info */}
        <div className="flex flex-wrap gap-2 items-center">
            
            {/* Etiquetas */}
            {task.tags?.map(tag => (
                <span key={tag} className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase tracking-wider ${isCompleted ? 'bg-transparent text-slate-300 border-slate-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {tag}
                </span>
            ))}
            
            {/* Fecha de Vencimiento */}
            {dueDate && !isCompleted && (
              <div className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md font-medium border ${isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}</span>
              </div>
            )}

            {/* Indicador de Grupo */}
            {context !== 'personal' && !isCompleted && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                    <Users className="w-3.5 h-3.5" />
                    <span>{context.completionMode === 'all' ? completionText || 'Grupal' : 'Grupal'}</span>
                </div>
            )}
        </div>
      </div>

      {/* Botón Eliminar */}
      <button 
        onClick={onDelete} 
        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Eliminar tarea"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
};