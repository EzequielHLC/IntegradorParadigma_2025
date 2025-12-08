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
    <div className={`group flex items-start p-4 bg-white border rounded-xl mb-3 transition-all shadow-sm ${isCompleted ? 'border-gray-100 bg-gray-50/50' : 'border-gray-200 hover:border-black hover:shadow-md'}`}>
      
      {/* Botón Check */}
      <button onClick={onToggle} className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors mr-3 ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400 hover:border-black'}`}>
        {isCompleted && <Check className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        {/* Título */}
        <h4 className={`text-sm font-medium leading-tight mb-1 ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {task.name}
        </h4>
        
        {/* Detalles (Descripción) restaurada */}
        {task.details && (
          <p className={`text-xs mb-2 line-clamp-2 ${isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>
            {task.details}
          </p>
        )}
        
        {/* Meta info: Tags, Fecha, Grupo */}
        <div className="flex flex-wrap gap-2 items-center">
            
            {/* Etiquetas */}
            {task.tags?.map(tag => (
                <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${isCompleted ? 'bg-transparent text-gray-300 border-gray-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {tag}
                </span>
            ))}
            
            {/* Fecha de Vencimiento */}
            {dueDate && !isCompleted && (
              <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  <Clock className="w-3 h-3" />
                  <span>{dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}</span>
              </div>
            )}

            {/* Indicador de Grupo (si aplica) */}
            {context !== 'personal' && !isCompleted && (
                <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    <Users className="w-3 h-3" />
                    <span>{context.completionMode === 'all' ? completionText || 'Grupal' : 'Grupal'}</span>
                </div>
            )}
        </div>
      </div>

      {/* Botón Eliminar */}
      <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};