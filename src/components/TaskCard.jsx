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
     LÓGICA DE COMPLETADO (SIN CAMBIOS)
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
  // En estricto NO hay asignación


  /* ================================
     MAPEO UID -> NOMBRE (SEGURO)
  ==================================*/
  const getUserName = (uid) => {
    return userMap?.[uid] || 'Usuario';
  };
  console.log("TASKCARD → context:", context);
  console.log("TASKCARD → members (PROP):", members);
  console.log("TASKCARD → userMap:", userMap);

  return (
    <div className={`group relative flex items-start p-4 bg-white border rounded-xl mb-3 transition-all shadow-sm ${isCompleted ? 'border-gray-100 bg-gray-50/50' : 'border-gray-200 hover:border-black hover:shadow-md'}`}>

      {/* Botón Check */}
      <button
        onClick={onToggle}
        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors mr-3 ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-gray-400 hover:border-black'}`}
      >
        {isCompleted && <Check className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 min-w-0">

        {/* Título */}
        <h4 className={`text-sm font-medium leading-tight mb-1 ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {task.name}
        </h4>

        {/* Detalles */}
        {task.details && (
          <p className={`text-xs mb-2 line-clamp-2 ${isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>
            {task.details}
          </p>
        )}

        {/* Usuarios asignados (AHORA CON NOMBRE) */}
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
            <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${isCompleted ? 'bg-transparent text-gray-300 border-gray-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {tag}
            </span>
          ))}

          {/* Fecha */}
          {dueDate && !isCompleted && (
            <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium border ${isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              <Clock className="w-3 h-3" />
              <span>{dueDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}

          {/* Indicador Grupo */}
          {isGroupTask && !isCompleted && (
            <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              <Users className="w-3 h-3" />
              <span>{context.completionMode === 'all' ? completionText || 'Grupal' : 'Grupal'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ================================
           BOTONERA LATERAL
      =================================*/}

      {/* SOLO CREADOR → ASIGNAR */}
      {isCollaborativeGroup && isCreator && (

        <button
          onClick={() => setShowAssignModal(true)}
          title="Asignar usuarios"
          className="p-1.5 text-gray-300 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      )}

      {/* Eliminar */}
      {(!isGroupTask || isStrictGroup || isCreator) && (
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {(!isGroupTask || isStrictGroup || isCreator) && (
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-300 hover:text-black transition-colors opacity-0 group-hover:opacity-100"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}


      {/* ================================
           MODAL DE ASIGNACIÓN
      =================================*/}
      {showAssignModal && context.completionMode !== 'all' && (
        <div className="absolute top-0 right-0 w-64 bg-white rounded-xl border shadow-xl p-4 z-[999] flex flex-col">

          <h3 className="text-sm font-semibold mb-2">Asignar usuarios</h3>

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto mb-3 pr-1">
            {members?.map(uid => (
              <label
                key={uid}
                className="flex items-center gap-2 text-xs leading-tight"
              >
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
