import React, { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Minimize2, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { assistantChat } from "../lib/api";
import { usePlatform } from "../context/PlatformContext";

type AssistantMessage = {
  role: "assistant" | "user";
  content: string;
};

export function AIAssistant() {
  const { selectedDomain, addWorkflow } = usePlatform();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am Clarity AI. I can explain workflows, agent behavior, and create workflows for your selected domain.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (overrideInput?: string) => {
    const messageToSend = (overrideInput ?? input).trim();
    if (!messageToSend || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setIsLoading(true);
    try {
      const response = await assistantChat(messageToSend, selectedDomain);

      if (response.action === "workflow_created" && response.workflow) {
        addWorkflow({
          name: response.workflow.name,
          description: response.workflow.description ?? "",
          category: response.workflow.category,
          agentIds: [],
          steps: [
            { id: "s1", type: "trigger", label: "Email Intake" },
            { id: "s2", type: "agent", label: "Classification" },
            { id: "s3", type: "agent", label: "Validation" },
            { id: "s4", type: "action", label: "Decision & Notify" },
          ],
          status: "active",
          automationRate: 0,
        });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply || "Done." },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I hit an error: ${error instanceof Error ? error.message : "unknown error"}.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40 group"
      >
        <Bot size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10, transformOrigin: "bottom right" }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed bottom-24 right-6 w-[400px] h-[600px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden"
          >
            <div className="px-5 py-4 bg-emerald-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Clarity AI</h3>
                  <p className="text-[9px] text-emerald-100 font-bold uppercase tracking-wider">Active Assistant</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Minimize2 size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              {messages.map((msg, idx) => (
                <div key={idx} className={cn("flex gap-2.5 max-w-[90%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                      msg.role === "assistant" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                    )}
                  >
                    {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div
                    className={cn(
                      "p-3.5 rounded-xl text-xs leading-relaxed border whitespace-pre-wrap",
                      msg.role === "assistant"
                        ? "bg-white text-slate-700 border-slate-100 shadow-sm"
                        : "bg-emerald-600 text-white border-emerald-500"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2.5 max-w-[90%]">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm text-xs text-slate-500">Thinking...</div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSend();
                  }}
                  placeholder="Ask about workflows, agents, or create new workflow..."
                  className="input-base px-4 py-2.5 text-xs"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={isLoading}
                  className="w-10 h-10 bg-emerald-600 text-white rounded-lg flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  "How are agents working?",
                  "Show workflows in this domain",
                  "Create workflow called Claims FastTrack",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => void handleSend(tag)}
                    className="whitespace-nowrap px-2.5 py-1 bg-slate-50 text-slate-500 rounded-md text-[9px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors border border-slate-200"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
