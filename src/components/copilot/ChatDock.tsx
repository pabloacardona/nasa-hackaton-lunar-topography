"use client";
// Barra de chat SIEMPRE visible (centro inferior). Al escribir o tocar el robot se abre el panel
// con la conversación y las preguntas guía.
//  - Con LLM configurado: CopilotKit (puede ejecutar acciones sobre la interfaz).
//  - Sin LLM: guía integrada (glosario + estado actual), siempre responde.
import { useEffect, useRef, useState } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotChatInternal } from "@copilotkit/react-core";
import { Bot, ChevronDown, Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { GUIDE_QUESTIONS, localAnswer } from "@/lib/helpBot";

type SR = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null };

/** Negritas **así** y saltos de línea, sin dependencias. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className="mb-1 last:mb-0">
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith("**") ? <strong key={j} className="text-white">{part.slice(2, -2)}</strong> : part))}
        </p>
      ))}
    </>
  );
}

function say(text: string) {
  if (typeof window === "undefined" || !text) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[*#_`|]/g, ""));
  u.lang = useMissionStore.getState().lang === "es" ? "es-ES" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function askLocal(q: string) {
  const text = q.trim();
  if (!text) return "";
  const ui = useUiStore.getState();
  ui.pushLocalChat("user", text);
  const a = localAnswer(text, useMissionStore.getState().lang);
  ui.pushLocalChat("assistant", a);
  return a;
}

function LocalMessages({ es }: { es: boolean }) {
  const chat = useUiStore((s) => s.localChat);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [chat.length]);
  return (
    <div className="max-h-[38vh] min-h-[90px] space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
      {!chat.length && <p className="text-slate-300">{es ? "¡Hola! Soy Luna-Bot. Toca una pregunta de arriba o escribe la tuya abajo." : "Hi! I am Luna-Bot. Tap a question above or type your own below."}</p>}
      {chat.map((m, i) => (
        <div key={i} className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 ${m.role === "user" ? "ml-auto rounded-br-sm bg-[#44658a] text-white" : "rounded-bl-sm bg-slate-800 text-slate-200"}`}>
          <Rich text={m.text} />
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

export default function ChatDock({ instructions }: { instructions: string }) {
  const es = useMissionStore((s) => s.lang) === "es";
  const llm = useUiStore((s) => s.llm);
  const open = useUiStore((s) => s.chatOpen);
  const speak = useUiStore((s) => s.speak);
  const { setChatOpen, setSpeak } = useUiStore.getState();
  const { sendMessage } = useCopilotChatInternal();
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState(0);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    fetch("/api/llm-status").then((r) => r.json()).then((j: { configured: boolean }) => useUiStore.getState().setLlm(!!j.configured)).catch(() => useUiStore.getState().setLlm(false));
  }, []);
  // El texto de ejemplo de la barra va rotando entre las preguntas guía
  useEffect(() => {
    const t = setInterval(() => setHint((h) => (h + 1) % GUIDE_QUESTIONS.length), 6000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setChatOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setChatOpen]);

  const ask = (q: string, viaVoice = false) => {
    const text = q.trim();
    if (!text) return;
    setChatOpen(true);
    if (useUiStore.getState().llm) void sendMessage({ id: crypto.randomUUID(), role: "user", content: text });
    else {
      const a = askLocal(text);
      if (viaVoice && useUiStore.getState().speak) say(a);
    }
  };

  const toggleMic = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setChatOpen(true);
      useUiStore.getState().pushLocalChat("assistant", es ? "Tu navegador no permite hablarme (usa Chrome o Edge). ¡Pero puedes escribirme!" : "Your browser does not support voice input (use Chrome or Edge). You can still type!");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = es ? "es-ES" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => ask(e.results[0][0].transcript, true);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const round = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:scale-110";
  return (
    <div id="tour-chat" className="chat-dock fixed bottom-3 left-1/2 z-50 w-[min(780px,calc(100vw-1.5rem))] -translate-x-1/2">
      {open && (
        <div className="pop absolute bottom-full mb-2 w-full overflow-hidden rounded-3xl border-2 border-[#4f7396]/70 bg-slate-950 shadow-2xl shadow-[#213548]/50">
          <div className="flex items-center gap-2 border-b border-slate-800 bg-gradient-to-r from-[#213548]/70 to-[#3e3050]/50 px-3 py-2">
            <Bot className="h-5 w-5" aria-hidden />
            <span className="font-display text-base font-bold text-white">Luna-Bot</span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${llm ? "bg-[#7e6291] text-white" : "bg-slate-700 text-slate-200"}`}>
              {llm ? <><Sparkles className="h-3 w-3" /> {es ? "IA conectada" : "AI connected"}</> : (es ? "Guía integrada" : "Built-in guide")}
            </span>
            <button onClick={() => setChatOpen(false)} className="ml-auto rounded-full bg-slate-800 p-1.5 text-slate-200 hover:bg-slate-700" aria-label={es ? "Cerrar chat" : "Close chat"}><ChevronDown className="h-4 w-4" /></button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2" aria-label={es ? "Preguntas sugeridas" : "Suggested questions"}>
            {GUIDE_QUESTIONS.map((q) => (
              <button key={q[0]} onClick={() => ask(q[es ? 0 : 1])} className="shrink-0 rounded-full border border-[#44658a]/70 bg-[#172534]/70 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-[#3a5a7a]">
                {q[es ? 0 : 1]}
              </button>
            ))}
          </div>
          {llm ? (
            <div className="h-[min(44vh,380px)]">
              <CopilotChat className="h-full" instructions={instructions}
                labels={{ title: "Luna-Bot", initial: es ? "¡Hola! Soy Luna-Bot, tu director de vuelo. Pregúntame lo que quieras o pídeme cosas como «busca la mejor fecha de diciembre para Malapert»." : "Hi! I am Luna-Bot, your flight director. Ask me anything or request actions." }} />
            </div>
          ) : (
            <LocalMessages es={es} />
          )}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); ask(input); setInput(""); }}
        className="flex items-center gap-2 rounded-full border-2 border-[#7fa6c9]/80 bg-slate-900/95 p-1.5 shadow-xl shadow-[#213548]/60 backdrop-blur">
        <button type="button" onClick={() => setChatOpen(!open)} className={`${round} bg-gradient-to-br from-[#7fa6c9] to-[#9a7aad] text-xl`} aria-expanded={open} aria-label={es ? "Abrir o cerrar el chat con Luna-Bot" : "Toggle chat with Luna-Bot"} title="Luna-Bot">
          <Bot className={`h-6 w-6 ${open ? "" : "wiggle"}`} aria-hidden />
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => setChatOpen(true)}
          placeholder={(es ? "Pregúntame: " : "Ask me: ") + GUIDE_QUESTIONS[hint][es ? 0 : 1]} aria-label={es ? "Pregunta para el asistente" : "Question for the assistant"}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white placeholder:text-slate-400 focus:outline-none" />
        <button type="button" onClick={() => setSpeak(!speak)} className={`${round} bg-slate-800 text-slate-200`} aria-pressed={speak} aria-label={es ? "Leer respuestas en voz alta" : "Read answers aloud"} title={es ? "Leer respuestas en voz alta" : "Read answers aloud"}>
          {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button type="button" onClick={toggleMic} className={`${round} ${listening ? "animate-pulse bg-[#9a5559]" : "bg-slate-800"} text-white`} aria-pressed={listening} aria-label={es ? "Hablar con el asistente" : "Talk to the assistant"} title={es ? "Hablar" : "Talk"}>
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button type="submit" className={`${round} bg-[#4f7396] text-white`} aria-label={es ? "Enviar" : "Send"}><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
