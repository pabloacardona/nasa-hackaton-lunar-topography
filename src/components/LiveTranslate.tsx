"use client";
// Traductor de página: al cambiar a inglés reescribe en el DOM los textos y atributos que
// siguen en español (también los fijos del código). Al volver a español restaura el original.
// Así todo cambia al instante y se mantiene aunque React vuelva a pintar.
import { useEffect } from "react";
import { useMissionStore } from "@/store/useMissionStore";
import { ES_EN } from "@/lib/translations";

const MAP = new Map<string, string>(ES_EN.map(([es, en]) => [es.trim(), en.trim()]));
const KEYS = [...MAP.keys()].sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RX = KEYS.map((k) => ({ k, re: new RegExp(`(?<![\\p{L}\\d])${esc(k)}(?![\\p{L}\\d])`, "gu") }));
const ATTRS = ["title", "aria-label", "placeholder", "alt"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "CANVAS"]);

export function translateText(src: string): string {
  const core = src.trim();
  if (!core) return src;
  let out = MAP.get(core) ?? core;
  if (out === core) {
    for (const { k, re } of RX) {
      if (out.includes(k)) out = out.replace(re, MAP.get(k)!);
    }
  }
  if (out === core) return src;
  const lead = src.match(/^\s*/)?.[0] ?? "";
  const tail = src.match(/\s*$/)?.[0] ?? "";
  return lead + out + tail;
}

const originals = new WeakMap<Node, string>();
const appliedText = new WeakMap<Node, string>();
const attrOriginals = new WeakMap<Element, Map<string, { orig: string; applied: string }>>();

function walk(root: HTMLElement, toEnglish: boolean) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || SKIP.has(el.tagName)) continue;
    nodes.push(n as Text);
  }
  for (const n of nodes) {
    const cur = n.nodeValue ?? "";
    const applied = appliedText.get(n);
    // Lo último que escribimos sigue en el DOM → el original es el que guardamos.
    // Si React escribió algo nuevo, ese texto nuevo pasa a ser el original.
    const weWroteIt = applied !== undefined && cur === applied;
    if (toEnglish) {
      const orig = weWroteIt ? (originals.get(n) ?? cur) : cur;
      const next = translateText(orig);
      if (next !== cur) {
        originals.set(n, orig);
        appliedText.set(n, next);
        n.nodeValue = next;
      } else {
        appliedText.delete(n);
      }
    } else if (weWroteIt) {
      n.nodeValue = originals.get(n) ?? cur;
      appliedText.delete(n);
    }
  }
  root.querySelectorAll<HTMLElement>("[title],[aria-label],[placeholder],[alt]").forEach((el) => {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v == null) continue;
      let store = attrOriginals.get(el);
      if (!store) { store = new Map(); attrOriginals.set(el, store); }
      const prev = store.get(a);
      const orig = prev && prev.applied === v ? prev.orig : v;
      const next = toEnglish ? translateText(orig) : orig;
      store.set(a, { orig, applied: next });
      if (v !== next) el.setAttribute(a, next);
    }
  });
}

export default function LiveTranslate() {
  const lang = useMissionStore((s) => s.lang);

  useEffect(() => {
    const toEnglish = lang === "en";
    let frame = 0;
    const run = () => { frame = 0; walk(document.body, toEnglish); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    run();
    if (!toEnglish) return () => { if (frame) cancelAnimationFrame(frame); };
    // React vuelve a escribir al re-renderizar: se vuelve a traducir lo nuevo.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [lang]);

  return null;
}
