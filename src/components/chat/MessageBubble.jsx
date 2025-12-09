import React from 'react';

export const MessageBubble = ({ message, isOwn }) => {
  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
          isOwn 
            ? 'bg-blue-600 text-white rounded-br-none' 
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {!isOwn && (
          <span className="text-xs font-bold block mb-1 text-gray-500">
            {message.displayName}
          </span>
        )}
        <p className="text-sm">{message.text}</p>
      </div>
    </div>
  );
};
