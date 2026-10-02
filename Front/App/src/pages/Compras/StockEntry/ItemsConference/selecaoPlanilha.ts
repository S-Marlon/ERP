// Seleção de linhas como numa planilha:
// - clique na linha: seleciona só ela;  Ctrl/⌘ + clique: inclui ou tira a linha;
// - Shift + clique: o intervalo desde a última linha clicada (se a linha clicada já estava marcada, desmarca o intervalo);
// - clicar e arrastar: seleciona as linhas por onde o mouse passa (com Ctrl, soma à seleção atual);
// - Ctrl+A: todas as linhas visíveis;  Esc: limpa.
// Clique em campo, botão, tag ou menu da linha não mexe na seleção.
import React, { useCallback, useEffect, useRef, useState } from 'react';

export type Chave = React.Key;

export interface Modificadores { shift?: boolean; ctrl?: boolean }

// Linhas entre a âncora e a chave (inclusive), na ordem da tabela
export const intervalo = (chaves: Chave[], ancora: Chave | null, chave: Chave): Chave[] => {
  const fim = chaves.indexOf(chave);
  if (fim < 0) return [];
  const ini = ancora !== null && chaves.includes(ancora) ? chaves.indexOf(ancora) : fim;
  const [a, b] = ini <= fim ? [ini, fim] : [fim, ini];
  return chaves.slice(a, b + 1);
};

// Mantém a ordem da tabela na seleção resultante
const ordenar = (chaves: Chave[], conjunto: Set<Chave>) => chaves.filter(c => conjunto.has(c));

/**
 * Resultado de um clique. `origem` = 'linha' (clique simples substitui a seleção) ou 'caixa' (o checkbox
 * só alterna a linha). Devolve a nova seleção e a nova âncora (Shift não move a âncora).
 */
export const aplicarClique = (
  chaves: Chave[], selecao: Chave[], ancora: Chave | null, chave: Chave,
  mod: Modificadores, origem: 'linha' | 'caixa' = 'linha',
): { selecao: Chave[]; ancora: Chave | null } => {
  const atual = new Set(selecao);
  if (mod.shift) {
    const faixa = intervalo(chaves, ancora, chave);
    const desmarcar = atual.has(chave) && ancora !== chave;
    faixa.forEach(c => (desmarcar ? atual.delete(c) : atual.add(c)));
    return { selecao: ordenar(chaves, atual), ancora: ancora ?? chave };
  }
  if (mod.ctrl || origem === 'caixa') {
    if (atual.has(chave)) atual.delete(chave); else atual.add(chave);
    return { selecao: ordenar(chaves, atual), ancora: chave };
  }
  return { selecao: [chave], ancora: chave };
};

// Seleção durante o arraste: a base (vazia, ou a seleção anterior com Ctrl) + o intervalo percorrido
export const aplicarArraste = (chaves: Chave[], base: Chave[], ancora: Chave, chave: Chave): Chave[] =>
  ordenar(chaves, new Set([...base, ...intervalo(chaves, ancora, chave)]));

const INTERATIVOS = 'input, textarea, button, a, select, label, [role="button"], [contenteditable="true"], '
  + '.ant-select, .ant-input-number, .ant-picker, .ant-tag, .ant-dropdown-trigger, .ant-checkbox-wrapper, .ant-popover, .ant-switch';

const ehInterativo = (alvo: EventTarget | null) => alvo instanceof Element && Boolean(alvo.closest(INTERATIVOS));

/**
 * Liga a seleção de planilha a uma tabela. `chaves` = linhas visíveis, na ordem em que aparecem.
 * Use `propsLinha` no onRow do Table, `onCaixa` no checkbox da linha e `propsContainer` no elemento em volta da tabela.
 */
export const useSelecaoPlanilha = (chaves: Chave[], selecao: Chave[], setSelecao: (s: Chave[]) => void) => {
  const ancora = useRef<Chave | null>(null);
  const arraste = useRef<{ base: Chave[]; inicio: Chave; moveu: boolean } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  // Termina o arraste mesmo se o mouse for solto fora da tabela
  useEffect(() => {
    const soltar = () => { arraste.current = null; setArrastando(false); };
    window.addEventListener('mouseup', soltar);
    return () => window.removeEventListener('mouseup', soltar);
  }, []);

  const propsLinha = useCallback((chave: Chave) => ({
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0 || ehInterativo(e.target)) return;
      const mod = { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
      if (mod.shift) e.preventDefault(); // evita selecionar texto com Shift
      const r = aplicarClique(chaves, selecao, ancora.current, chave, mod);
      ancora.current = r.ancora;
      setSelecao(r.selecao);
      if (!mod.shift) {
        arraste.current = { base: mod.ctrl ? r.selecao : [], inicio: chave, moveu: false };
      }
    },
    onMouseEnter: () => {
      const a = arraste.current;
      if (!a || a.inicio === chave && !a.moveu) return;
      if (!a.moveu) { a.moveu = true; setArrastando(true); }
      setSelecao(aplicarArraste(chaves, a.base.length ? a.base : [a.inicio], a.inicio, chave));
    },
  }), [chaves, selecao, setSelecao]);

  const onCaixa = useCallback((chave: Chave, e: { nativeEvent: MouseEvent | Event }) => {
    const ne = e.nativeEvent as MouseEvent;
    const r = aplicarClique(chaves, selecao, ancora.current, chave, { shift: ne.shiftKey, ctrl: ne.ctrlKey || ne.metaKey }, 'caixa');
    ancora.current = r.ancora;
    setSelecao(r.selecao);
  }, [chaves, selecao, setSelecao]);

  const propsContainer = {
    tabIndex: -1,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (ehInterativo(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelecao([...chaves]); }
      else if (e.key === 'Escape' && selecao.length > 0) { e.stopPropagation(); setSelecao([]); }
    },
    style: { outline: 'none', userSelect: arrastando ? 'none' as const : undefined },
  };

  return { propsLinha, onCaixa, propsContainer, arrastando };
};
