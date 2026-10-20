// Gráfico de barras sem biblioteca (SVG): séries empilhadas para cima (entradas) e para baixo (saídas), com uma linha
// opcional (ex.: saldo acumulado). Passe o mouse para o detalhe de cada coluna; clique para escolher.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flex, Typography } from 'antd';
import { limitesDoGrafico, passoDosRotulos, PontoGrafico, SerieGrafico } from './escalaGrafico';

export type { PontoGrafico, SerieGrafico } from './escalaGrafico';
const { Text } = Typography;

interface Props {
  pontos: PontoGrafico[];
  series: SerieGrafico[];
  linha?: { nome: string; cor: string };
  altura?: number;
  formatar: (v: number) => string;
  /** Linha extra no quadro do mouse (ex.: "3 vendas"). */
  detalhe?: (p: PontoGrafico) => React.ReactNode;
  onClicar?: (p: PontoGrafico) => void;
  /** Esconde a legenda (gráfico de uma série só). */
  semLegenda?: boolean;
}

const M = { esq: 64, dir: 8, cima: 10, baixo: 22 };

const GraficoBarras: React.FC<Props> = ({ pontos, series, linha, altura = 220, formatar, detalhe, onClicar, semLegenda }) => {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);
  const [mouse, setMouse] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, el.clientWidth));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { max, min } = useMemo(() => limitesDoGrafico(pontos, series), [pontos, series]);
  const util = altura - M.cima - M.baixo;
  const y = (v: number) => M.cima + ((max - v) / (max - min || 1)) * util;
  const coluna = (largura - M.esq - M.dir) / Math.max(1, pontos.length);
  const barra = Math.max(2, Math.min(36, coluna * 0.7));
  const cx = (i: number) => M.esq + coluna * i + coluna / 2;
  const passo = passoDosRotulos(pontos.length, Math.max(4, Math.floor(largura / 70)));
  const p = mouse !== null ? pontos[mouse] : null;

  const linhaPath = linha
    ? pontos.map((q, i) => `${i ? 'L' : 'M'} ${cx(i).toFixed(1)} ${y(q.linha ?? 0).toFixed(1)}`).join(' ')
    : '';

  return (
    <div ref={caixa} style={{ position: 'relative', width: '100%' }}>
      <svg width={largura} height={altura} style={{ display: 'block', userSelect: 'none' }} onMouseLeave={() => setMouse(null)}>
        {/* eixo: topo, zero e base */}
        {[max, 0, ...(min < 0 ? [min] : [])].map(v => (
          <g key={v}>
            <line x1={M.esq} x2={largura - M.dir} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#bfbfbf' : '#f0f0f0'} />
            <text x={M.esq - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#8c8c8c">{formatar(v)}</text>
          </g>
        ))}
        {pontos.map((q, i) => {
          let topo = 0, fundo = 0;
          return (
            <g key={q.chave}>
              {mouse === i && <rect x={M.esq + coluna * i} y={M.cima} width={coluna} height={util} fill="#f5f5f5" />}
              {series.map(s => {
                const v = Math.max(0, q.valores[s.chave] || 0);
                if (!v) return null;
                const de = s.negativa ? fundo : topo;
                const ate = s.negativa ? (fundo -= v) : (topo += v);
                const [y1, y2] = [y(de), y(ate)].sort((a, b) => a - b);
                return <rect key={s.chave} x={cx(i) - barra / 2} y={y1} width={barra} height={Math.max(1, y2 - y1)} fill={s.cor} rx={2} />;
              })}
              {i % passo === 0 && (
                <text x={cx(i)} y={altura - 6} textAnchor="middle" fontSize={10} fill="#8c8c8c">{q.rotulo}</text>
              )}
              {/* área do mouse: a coluna inteira */}
              <rect x={M.esq + coluna * i} y={M.cima} width={coluna} height={util} fill="transparent"
                style={{ cursor: onClicar ? 'pointer' : 'default' }}
                onMouseEnter={() => setMouse(i)} onClick={() => onClicar?.(q)} />
            </g>
          );
        })}
        {linha && pontos.length > 0 && (
          <g pointerEvents="none">
            <path d={linhaPath} fill="none" stroke={linha.cor} strokeWidth={2} />
            {pontos.map((q, i) => <circle key={q.chave} cx={cx(i)} cy={y(q.linha ?? 0)} r={pontos.length > 40 ? 1.5 : 3} fill={linha.cor} />)}
          </g>
        )}
      </svg>
      {p && mouse !== null && (
        <div style={{
          position: 'absolute', top: 4, pointerEvents: 'none', zIndex: 2, minWidth: 160,
          ...(cx(mouse) > largura / 2 ? { right: largura - cx(mouse) + 12 } : { left: cx(mouse) + 12 }),
          background: 'rgba(38,38,38,0.92)', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.rotulo}</div>
          {series.map(s => (
            <div key={s.chave}><span style={{ color: s.cor }}>■</span> {s.nome}: {formatar(p.valores[s.chave] || 0)}</div>
          ))}
          {linha && <div><span style={{ color: linha.cor }}>●</span> {linha.nome}: <b>{formatar(p.linha ?? 0)}</b></div>}
          {detalhe && <div style={{ opacity: 0.85 }}>{detalhe(p)}</div>}
        </div>
      )}
      {!semLegenda && (
        <Flex gap={14} wrap justify="center" style={{ marginTop: 2 }}>
          {series.map(s => <Text key={s.chave} type="secondary" style={{ fontSize: 12 }}><span style={{ color: s.cor }}>■</span> {s.nome}</Text>)}
          {linha && <Text type="secondary" style={{ fontSize: 12 }}><span style={{ color: linha.cor }}>●</span> {linha.nome}</Text>}
        </Flex>
      )}
    </div>
  );
};

export default GraficoBarras;
