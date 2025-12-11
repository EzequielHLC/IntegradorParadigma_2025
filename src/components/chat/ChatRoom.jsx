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
    <div className="flex flex-col h-[500px] w-[380px] bg-white rounded-t-xl shadow-2xl border border-slate-200 overflow-hidden font-sans">
      {/* Header del Chat */}
      <div className="bg-slate-900 p-4 flex justify-between items-center shadow-md z-10 border-b border-slate-800">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="font-bold text-white text-sm tracking-wide">Chat de Equipo</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg p-1.5 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Lista de Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scroll-smooth">
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
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-3 items-center">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};