// Central de sugestões do ML: o que dá para mudar em cada anúncio para custar menos ou lucrar mais.
// O sistema acha sozinho o que dá para medir (frete grátis abaixo de R$ 79, caixa que paga por volume, peso perto de uma
// faixa, kit que passa de R$ 79, preço abaixo do alvo, cadastro diferente do ML); o que ele não sabe fica no guia de frete.
import React, { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Flex, Input, Segmented, Space, Spin, Tag, Typography } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import { anunciosApi, formatarMoeda, SecaoPreco, SugestaoMl, TipoSugestao } from './mercadoLivreApi';
import AjudaFrete from './AjudaFrete';

const { Text } = Typography;

export const ROTULO_SUGESTAO: Record<TipoSugestao, { texto: string; cor: string }> = {
  PRECO: { texto: 'Preço', cor: 'red' },
  FRETE_GRATIS: { texto: 'Frete grátis', cor: 'volcano' },
  KIT: { texto: 'Kit', cor: 'purple' },
  CAIXA: { texto: 'Embalagem', cor: 'gold' },
  PESO: { texto: 'Peso', cor: 'cyan' },
  CADASTRO: { texto: 'Cadastro', cor: 'default' },
};

/** Para onde levar o operador ao abrir uma sugestão. */
export interface DestinoSugestao { aba: 'preco' | 'itens'; idLinha: number; sku: string; secao?: SecaoPreco; vez: number }
export const destinoDa = (s: SugestaoMl): DestinoSugestao => ({ aba: s.acao.aba, idLinha: s.idLinha, sku: s.sku, secao: s.acao.secao, vez: Date.now() });

const Economia: React.FC<{ v: number | null }> = ({ v }) =>
  v === null ? null : <Tag color="green" style={{ marginInlineEnd: 0 }}>+{formatarMoeda(v)} por venda</Tag>;

/** Uma sugestão (lista da central e painel de preço). */
export const CartaoSugestao: React.FC<{ s: SugestaoMl; anuncio?: string; textoAbrir?: string; onAbrir?: () => void }> = ({ s, anuncio, textoAbrir, onAbrir }) => (
  <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px' }}>
    <Flex justify="space-between" align="center" gap={8} wrap>
      <Space size={6} wrap>
        <Tag color={ROTULO_SUGESTAO[s.tipo].cor} style={{ marginInlineEnd: 0 }}>{ROTULO_SUGESTAO[s.tipo].texto}</Tag>
        <Text strong>{s.sku}</Text>
        <Text>{s.titulo}</Text>
      </Space>
      <Space size={6}>
        <Economia v={s.economia} />
        {onAbrir && <Button size="small" onClick={onAbrir}>{textoAbrir || 'Abrir'} <RightOutlined /></Button>}
      </Space>
    </Flex>
    {anuncio && <Text type="secondary" style={{ fontSize: 12 }}>{anuncio}</Text>}
    <div style={{ fontSize: 13, marginTop: 2 }}>{s.texto}</div>
  </div>
);

/** Sugestões de uma linha dentro do Preço e lucro (compacto). */
export const SugestoesDaLinha: React.FC<{ lista: SugestaoMl[]; onAbrir: (s: SugestaoMl) => void }> = ({ lista, onAbrir }) => {
  const [aberto, setAberto] = useState(false);
  if (!lista.length) return null;
  const total = lista.filter(s => s.tipo !== 'PRECO').reduce((m, s) => Math.max(m, s.economia ?? 0), 0);
  return (
    <Alert
      type="info" showIcon icon={<BulbOutlined />} style={{ marginTop: 10, padding: '6px 12px' }}
      message={
        <Flex justify="space-between" align="center" gap={8} wrap>
          <span>
            <b>{lista.length} sugest{lista.length === 1 ? 'ão' : 'ões'}</b> para este item
            {total > 0 ? <> · a melhor de frete/kit vale <b>+{formatarMoeda(total)}</b> por venda</> : null}
          </span>
          <Space size={6}>
            <AjudaFrete pequeno />
            <Button size="small" type="link" onClick={() => setAberto(x => !x)}>{aberto ? 'Esconder' : 'Ver'}</Button>
          </Space>
        </Flex>
      }
      description={aberto ? (
        <Flex vertical gap={6} style={{ marginTop: 6 }}>
          {lista.map((s, i) => <CartaoSugestao key={i} s={s} onAbrir={() => onAbrir(s)} textoAbrir={s.acao.aba === 'itens' ? 'Itens e estoque' : 'Ver'} />)}
        </Flex>
      ) : undefined}
    />
  );
};

type Filtro = 'TODAS' | TipoSugestao;

/** Botão + gaveta com as sugestões de todos os anúncios. */
const SugestoesMl: React.FC<{ onAbrir: (idAnuncio: number, destino: DestinoSugestao) => void }> = ({ onAbrir }) => {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<{ sugestoes: SugestaoMl[]; titulos: Record<number, string> } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [busca, setBusca] = useState('');

  const carregar = async () => {
    setCarregando(true); setErro(null);
    try { setDados(await anunciosApi.sugestoes()); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setCarregando(false); }
  };
  const abrir = () => { setAberto(true); if (!dados) carregar(); };

  const lista = dados?.sugestoes || [];
  const contagem = useMemo(() => {
    const c: Partial<Record<TipoSugestao, number>> = {};
    for (const s of lista) c[s.tipo] = (c[s.tipo] || 0) + 1;
    return c;
  }, [lista]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter(s => (filtro === 'TODAS' || s.tipo === filtro)
      && (!t || `${s.sku} ${dados?.titulos[s.idAnuncio] || ''}`.toLowerCase().includes(t)));
  }, [lista, filtro, busca, dados]);

  return (
    <>
      <Button icon={<BulbOutlined />} onClick={abrir}>Sugestões{dados ? ` (${lista.length})` : ''}</Button>
      <Drawer
        open={aberto} onClose={() => setAberto(false)} size={760}
        title={<Space><BulbOutlined />Sugestões para os anúncios do ML</Space>}
        extra={<Space><AjudaFrete /><Button onClick={carregar} loading={carregando}>Recalcular</Button></Space>}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
          Calculado com o mesmo frete e tarifa do Preço e lucro (conferidos com o painel do ML). Os valores de um mesmo item não somam:
          desligar o frete grátis e vender em kit são caminhos diferentes. O que o sistema não consegue ver (produto que dobra, embalagem
          menor) está em <b>Como baixar o frete?</b>.
        </Text>
        {erro && <Alert type="error" showIcon message={erro} style={{ marginBottom: 10 }} />}
        {carregando && !dados ? (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 200 }}><Spin tip="Consultando o frete de cada anúncio no ML…"><div style={{ width: 200 }} /></Spin></div>
        ) : (
          <>
            <Flex gap={8} wrap style={{ marginBottom: 10 }}>
              <Segmented
                value={filtro} onChange={v => setFiltro(v as Filtro)}
                options={[
                  { value: 'TODAS', label: `Todas (${lista.length})` },
                  ...(Object.keys(ROTULO_SUGESTAO) as TipoSugestao[]).filter(t => contagem[t]).map(t => ({ value: t, label: `${ROTULO_SUGESTAO[t].texto} (${contagem[t]})` })),
                ]}
              />
              <Input.Search allowClear placeholder="SKU ou anúncio" style={{ width: 200 }} value={busca} onChange={e => setBusca(e.target.value)} />
            </Flex>
            {!visiveis.length ? <Empty description={lista.length ? 'Nada com esse filtro' : 'Nenhuma sugestão: os anúncios estão bem ajustados'} /> : (
              <Flex vertical gap={8}>
                {visiveis.map((s, i) => (
                  <CartaoSugestao
                    key={`${s.idLinha}-${s.tipo}-${i}`} s={s} anuncio={dados?.titulos[s.idAnuncio]}
                    onAbrir={() => { setAberto(false); onAbrir(s.idAnuncio, destinoDa(s)); }}
                  />
                ))}
              </Flex>
            )}
          </>
        )}
      </Drawer>
    </>
  );
};

export default SugestoesMl;
