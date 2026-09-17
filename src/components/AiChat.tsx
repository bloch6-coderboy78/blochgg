import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, SessionInfo } from "../types";
import { MessageSquare, Send, Trash2, Bot, User, Sparkles, Shield, Cpu, RefreshCw } from "lucide-react";

interface AiChatProps {
  session: SessionInfo | null;
}

export const AiChat: React.FC<AiChatProps> = ({ session }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.warn("History fetch error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userMsg = inputText.trim();
    setInputText("");
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: "temp_" + Date.now(),
      sessionId: session?.id || "",
      role: "user",
      content: userMsg,
      model: "baloch-ai",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.assistantMessage) {
          setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), data.userMessage, data.assistantMessage]);
        }
      } else {
        const errData = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: "err_" + Date.now(),
            sessionId: session?.id || "",
            role: "system",
            content: errData.error || "Failed to process chat message",
            model: "system",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = async () => {
    try {
      const res = await fetch("/api/messages/clear", { method: "POST" });
      if (res.ok) {
        setMessages([]);
      }
    } catch (err) {
      console.error("Clear error:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-5rem)] flex flex-col">
      {/* Header Info */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">Baloch AI Assistant</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Isolated Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-slate-400">
              IP Hash: <span className="font-mono text-[11px] text-slate-300">{session?.ipHash || "anonymized"}</span> • Session:{" "}
              <span className="font-mono text-[11px] text-slate-300">{session?.id.slice(0, 10)}...</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={fetchHistory}
            title="Reload Messages"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            title="Clear Chat History"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 overflow-y-auto space-y-4">
        {isLoadingHistory ? (
          <div className="py-20 text-center text-slate-400 text-xs">Loading session conversation...</div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-3">
            <Bot className="w-10 h-10 mx-auto text-slate-600" />
            <div>
              <p className="text-sm font-semibold text-slate-300">How can I assist your video production today?</p>
              <p className="text-xs text-slate-500 mt-1">
                Ask about cinematography directing, Veo prompt crafting, aspect ratio selection, or neural diffusion parameters.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-br-xs shadow-md shadow-indigo-600/20"
                      : "bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-bl-xs shadow-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.usage && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Tokens: {m.usage.totalTokens}</span>
                      <span>Cost: ${m.usage.estimatedCostUsd.toFixed(6)}</span>
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}
        {isSending && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/60 rounded-2xl p-3.5 text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Synthesizing response...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Baloch AI for creative prompts, video parameters, or direct studio questions..."
          disabled={isSending}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-md shadow-indigo-600/30 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
