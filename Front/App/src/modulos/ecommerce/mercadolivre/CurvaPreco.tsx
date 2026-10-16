// "Onde o preço está": o lucro por venda em função do preço (com a tarifa e o frete do ML em cada preço), com o preço de
// hoje, o do alvo, a mediana do mercado e os degraus do ML (taxa fixa do item barato, frete a partir de R$ 79). Mostra
// o que acontece subindo ou baixando o preço e onde o lucro cai de uma vez. Clique no gráfico para usar aquele preço.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Flex, Spin, Typography } from 'antd';
import { anunciosApi, CurvaPrecoMl, formatarMoeda } from './mercadoLivreApi';

const { Text } = Typography;

const L = 800;            // largura do desenho (escala com a tela)
const A = 230;            // altura
const M = { esq: 56, dir: 12, cima: 26, baixo: 30 };

interface Marca { preco: number; rotulo: string; cor: string; tracejado?: boolean }

const CurvaPreco: React.FC<{
  idAnuncio: number; idLinha: number; preco: number; mediana: number | null;
  /** Muda quando o anúncio salvo muda (frete grátis, tipo...): recalcula a curva. */
  versao: unknown;
  onEscolher: (preco: number) => void;
}> = ({ idAnuncio, idLinha, preco, mediana, versao, onEscolher }) => {
  const [curva, setCurva] = useState<CurvaPrecoMl | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mouse, setMouse] = useState<number | null>(null);   // índice do ponto sob o mouse

  useEffect(() => {
    let vivo = true;
    setErro(null);
    anunciosApi.curva(idAnuncio, idLinha).then(r => vivo && setCurva(r)).catch(e => vivo && setErro(e instanceof Error ? e.message : 'Erro.'));
    return () => { vivo = false; };
  }, [idAnuncio, idLinha, versao]);

  const escala = useMemo(() => {
    if (!curva?.pontos.length) return null;
    const xs = curva.pontos.map(p => p.preco);
    const ys = curva.pontos.map(p => p.lucro);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const folga = (Math.max(...ys, 0) - Math.min(...ys, 0)) * 0.1 || 1;
    const y0 = Math.min(...ys, 0) - folga, y1 = Math.max(...ys, 0) + folga;
    const x = (v: number) => M.esq + ((v - x0) / (x1 - x0 || 1)) * (L - M.esq - M.dir);
    const y = (v: number) => M.cima + ((y1 - v) / (y1 - y0 || 1)) * (A - M.cima - M.baixo);
    return { x, y, x0, x1, y0, y1 };
  }, [curva]);

  if (erro) return <Alert type="warning" showIcon message={erro} />;
  if (!curva || !escala) return <div style={{ textAlign: 'center', padding: 24 }}><Spin /> <Text type="secondary" style={{ fontSize: 12 }}>calculando o lucro em cada preço…</Text></div>;

  const { x, y, x0, x1 } = escala;
  const zero = y(0);
  const linha = curva.pontos.map((p, k) => `${k ? 'L' : 'M'} ${x(p.preco).toFixed(1)} ${y(p.lucro).toFixed(1)}`).join(' ');
  const area = `${linha} L ${x(x1).toFixed(1)} ${zero.toFixed(1)} L ${x(x0).toFixed(1)} ${zero.toFixed(1)} Z`;
  const dentro = (v: number | null | undefined) => v !== null && v !== undefined && v >= x0 && v <= x1;
  const marcas: Marca[] = [
    ...(dentro(curva.limiteTaxaFixa) ? [{ preco: curva.limiteTaxaFixa!, rotulo: 'taxa fixa', cor: '#fa8c16' }] : []),
    ...(dentro(curva.limiteFrete) ? [{ preco: curva.limiteFrete, rotulo: 'R$ 79', cor: '#722ed1' }] : []),
    ...(dentro(curva.alvo) ? [{ preco: curva.alvo!, rotulo: `alvo ${curva.alvoPct}%`, cor: '#52c41a', tracejado: true }] : []),
    ...(dentro(mediana) ? [{ preco: mediana!, rotulo: 'mercado', cor: '#8c8c8c', tracejado: true }] : []),
  ];
  const ticks = Array.from({ length: 5 }, (_, k) => x0 + ((x1 - x0) * k) / 4);
  const p = mouse !== null ? curva.pontos[mouse] : null;
  const maisPerto = (svgX: number) => curva.pontos.reduce((m, q, k) => (Math.abs(x(q.preco) - svgX) < Math.abs(x(curva.pontos[m].preco) - svgX) ? k : m), 0);
  const svgX = (ev: React.MouseEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return ((ev.clientX - r.left) / r.width) * L;
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${L} ${A}`} style={{ width: '100%', height: 'auto', cursor: 'crosshair', userSelect: 'none' }}
        onMouseMove={ev => setMouse(maisPerto(svgX(ev)))} onMouseLeave={() => setMouse(null)}
        onClick={ev => onEscolher(curva.pontos[maisPerto(svgX(ev))].preco)}
      >
        <defs>
          <clipPath id={`acima-${idLinha}`}><rect x={0} y={0} width={L} height={zero} /></clipPath>
          <clipPath id={`abaixo-${idLinha}`}><rect x={0} y={zero} width={L} height={A} /></clipPath>
        </defs>
        {/* lucro (verde) e prejuízo (vermelho) */}
        <path d={area} fill="#52c41a" fillOpacity={0.15} clipPath={`url(#acima-${idLinha})`} />
        <path d={area} fill="#ff4d4f" fillOpacity={0.15} clipPath={`url(#abaixo-${idLinha})`} />
        <line x1={M.esq} x2={L - M.dir} y1={zero} y2={zero} stroke="#bfbfbf" />
        <text x={M.esq - 6} y={zero + 4} textAnchor="end" fontSize={11} fill="#8c8c8c">R$ 0</text>
        <text x={M.esq - 6} y={y(escala.y1) + 4} textAnchor="end" fontSize={11} fill="#8c8c8c">{formatarMoeda(escala.y1)}</text>
        <text x={M.esq - 6} y={y(escala.y0) + 4} textAnchor="end" fontSize={11} fill="#8c8c8c">{formatarMoeda(escala.y0)}</text>
        {/* eixo do preço */}
        {ticks.map(t => (
          <text key={t} x={x(t)} y={A - 8} textAnchor="middle" fontSize={11} fill="#8c8c8c">{formatarMoeda(t)}</text>
        ))}
        {/* degraus, alvo e mercado */}
        {marcas.map(m => (
          <g key={m.rotulo}>
            <line x1={x(m.preco)} x2={x(m.preco)} y1={M.cima - 6} y2={A - M.baixo} stroke={m.cor} strokeDasharray={m.tracejado ? '4 3' : undefined} />
            <text x={x(m.preco)} y={M.cima - 10} textAnchor="middle" fontSize={11} fill={m.cor}>{m.rotulo}</text>
          </g>
        ))}
        <path d={linha} fill="none" stroke="#262626" strokeWidth={2} />
        {/* o preço de hoje (ou o que está sendo digitado) */}
        {dentro(preco) && (
          <g>
            <line x1={x(preco)} x2={x(preco)} y1={M.cima - 6} y2={A - M.baixo} stroke="#1677ff" strokeWidth={2} />
            <text x={x(preco)} y={A - M.baixo + 12} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1677ff">hoje</text>
          </g>
        )}
        {p && (
          <g pointerEvents="none">
            <circle cx={x(p.preco)} cy={y(p.lucro)} r={4} fill={p.lucro < 0 ? '#ff4d4f' : '#52c41a'} />
            <rect x={Math.min(x(p.preco) + 8, L - 170)} y={y(p.lucro) - 30} width={160} height={24} rx={4} fill="#262626" opacity={0.85} />
            <text x={Math.min(x(p.preco) + 16, L - 162)} y={y(p.lucro) - 13} fontSize={12} fill="#fff">
              {formatarMoeda(p.preco)} → lucro {formatarMoeda(p.lucro)}
            </text>
          </g>
        )}
      </svg>
      <Flex justify="space-between" wrap gap={8}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Lucro por venda em cada preço, com a tarifa e o frete que o ML cobraria. Linha em pé = degrau do ML (o lucro muda de uma vez).
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>Clique para usar o preço.</Text>
      </Flex>
      {curva.freteDesconhecido && <Text type="warning" style={{ fontSize: 12 }}>Item sem peso no cadastro: o frete não entrou na conta.</Text>}
    </div>
  );
};

export default CurvaPreco;
