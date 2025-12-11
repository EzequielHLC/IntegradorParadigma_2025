import React, { useState } from 'react';
import { Check, Trash2, Clock, Users, Edit2, UserPlus } from 'lucide-react';
import { assignUserToTask, unassignUserFromTask } from '../services';

export const TaskCard = ({
  task,
  context,
  members,
  currentUserId,
  userMap,
  onToggle,
  onDelete,
  onEdit
}) => {

  /* ================================
     LÓGICA DE COMPLETADO
  ==================================*/
  let isCompleted = false;
  let completionText = "";

  if (context === 'personal') {
    isCompleted = task.completed;
  } else {
    if (context.completionMode === 'all') {
      const completedByMe = task.completedBy?.includes(currentUserId);
      const totalCompletions = task.completedBy?.length || 0;
      isCompleted = completedByMe;
      completionText = `${totalCompletions} listos`;
    } else {
      isCompleted = task.completed;
      if (isCompleted && task.completedBy?.[0]) {
        completionText = "Hecho";
      }
    }
  }

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && new Date() > dueDate && !isCompleted;

  /* ================================
     ASIGNACIÓN
  ==================================*/
  const [showAssignModal, setShowAssignModal] = useState(false);

  const isGroupTask = context !== 'personal';
  const isStrictGroup = context?.completionMode === 'all';
  const isCollaborativeGroup = isGroupTask && !isStrictGroup;
  const isCreator = isCollaborativeGroup && task.createdBy === currentUserId;

  /* ================================
     MAPEO UID -> NOMBRE
  ==================================*/
  const getUserName = (uid) => userMap?.[uid] || 'Usuario';


  return (
    <div className={`group relative flex items-start p-5 rounded-xl mb-3 transition-all duration-200 border-2 
      ${isCompleted ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md'}`}>

      {/* Botón Check */}
      <button
        onClick={onToggle}
        className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all mr-4 
        focus:ring-4 focus:ring-blue-100
        ${isCompleted ? 'bg-green-500 border-green-500 text-white scale-90' : 'border-slate-300 hover:border-blue-500 text-transparent'}`}
        aria-label={isCompleted ? "Marcar como pendiente" : "Marcar como completada"}
      >
        <Check className="w-4 h-4 stroke-[3]" />
      </button>

      <div className="flex-1 min-w-0">

        {/* Título */}
        <h4 className={`text-base font-medium leading-snug mb-1.5 
          ${isCompleted ? 'text-slate-400 line-through decoration-2' : 'text-slate-800'}`}>
          {task.name}
        </h4>

        {/* Detalles */}
        {task.details && (
          <p className={`text-sm mb-3 line-clamp-2 
            ${isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
            {task.details}
          </p>
        )}

        {/* Usuarios asignados */}
        {isGroupTask && task.assignedTo?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            <span className="text-[9px] text-gray-400 mr-1">Asignados:</span>
            {task.assignedTo.map(uid => (
              <span
                key={uid}
                className="text-[9px] px-1.5 py-0.5 rounded border bg-gray-100 text-gray-600 border-gray-200"
              >
                👤 {getUserName(uid)}
              </span>
            ))}
          </div>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-2 items-center">

          {/* Tags */}
          {task.tags?.map(tag => (
            <span
              key={tag}
              className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase tracking-wider ${
                isCompleted
                  ? 'bg-transparent text-slate-300 border-slate-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {tag}
            </span>
          ))}

          {/* Fecha */}
          {dueDate && !isCompleted && (
            <div className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md font-medium border ${
              isOverdue
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>
                {dueDate.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          {/* Indicador Grupo */}
          {isGroupTask && !isCompleted && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
              <Users className="w-3.5 h-3.5" />
              <span>{isStrictGroup ? completionText || 'Grupal' : 'Grupal'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Botón ASIGNAR (solo creador en colaborativo) */}
      {isCollaborativeGroup && isCreator && (
        <button
          onClick={() => setShowAssignModal(true)}
          className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          title="Asignar usuarios"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      )}

      {/* Botón EDITAR (estricto todos / colaborativo creador) */}
      {(!isGroupTask || isStrictGroup || isCreator) && (
        <button
          onClick={onEdit}
          className="p-2 text-slate-300 hover:text-black hover:bg-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          title="Editar tarea"
        >
          <Edit2 className="w-5 h-5" />
        </button>
      )}

      {/* Botón ELIMINAR */}
      {(!isGroupTask || isStrictGroup || isCreator) && (
        <button
          onClick={onDelete}
          className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Eliminar tarea"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}

      {/* Modal de ASIGNACIÓN */}
      {showAssignModal && !isStrictGroup && (
        <div className="absolute top-0 right-0 w-64 bg-white rounded-xl border shadow-xl p-4 z-[999] flex flex-col">
          <h3 className="text-sm font-semibold mb-2">Asignar usuarios</h3>

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto mb-3 pr-1">
            {members?.map(uid => (
              <label key={uid} className="flex items-center gap-2 text-xs leading-tight">
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={task.assignedTo?.includes(uid)}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      await assignUserToTask(context.id, task.id, uid, currentUserId);
                    } else {
                      await unassignUserFromTask(context.id, task.id, uid, currentUserId);
                    }
                  }}
                />
                <span className="truncate">{getUserName(uid)}</span>
              </label>
            ))}
          </div>

          <button
            onClick={() => setShowAssignModal(false)}
            className="mt-auto text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 self-start"
          >
            Cerrar
          </button>
        </div>
      )}

    </div>
  );
};
