import React from 'react';

// Función para obtener un color consistente basado en el ID del usuario
const getUserColor = (uid) => {
  // Lista de combinaciones de colores pastel (Fondo + Texto oscuro)
  const colors = [
    'bg-red-100 text-red-900',
    'bg-orange-100 text-orange-900',
    'bg-amber-100 text-amber-900',
    'bg-green-100 text-green-900',
    'bg-emerald-100 text-emerald-900',
    'bg-teal-100 text-teal-900',
    'bg-cyan-100 text-cyan-900',
    'bg-sky-100 text-sky-900',
    'bg-indigo-100 text-indigo-900',
    'bg-violet-100 text-violet-900',
    'bg-purple-100 text-purple-900',
    'bg-fuchsia-100 text-fuchsia-900',
    'bg-pink-100 text-pink-900',
    'bg-rose-100 text-rose-900',
  ];
  
  if (!uid) return 'bg-gray-200 text-gray-800';

  // Generar un hash simple del UID para elegir siempre el mismo color
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash % colors.length);
  return colors[index];
};

export const MessageBubble = ({ message, isOwn }) => {
  // Si es mi mensaje: Azul. Si es de otro: Color generado por su UID.
  const bubbleStyle = isOwn 
    ? 'bg-blue-600 text-white rounded-br-none' 
    : `${getUserColor(message.uid)} rounded-bl-none`;

    // Resolver createdAt que puede ser un Firestore Timestamp o un número/Date
  const getDateFromCreatedAt = (createdAt) => {
    if (!createdAt) return null;
    // Firestore Timestamp tiene .toDate()
    if (typeof createdAt.toDate === 'function') {
      return createdAt.toDate();
    }
    // Si ya es un número (milis) o string, intentar convertir
    const maybeDate = new Date(createdAt);
    return isNaN(maybeDate.getTime()) ? null : maybeDate;
  };

  const date = getDateFromCreatedAt(message.createdAt);
  const timeString = date
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';


  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${bubbleStyle}`}
      >
        {!isOwn && (
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-60">
            {message.displayName}
          </span>
        )}
        <p className="text-sm leading-relaxed wrap-break-word">{message.text}</p>
        
        {/* Hora dentro del mismo burbuja, en pequeño y semi-opaco */}
        {timeString && (
          <div className="mt-2 text-[11px] opacity-70">
            <span className="text-gray-200">{/* para mensajes propios el texto debe contrastar */}</span>
          </div>
        )}
      </div>

      {/* Hora fuera de la burbuja, alineada a la misma dirección */}
      {timeString && (
        <div className={`text-[11px] mt-1 opacity-70 ${isOwn ? 'text-right text-gray-500' : 'text-left text-gray-600'}`}>
          {timeString}
        </div>
      )}
    </div>
  );
};