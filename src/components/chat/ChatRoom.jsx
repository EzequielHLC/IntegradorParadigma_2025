import React, { useState, useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react'; // Importamos X para cerrar
import { useAuth } from '../../context/AuthContext';
import { sendGroupMessage, subscribeToGroupMessages } from '../../services';
import { MessageBubble } from './MessageBubble';

// Añadimos la prop onClose
export const ChatRoom = ({ groupId, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!groupId) return;
    
    const unsubscribe = subscribeToGroupMessages(groupId, (updatedMessages) => {
      setMessages(updatedMessages);
    });

    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendGroupMessage(groupId, user, newMessage);
      setNewMessage('');
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
  };

  return (
    // Cambiamos el estilo para que sea una tarjeta flotante
    <div className="flex flex-col h-[450px] w-[350px] bg-white rounded-t-xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header del Chat */}
      <div className="bg-blue-600 p-3 flex justify-between items-center shadow-md z-10">
        <h3 className="font-semibold text-white text-sm">Chat del Grupo</h3>
        <button 
          onClick={onClose}
          className="text-white/80 hover:text-white hover:bg-blue-700 rounded-full p-1 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Lista de Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            isOwn={user?.uid === msg.uid} 
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensaje */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};