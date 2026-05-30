import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, HelpCircle } from 'lucide-react';
import { api } from '../services/api';
import { useHelpChatStore } from '../store/helpChatStore';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/** Read-only helper: is the help-chat back end configured in this env? */
export function useHelpChatAvailable(): boolean {
  const [isAvailable, setIsAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.get(`${API_BASE}/webhooks/help/status`)
      .then(res => { if (!cancelled) setIsAvailable(res.data.available); })
      .catch(() => { if (!cancelled) setIsAvailable(false); });
    return () => { cancelled = true; };
  }, []);
  return isAvailable;
}

export function HelpChat() {
  const [isAvailable, setIsAvailable] = useState(false);
  // CR-052 — open-state lifted to a tiny zustand store so the new HelpMenu
  // dropdown can open the widget programmatically. Behavior unchanged.
  const isOpen = useHelpChatStore((s) => s.isOpen);
  const setIsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const { isOpen: cur, open, close } = useHelpChatStore.getState();
    const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(cur) : next;
    if (value) open(); else close();
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if help chat webhook is configured
  useEffect(() => {
    let cancelled = false;
    api.get(`${API_BASE}/webhooks/help/status`)
      .then(res => { if (!cancelled) setIsAvailable(res.data.available); })
      .catch(() => { if (!cancelled) setIsAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I can help you with the CSHSE accreditation process and how to use the Self-Study Portal. What would you like to know?',
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post(`${API_BASE}/webhooks/help/chat`, {
        question: userMessage.content,
        sessionId
      });

      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Don't render anything if webhook is not configured
  if (!isAvailable) return null;

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-cshse-500 text-white rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              <span className="font-medium text-sm">CSHSE Help</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-cshse-600 rounded transition-colors"
              aria-label="Close help chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-cshse-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about CSHSE or the portal..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cshse-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-cshse-500 text-white rounded-lg hover:bg-cshse-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-cshse-500 text-white rounded-full shadow-lg hover:bg-cshse-600 transition-all duration-200 flex items-center justify-center z-50 hover:scale-110"
        aria-label={isOpen ? 'Close help chat' : 'Open help chat'}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>
    </>
  );
}
