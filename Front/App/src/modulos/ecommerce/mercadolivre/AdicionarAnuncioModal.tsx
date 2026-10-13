// Escolhe no catálogo o que vai para o Mercado Livre: uma família (com variações ou um anúncio por item) ou itens soltos.
// No modo "itens" (dentro de um anúncio) só devolve os itens escolhidos.
import React, { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, Input, Modal, Space, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { AppstoreOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons';
import { anunciosApi, Candidatos, formatarMoeda } from './mercadoLivreApi';

const { Text } = Typography;

interface Props {
  aberto: boolean;
  modo?: 'criar' | 'itens';
  onFechar: () => void;
  onCriados?: (ids: number[]) => void;            // modo criar
  onEscolherItens?: (idItens: number[]) => void;  // modo itens
}

const Foto: React.FC<{ url: string | null }> = ({ url }) =>
  url ? <Avatar shape="square" size={36} src={url} /> : <Avatar shape="square" size={36} icon={<PictureOutlined />} style={{ background: '#f0f0f0', color: '#bbb' }} />;

const AdicionarAnuncioModal: React.FC<Props> = ({ aberto, modo = 'criar', onFechar, onCriados, onEscolherItens }) => {
  const [busca, setBusca] = useState('');
  const [dados, setDados] = useState<Candidatos | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [criando, setCriando] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [aba, setAba] = useState(modo === 'itens' ? 'itens' : 'familias');

  const carregar = useCallback(async (texto: string) => {
    setCarregando(true);
    try { setDados(await anunciosApi.candidatos(texto)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setSelecionados([]);
    setAba(modo === 'itens' ? 'itens' : 'familias');
    carregar(busca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const criar = async (chave: string, corpo: { idFamilia?: number; idItens?: number[]; separados?: boolean }) => {
    setCriando(chave);
    try {
      const r = await anunciosApi.criar(corpo);
      message.success(r.ids.length > 1 ? `${r.ids.length} anúncios criados como rascunho.` : 'Anúncio criado como rascunho.');
      onCriados?.(r.ids);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao criar.');
    } finally {
      setCriando(null);
    }
  };

  const tabelaFamilias = (
    <Table
      size="small" rowKey="id" loading={carregando} dataSource={dados?.familias || []} pagination={{ pageSize: 8, showSizeChanger: false }}
      columns={[
        { title: 'Família', dataIndex: 'nome', render: v => <Text strong>{v}</Text> },
        { title: 'Itens', dataIndex: 'itens', width: 70, align: 'center' },
        {
          title: 'Com foto', width: 90, align: 'center',
          render: (_, f) => <Tag color={f.comFoto === f.itens ? 'green' : f.comFoto ? 'gold' : 'red'}>{f.comFoto}/{f.itens}</Tag>,
        },
        { title: 'Com estoque', width: 100, align: 'center', render: (_, f) => <Text type={f.comEstoque ? undefined : 'secondary'}>{f.comEstoque}/{f.itens}</Text> },
        {
          title: '', width: 330, align: 'right',
          render: (_, f) => {
            const livres = f.itens - f.anunciados;
            if (livres <= 0) return <Tag>Todos já anunciados</Tag>;
            return (
              <Space size={4}>
                {f.anunciados > 0 && <Tooltip title={`${f.anunciados} item(ns) já estão em outro anúncio e ficam de fora`}><Tag color="blue">{f.anunciados} já anunciados</Tag></Tooltip>}
                <Tooltip title={`Um anúncio só, com ${livres} variações (o comprador escolhe a medida no anúncio)`}>
                  <Button size="small" type="primary" icon={<AppstoreOutlined />} loading={criando === `v${f.id}`} onClick={() => criar(`v${f.id}`, { idFamilia: f.id })}>
                    Com variações
                  </Button>
                </Tooltip>
                <Tooltip title={`${livres} anúncios, um para cada item`}>
                  <Button size="small" loading={criando === `s${f.id}`} onClick={() => criar(`s${f.id}`, { idFamilia: f.id, separados: true })}>Um por item</Button>
                </Tooltip>
              </Space>
            );
          },
        },
      ]}
    />
  );

  const tabelaItens = (
    <Table
      size="small" rowKey="idItem" loading={carregando} dataSource={dados?.itens || []} pagination={{ pageSize: 8, showSizeChanger: false }}
      rowSelection={{
        selectedRowKeys: selecionados, preserveSelectedRowKeys: true,
        onChange: k => setSelecionados(k as number[]),
        getCheckboxProps: r => ({ disabled: !!r.idAnuncio }),
      }}
      columns={[
        { title: '', width: 50, render: (_, i) => <Foto url={i.fotoUrl} /> },
        {
          title: 'Item', render: (_, i) => (
            <div>
              <Text strong>{i.sku}</Text> <Text>{i.nome}</Text>
              {i.familia && <div><Text type="secondary" style={{ fontSize: 12 }}>{i.familia}</Text></div>}
            </div>
          ),
        },
        { title: 'Preço', dataIndex: 'preco', width: 100, align: 'right', render: formatarMoeda },
        { title: 'Estoque', dataIndex: 'estoque', width: 80, align: 'right' },
        { title: '', width: 120, render: (_, i) => i.idAnuncio ? <Tag color="blue">No anúncio #{i.idAnuncio}</Tag> : null },
      ]}
    />
  );

  const rodape = aba === 'itens' && (
    <Space>
      <Text type="secondary">{selecionados.length} selecionado(s)</Text>
      {modo === 'itens' ? (
        <Button type="primary" icon={<PlusOutlined />} disabled={!selecionados.length} onClick={() => onEscolherItens?.(selecionados)}>Adicionar ao anúncio</Button>
      ) : (
        <>
          <Button disabled={!selecionados.length} loading={criando === 'sep'} onClick={() => criar('sep', { idItens: selecionados, separados: true })}>Um anúncio para cada</Button>
          <Button type="primary" disabled={selecionados.length < 1} loading={criando === 'jun'} onClick={() => criar('jun', { idItens: selecionados })}>
            {selecionados.length > 1 ? 'Um anúncio com variações' : 'Criar anúncio'}
          </Button>
        </>
      )}
    </Space>
  );

  return (
    <Modal
      open={aberto} onCancel={onFechar} width={980} destroyOnHidden
      title={modo === 'itens' ? 'Adicionar itens ao anúncio' : 'Adicionar ao Mercado Livre'}
      footer={rodape || null}
    >
      <Input.Search
        placeholder="Buscar família, item ou SKU" allowClear enterButton value={busca}
        onChange={e => setBusca(e.target.value)} onSearch={v => carregar(v)} style={{ marginBottom: 12 }}
      />
      {modo === 'itens' ? tabelaItens : (
        <Tabs activeKey={aba} onChange={setAba} items={[
          { key: 'familias', label: `Famílias (${dados?.familias.length ?? 0})`, children: tabelaFamilias },
          { key: 'itens', label: `Itens (${dados?.itens.length ?? 0})`, children: tabelaItens },
        ]} />
      )}
    </Modal>
  );
};

export default AdicionarAnuncioModal;
