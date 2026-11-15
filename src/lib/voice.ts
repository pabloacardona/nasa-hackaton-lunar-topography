// Voz única para toda la app: elige una voz del idioma pedido (nunca de otro idioma),
// prefiere las voces más naturales del sistema y cancela lo que estuviera hablando.
export type VoiceLang = "es" | "en";

const PREFER: Record<VoiceLang, RegExp[]> = {
  es: [/natural/i, /online/i, /helena|sabina|dalia|elvira|alvaro|jorge|raul|laura|monica|lucia/i, /google/i],
  en: [/natural/i, /online/i, /aria|jenny|guy|samantha|zira|david|google us/i, /google/i],
};
const LANG_PREFIX: Record<VoiceLang, string> = { es: "es", en: "en" };
const BCP47: Record<VoiceLang, string> = { es: "es-ES", en: "en-US" };

let cached: SpeechSynthesisVoice[] = [];
function voices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cached = v;
  return cached;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => { cached = window.speechSynthesis.getVoices(); };
}

/** Voz del idioma pedido, con la mejor puntuación. Nunca devuelve una voz de otro idioma. */
export function pickVoice(lang: VoiceLang): SpeechSynthesisVoice | undefined {
  const same = voices().filter((v) => v.lang.toLowerCase().startsWith(LANG_PREFIX[lang]));
  if (!same.length) return undefined;
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    PREFER[lang].forEach((re, i) => { if (re.test(v.name)) s += 10 - i * 2; });
    if (v.lang.replace("_", "-") === BCP47[lang]) s += 3; // es-ES / en-US primero
    if (v.localService === false) s += 1; // las voces en la nube suelen sonar mejor
    return s;
  };
  return [...same].sort((a, b) => score(b) - score(a))[0];
}

/** Habla un texto: cancela lo anterior, usa la voz del idioma y resuelve al terminar. */
export function speakText(text: string, lang: VoiceLang, opts: { rate?: number; pitch?: number; maxMs?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`|]/g, ""));
    u.lang = BCP47[lang];
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.pitch ?? 1.02;
    const done = () => resolve();
    u.onend = done;
    u.onerror = done;
    setTimeout(done, opts.maxMs ?? 20000);
    synth.speak(u);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
