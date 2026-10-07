// PDV › "Rolamento por medida": o cliente traz o rolamento (às vezes só o anel interno); digita o que mediu
// (vazio = qualquer), com margem, e adiciona ao carrinho. Mostra também os códigos padrão que batem e não estão cadastrados.
import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Drawer, Empty, InputNumber, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { ColumnWidthOutlined, PlusOutlined } from '@ant-design/icons';
import type { PdvExtensaoProps } from '../../registroModulos';
import { rolamentosApi, TIPOS, TipoRolamento, VEDACOES } from './rolamentosApi';

const { Text } = Typography;
const mm = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }));
const brl = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

type Medidas = { d: number | null; D: number | null; B: number | null };
interface Achado {
  idItem: number; sku: string; nome: string | null; codigo: string; tipo: TipoRolamento | null; vedacao: string; folga: string | null;
  marca: string | null; medidas: Medidas; desvio: number; estoque: number; preco: number | null;
}
interface Padrao { codigo: string; tipo: TipoRolamento | null; medidas: Medidas; desvio: number }

const RolamentoPorMedida: React.FC<PdvExtensaoProps> = ({ adicionarItens }) => {
  const [aberto, setAberto] = useState(false);
  const [alvo, setAlvo] = useState<Medidas>({ d: null, D: null, B: null });
  const [margem, setMargem] = useState<number>(0.5);
  const [vedacao, setVedacao] = useState('');
  const [soEstoque, setSoEstoque] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [itens, setItens] = useState<Achado[]>([]);
  const [padroes, setPadroes] = useState<Padrao[]>([]);

  const temMedida = alvo.d !== null || alvo.D !== null || alvo.B !== null;

  // Busca enquanto digita (com pausa curta)
  useEffect(() => {
    if (!aberto || !temMedida) { setItens([]); setPadroes([]); return; }
    const t = setTimeout(async () => {
      setCarregando(true);
      try {
        const q = new URLSearchParams();
        if (alvo.d !== null) q.set('d', String(alvo.d));
        if (alvo.D !== null) q.set('D', String(alvo.D));
        if (alvo.B !== null) q.set('B', String(alvo.B));
        q.set('margem', String(margem));
        if (vedacao) q.set('vedacao', vedacao);
        if (soEstoque) q.set('estoque', '1');
        const r = await rolamentosApi.buscarPorMedida(q.toString());
        setItens(r.itens); setPadroes(r.padroes);
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erro na busca.');
      } finally {
        setCarregando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [aberto, alvo, margem, vedacao, soEstoque, temMedida]);

  const adicionar = async (i: Achado) => {
    const falhas = await adicionarItens([{ idItem: i.idItem, nome: i.nome || i.sku, quantidade: 1, idUnidade: null }]);
    if (falhas.length) message.warning(`Não foi possível adicionar: ${falhas.join(', ')}`);
    else message.success(`${i.sku} no carrinho.`);
  };

  // Destaca a medida que difere do que foi digitado
  const medida = (m: Medidas, campo: keyof Medidas) => {
    const v = m[campo];
    const diferente = alvo[campo] !== null && v !== null && Math.abs(Number(v) - Number(alvo[campo])) > 1e-9;
    return <span style={diferente ? { color: '#d46b08', fontWeight: 600 } : undefined}>{mm(v)}</span>;
  };
  const medidasTexto = (m: Medidas) => <span>{medida(m, 'd')} x {medida(m, 'D')} x {medida(m, 'B')} mm</span>;
  const campo = (c: keyof Medidas, rotulo: string, dica: string, foco = false) => (
    <div>
      <Tooltip title={dica}><Text type="secondary" style={{ fontSize: 12 }}>{rotulo}</Text></Tooltip>
      <InputNumber autoFocus={foco} min={0} step={0.5} precision={3} decimalSeparator="," controls={false} placeholder="qualquer" style={{ width: 110, display: 'block' }}
        value={alvo[c]} onChange={v => setAlvo(a => ({ ...a, [c]: v === null || v === undefined ? null : Number(v) }))} addonAfter="mm" />
    </div>
  );

  return (
    <>
      <Tooltip title="Achar rolamento pelas medidas (furo, externo, largura), com margem">
        <Button size="small" icon={<ColumnWidthOutlined />} onClick={() => setAberto(true)}>
          Rolamento por medida
        </Button>
      </Tooltip>

      <Drawer open={aberto} onClose={() => setAberto(false)} width={820} title="Rolamento por medida" destroyOnHidden>
        <Space align="end" wrap size={12}>
          {campo('d', 'Furo (d)', 'Diâmetro interno', true)}
          {campo('D', 'Externo (D)', 'Diâmetro externo')}
          {campo('B', 'Largura (B)', 'Largura do rolamento')}
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Margem</Text>
            <Segmented size="small" style={{ display: 'flex' }} value={margem} onChange={v => setMargem(Number(v))}
              options={[{ value: 0, label: 'exata' }, { value: 0.1, label: '±0,1' }, { value: 0.5, label: '±0,5' }, { value: 1, label: '±1' }]} />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Vedação</Text>
            <Select size="small" style={{ width: 130, display: 'block' }} value={vedacao} onChange={setVedacao}
              options={[{ value: '', label: 'qualquer' }, ...VEDACOES]} />
          </div>
          <Checkbox checked={soEstoque} onChange={e => setSoEstoque(e.target.checked)}>Só com estoque</Checkbox>
          <Button size="small" onClick={() => setAlvo({ d: null, D: null, B: null })}>Limpar</Button>
        </Space>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Preencha só o que conseguiu medir (ex.: cliente trouxe só o anel interno: furo e largura). Em laranja, a medida que difere da digitada.
        </Text>

        <Table<Achado>
          size="small" rowKey="idItem" loading={carregando} dataSource={itens} pagination={false} style={{ marginTop: 12 }} scroll={{ y: 420 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={temMedida ? 'Nenhum rolamento cadastrado com essas medidas' : 'Digite ao menos uma medida'} /> }}
          columns={[
            {
              title: 'Rolamento', key: 'r',
              render: (_, i) => (
                <div style={{ lineHeight: 1.3 }}>
                  <b>{i.sku}</b>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>{i.tipo ? TIPOS[i.tipo].subcategoria : ''}{i.marca ? ` · ${i.marca}` : ''}</Text></div>
                </div>
              ),
            },
            { title: 'd x D x B', key: 'm', width: 170, render: (_, i) => medidasTexto(i.medidas) },
            { title: 'Estoque', dataIndex: 'estoque', width: 80, align: 'right' as const, render: (v: number) => <Text type={v > 0 ? undefined : 'danger'}>{mm(v)}</Text> },
            { title: 'Preço', dataIndex: 'preco', width: 95, align: 'right' as const, render: (v: number | null) => brl(v) },
            { title: '', key: 'a', width: 105, render: (_, i) => <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => adicionar(i)}>Adicionar</Button> },
          ]}
        />

        {padroes.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Text strong style={{ fontSize: 13 }}>Códigos padrão com essas medidas que você não tem cadastrados</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Para encomendar ou conferir com o cliente.</Text>
            <Space wrap size={6} style={{ marginTop: 6 }}>
              {padroes.map(p => (
                <Tooltip key={p.codigo} title={p.tipo ? TIPOS[p.tipo].subcategoria : undefined}>
                  <Tag style={{ padding: '2px 8px' }}><b>{p.codigo}</b> · {medidasTexto(p.medidas)}</Tag>
                </Tooltip>
              ))}
            </Space>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default RolamentoPorMedida;
