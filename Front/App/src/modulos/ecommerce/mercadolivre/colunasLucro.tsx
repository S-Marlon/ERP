// Colunas de lucro no ML (tarifa e frete, você recebe e custo, lucro e % sobre o custo, preço para o alvo e situação),
// usadas na lista por anúncio, nos itens de cada anúncio e na visão por item. Todas ordenáveis.
import React from 'react';
import { Button, Dropdown, Modal, Popconfirm, Popover, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { CheckOutlined, DownOutlined, InfoCircleOutlined, WarningFilled } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { AlertaPreco, FinanceiroItem, formatarMoeda } from './mercadoLivreApi';
import { precoComercial } from './listaAnuncios';

const { Text } = Typography;

/** Situação do lucro em relação ao alvo (mesmos níveis da análise de preço do anúncio). */
export const SITUACAO_LUCRO: Record<string, { texto: string; cor: string; dica: string }> = {
  PREJUIZO: { texto: 'Prejuízo', cor: 'red', dica: 'Você recebe menos do que o item custa.' },
  BAIXO: { texto: 'Abaixo do alvo', cor: 'orange', dica: 'Dá lucro, mas abaixo da margem alvo.' },
  BOM: { texto: 'No alvo', cor: 'green', dica: 'Lucro dentro da margem alvo.' },
  ALTO: { texto: 'Acima do alvo', cor: 'blue', dica: 'Bem acima da margem alvo: talvez dê para baixar o preço e vender mais.' },
  SEM_CUSTO: { texto: 'Sem custo', cor: 'default', dica: 'O item não tem custo no ERP: lance o custo para saber o lucro.' },
};
const ORDEM: Record<string, number> = { PREJUIZO: 0, BAIXO: 1, SEM_CUSTO: 2, BOM: 3, ALTO: 4 };

export const TagSituacao: React.FC<{ nivel: string; alvoPct?: number }> = ({ nivel, alvoPct }) => (
  <Tooltip title={`${SITUACAO_LUCRO[nivel].dica}${alvoPct !== undefined ? ` Alvo: ${alvoPct}% sobre o custo.` : ''}`}>
    <Tag color={SITUACAO_LUCRO[nivel].cor} style={{ marginRight: 0 }}>{SITUACAO_LUCRO[nivel].texto}</Tag>
  </Tooltip>
);

/**
 * Degraus de preço do ML (taxa fixa de item barato, frete grátis a partir de R$ 79): grave em vermelho, com o botão do
 * preço certo; aviso em laranja. `compacto` mostra só um selo com os detalhes ao passar o mouse.
 */
export const AlertasPreco: React.FC<{ alertas: AlertaPreco[] | undefined; onUsar?: (preco: number) => void; compacto?: boolean; textoUsar?: string }> = ({ alertas, onUsar, compacto, textoUsar }) => {
  if (!alertas?.length) return null;
  const grave = alertas.some(a => a.grave);
  const lista = (
    <Space direction="vertical" size={6} style={{ maxWidth: 340 }}>
      {alertas.map(a => (
        <div key={a.tipo}>
          <Text style={{ fontSize: 12, color: a.grave ? '#cf1322' : '#d46b08' }}>{a.grave ? <WarningFilled /> : <InfoCircleOutlined />} {a.texto}</Text>
          {a.precoSugerido !== null && onUsar && (
            <div><Button size="small" type={a.grave ? 'primary' : 'default'} danger={a.grave} style={{ marginTop: 4 }} onClick={() => onUsar(a.precoSugerido!)}>{textoUsar || 'Usar'} {formatarMoeda(a.precoSugerido)}</Button></div>
          )}
        </div>
      ))}
    </Space>
  );
  if (!compacto) return lista;
  return (
    <Popover content={lista} title={grave ? 'Preço num degrau do ML' : 'Atenção ao mudar o preço'}>
      <Tag color={grave ? 'red' : 'orange'} icon={grave ? <WarningFilled /> : <InfoCircleOutlined />} style={{ cursor: 'pointer', marginTop: 4, marginRight: 0 }}>
        {grave ? (alertas.find(a => a.grave)!.tipo === 'TAXA_FIXA' ? 'taxa fixa' : 'frete R$ 79') : 'degrau perto'}
      </Tag>
    </Popover>
  );
};

/**
 * Modo de venda: Clássico/Premium e frete grátis (você paga) ou frete cliente (o comprador paga). `noMl` falso = ainda não publicado
 * (tipo do ERP e frete do padrão da conta); 'misto' quando os itens do anúncio estão diferentes.
 */
export interface EdicaoModo {
  /** 'anuncio': vale para todos os itens publicados; 'item': só este. */
  escopo: 'anuncio' | 'item';
  onTipo?: (tipo: string) => Promise<unknown>;
  onFrete?: (gratis: boolean) => Promise<unknown>;
  /** Motivo de não deixar trocar (ex.: ainda não publicado); null = pode. */
  bloqueioTipo?: string | null;
  bloqueioFrete?: string | null;
}

const NOME_TIPO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium' };
const NOME_FRETE = (g: boolean) => (g ? 'Frete grátis' : 'Frete cliente');

/** Etiqueta que abre as opções ao clicar e confirma antes de mandar ao ML. */
const TagEditavel: React.FC<{
  tag: React.ReactNode; dica: string; opcoes: { valor: string; texto: string; atual: boolean }[];
  bloqueio?: string | null; confirmar: (valor: string) => { titulo: string; texto: string }; onEscolher?: (valor: string) => Promise<unknown>;
}> = ({ tag, dica, opcoes, bloqueio, confirmar, onEscolher }) => {
  const [ocupado, setOcupado] = React.useState(false);
  if (!onEscolher) return <Tooltip title={dica}>{tag}</Tooltip>;
  if (bloqueio) return <Tooltip title={`${dica} · ${bloqueio}`}>{tag}</Tooltip>;
  const escolher = (valor: string) => {
    const c = confirmar(valor);
    Modal.confirm({
      title: c.titulo, content: c.texto, okText: 'Mudar no ML', cancelText: 'Cancelar',
      onOk: async () => {
        setOcupado(true);
        try { await onEscolher(valor); } finally { setOcupado(false); }
      },
    });
  };
  return (
    <Dropdown
      trigger={['click']} disabled={ocupado}
      menu={{
        items: opcoes.map(o => ({ key: o.valor, label: o.texto, icon: o.atual ? <CheckOutlined /> : <span style={{ display: 'inline-block', width: 14 }} />, disabled: o.atual })),
        onClick: ({ key }) => escolher(String(key)),
      }}
    >
      <Tooltip title={`${dica} · Clique para mudar`}>
        <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {ocupado ? <Spin size="small" /> : tag}<DownOutlined style={{ fontSize: 9, color: '#8c8c8c' }} />
        </span>
      </Tooltip>
    </Dropdown>
  );
};

export const ModoVenda: React.FC<{ tipo: string | 'misto' | null; freteGratis: boolean | 'misto' | null; noMl: boolean; edicao?: EdicaoModo }> = ({ tipo, freteGratis, noMl, edicao }) => {
  const origem = noMl ? '' : ' (ainda não publicado: vale o do ERP e o padrão da sua conta do ML)';
  const todos = edicao?.escopo === 'anuncio';
  const onde = todos ? 'em todos os itens publicados deste anúncio' : 'só neste item';

  const tipoTag = tipo === null ? null : tipo === 'misto'
    ? <Tag style={{ marginInlineEnd: 0 }}>Misto</Tag>
    : <Tag color={tipo === 'gold_pro' ? 'purple' : 'geekblue'} style={{ marginInlineEnd: 0 }}>{NOME_TIPO[tipo] || tipo}</Tag>;
  const dicaTipo = tipo === 'misto' ? 'Itens com tipos diferentes no ML'
    : `${tipo === 'gold_pro' ? 'Premium: mais exposição e parcelamento sem juros para o comprador (tarifa maior)' : 'Clássico: tarifa menor, sem parcelamento sem juros'}${origem}`;

  const freteTagEl = freteGratis === null ? null : freteGratis === 'misto'
    ? <Tag style={{ marginInlineEnd: 0 }}>Frete misto</Tag>
    : <Tag color={freteGratis ? 'cyan' : 'gold'} style={{ marginInlineEnd: 0 }}>{NOME_FRETE(freteGratis)}</Tag>;
  const dicaFrete = freteGratis === 'misto' ? 'Uns itens com frete grátis, outros com o cliente pagando'
    : freteGratis ? `Frete grátis para o comprador: você paga o envio${origem}`
      : `O comprador paga o envio (abaixo de R$ 79 o ML ainda cobra de você a tarifa de envio do item barato)${origem}`;

  return (
    <Space direction="vertical" size={2} style={{ opacity: noMl ? 1 : 0.75 }}>
      {tipoTag && (
        <TagEditavel
          tag={tipoTag} dica={dicaTipo} bloqueio={edicao?.bloqueioTipo} onEscolher={edicao?.onTipo}
          opcoes={['gold_special', 'gold_pro'].map(t => ({ valor: t, texto: NOME_TIPO[t], atual: tipo === t }))}
          confirmar={t => ({
            titulo: `Mudar para ${NOME_TIPO[t]} ${onde}?`,
            texto: t === 'gold_pro'
              ? 'Premium cobra tarifa maior e dá parcelamento sem juros ao comprador. Vai ao ML na hora; se algum item passar a dar prejuízo, a trava recusa.'
              : 'Clássico cobra tarifa menor. O ML costuma não deixar descer de Premium para Clássico num anúncio publicado: se recusar, o motivo aparece aqui.',
          })}
        />
      )}
      {freteTagEl && (
        <TagEditavel
          tag={freteTagEl} dica={dicaFrete} bloqueio={edicao?.bloqueioFrete} onEscolher={edicao?.onFrete ? v => edicao.onFrete!(v === 'sim') : undefined}
          opcoes={[true, false].map(g => ({ valor: g ? 'sim' : 'nao', texto: NOME_FRETE(g), atual: freteGratis === g }))}
          confirmar={v => ({
            titulo: `${v === 'sim' ? 'Ligar o frete grátis' : 'Passar o frete para o cliente'} ${onde}?`,
            texto: v === 'sim'
              ? 'Você passa a pagar o envio (abaixo de R$ 79, o frete cheio). Vai ao ML na hora; se algum item passar a dar prejuízo, a trava recusa.'
              : 'O comprador paga o envio; abaixo de R$ 79 o ML ainda cobra de você a tarifa de envio do item barato. A partir de R$ 79 o frete grátis é obrigatório.',
          })}
        />
      )}
    </Space>
  );
};

/** Junta o modo de venda de vários itens (um valor só, ou 'misto'). */
export const modoDosItens = (itens: FinanceiroItem[], tipoErp: string) => {
  const um = <V,>(vs: V[]): V | 'misto' | null => (!vs.length ? null : vs.every(v => v === vs[0]) ? vs[0] : 'misto');
  return {
    tipo: um(itens.length ? itens.map(f => f.tipo || tipoErp) : [tipoErp]),
    freteGratis: um(itens.map(f => f.freteGratis)),
    noMl: itens.some(f => f.modoNoMl),
  };
};

const cinza = (v: number) => <Text type="secondary">{v ? `−${formatarMoeda(v)}` : '—'}</Text>;
/** Nome pequeno à esquerda do valor, nas colunas de dois andares. */
const Rotulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>{children}</Text>
);
const num = (v: number | null | undefined) => (v === null || v === undefined ? -Infinity : v);

/**
 * Colunas de lucro de uma linha. `fin` acha os números da linha; `onAplicarPreco` (opcional) faz da coluna
 * "Para o alvo" um botão que grava o preço sugerido.
 */
export function colunasLucro<T>(
  fin: (linha: T) => FinanceiroItem | undefined,
  op: { onAplicarPreco?: (linha: T, preco: number) => void; compacto?: boolean; aplicarVaiAoRascunho?: boolean } = {},
): ColumnsType<T> {
  const ordenar = (k: (f: FinanceiroItem) => number) => (a: T, b: T) => num(fin(a) && k(fin(a)!)) - num(fin(b) && k(fin(b)!));
  const colunas: ColumnsType<T> = [
    {
      title: <Tooltip title="O que o ML desconta de cada venda. Tarifa: a comissão do tipo de anúncio. Frete: com frete grátis, o envio (abaixo de R$ 79, o cheio); sem frete grátis abaixo de R$ 79, a tarifa de envio do item barato (cobrada mesmo com o comprador pagando o envio).">Tarifa e frete</Tooltip>,
      width: 118, align: 'right', sorter: ordenar(f => f.tarifa + f.frete),
      render: (_, l) => {
        const f = fin(l);
        if (!f) return null;
        return (
          <div style={{ lineHeight: 1.35 }}>
            <div><Rotulo>tarifa</Rotulo>{cinza(f.tarifa)}</div>
            <div>
              <Rotulo>frete</Rotulo>
              {f.freteDesconhecido ? <Tooltip title="Item sem peso no cadastro: o frete não entrou na conta"><Text type="warning">?</Text></Tooltip> : cinza(f.frete)}
            </div>
          </div>
        );
      },
    },
    {
      title: <Tooltip title="Você recebe: o preço menos tarifa e frete. Embaixo, o custo do item no ERP (a diferença é o lucro).">Recebe / custo</Tooltip>,
      width: 112, align: 'right', sorter: ordenar(f => f.recebe),
      render: (_, l) => {
        const f = fin(l);
        if (!f) return null;
        return (
          <div style={{ lineHeight: 1.35 }}>
            <Text strong>{formatarMoeda(f.recebe)}</Text>
            <div><Rotulo>custo</Rotulo>{cinza(f.custo)}</div>
          </div>
        );
      },
    },
    {
      title: <Tooltip title="Lucro por venda e, embaixo, o % sobre o custo do ERP (o alvo é medido assim)">Lucro</Tooltip>,
      width: 104, align: 'right', sorter: ordenar(f => f.lucro),
      render: (_, l) => {
        const f = fin(l);
        if (!f) return null;
        const pct = f.lucroSobreCustoPct;
        return (
          <div style={{ lineHeight: 1.35 }}>
            <Text strong style={{ color: f.lucro < 0 ? '#cf1322' : '#389e0d' }}>{formatarMoeda(f.lucro)}</Text>
            <div style={{ fontSize: 12 }}>
              {pct === null ? <Text type="secondary">—</Text> : (
                <Tooltip title={`Alvo: ${f.alvoPct}% sobre o custo`}>
                  <Text style={{ color: pct < 0 ? '#cf1322' : pct < f.alvoPct ? '#d46b08' : '#389e0d' }}>{pct.toFixed(1).replace('.', ',')}%</Text>
                  {!op.compacto && <Text type="secondary" style={{ fontSize: 11 }}> / {f.alvoPct}%</Text>}
                </Tooltip>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: <Tooltip title="Preço sugerido (final ,90) para chegar no alvo, já com tarifa e frete do ML. Passe o mouse para ver o mínimo exato.">Para o alvo</Tooltip>,
      width: 120, align: 'right', sorter: ordenar(f => (f.precoAlvo === null ? -Infinity : precoComercial(f.precoAlvo) - f.preco)),
      render: (_, l) => {
        const f = fin(l);
        if (!f || f.precoAlvo === null) return f ? <Text type="secondary">—</Text> : null;
        const sugerido = precoComercial(f.precoAlvo);
        const dif = sugerido - f.preco;
        if (Math.abs(dif) < 0.005) return <Text type="secondary">no preço</Text>;
        const texto = (
          <div style={{ lineHeight: 1.2 }}>
            <Text strong>{formatarMoeda(sugerido)}</Text>
            <div><Text style={{ fontSize: 11, color: dif > 0 ? '#d46b08' : '#1677ff' }}>{dif > 0 ? '+' : '−'}{formatarMoeda(Math.abs(dif))}</Text></div>
          </div>
        );
        if (!op.onAplicarPreco) return <Tooltip title={`Mínimo exato: ${formatarMoeda(f.precoAlvo)}`}>{texto}</Tooltip>;
        return (
          <Popconfirm
            title={`Mudar o preço para ${formatarMoeda(sugerido)}?`}
            description={<div style={{ maxWidth: 280 }}>Dá {f.alvoPct}% ou mais sobre o custo (mínimo exato {formatarMoeda(f.precoAlvo)}). {op.aplicarVaiAoRascunho ? 'Vai para as alterações: grava ao salvar.' : 'Grava e envia ao ML.'}</div>}
            okText={op.aplicarVaiAoRascunho ? 'Usar este preço' : 'Mudar o preço'} onConfirm={() => op.onAplicarPreco!(l, sugerido)}
          >
            <Button type="text" size="small" style={{ height: 'auto', padding: '2px 4px' }}>{texto}</Button>
          </Popconfirm>
        );
      },
    },
    {
      title: 'Situação', width: 128, sorter: (a, b) => (ORDEM[fin(a)?.nivel ?? ''] ?? 9) - (ORDEM[fin(b)?.nivel ?? ''] ?? 9),
      render: (_, l) => {
        const f = fin(l);
        if (!f) return null;
        return (
          <div>
            <TagSituacao nivel={f.nivel} alvoPct={f.alvoPct} />
            <div><AlertasPreco compacto alertas={f.alertas} onUsar={op.onAplicarPreco ? v => op.onAplicarPreco!(l, v) : undefined} textoUsar={op.aplicarVaiAoRascunho ? 'Pôr' : 'Mudar para'} /></div>
          </div>
        );
      },
    },
  ];
  return colunas;
}
