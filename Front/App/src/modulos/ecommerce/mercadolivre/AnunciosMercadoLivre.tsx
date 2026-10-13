// Aba Anúncios: rascunhos e publicados, com o que falta em cada um.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Col, Empty, Flex, Input, Popconfirm, Row, Segmented, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { AnuncioResumo, anunciosApi, formatarMoeda, ROTULO_TIPO_ANUNCIO } from './mercadoLivreApi';
import AdicionarAnuncioModal from './AdicionarAnuncioModal';
import AnuncioEditor from './AnuncioEditor';
import SituacaoTag from './SituacaoTag';

const { Text } = Typography;

type Filtro = 'todos' | 'pendentes' | 'prontos' | 'publicados';


const AnunciosMercadoLivre: React.FC = () => {
  const [anuncios, setAnuncios] = useState<AnuncioResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [adicionar, setAdicionar] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setAnuncios(await anunciosApi.listar()); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao listar.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const contagem = useMemo(() => ({
    pendentes: anuncios.filter(a => a.situacao === 'RASCUNHO' && a.preparo === 'PENDENTE').length,
    prontos: anuncios.filter(a => a.situacao === 'RASCUNHO' && a.preparo === 'PRONTO').length,
    publicados: anuncios.filter(a => a.situacao !== 'RASCUNHO').length,
  }), [anuncios]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return anuncios.filter(a => {
      if (filtro === 'pendentes' && !(a.situacao === 'RASCUNHO' && a.preparo === 'PENDENTE')) return false;
      if (filtro === 'prontos' && !(a.situacao === 'RASCUNHO' && a.preparo === 'PRONTO')) return false;
      if (filtro === 'publicados' && a.situacao === 'RASCUNHO') return false;
      return !t || [a.titulo, a.familia, a.categoriaNome, a.mlbId].some(x => String(x || '').toLowerCase().includes(t));
    });
  }, [anuncios, filtro, busca]);

  const excluir = async (id: number) => {
    try { await anunciosApi.excluir(id); message.success('Rascunho excluído.'); carregar(); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Anúncios" value={anuncios.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Com pendência" value={contagem.pendentes} valueStyle={{ color: contagem.pendentes ? '#cf1322' : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Prontos para publicar" value={contagem.prontos} valueStyle={{ color: contagem.prontos ? '#389e0d' : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Publicados" value={contagem.publicados} /></Card></Col>
      </Row>

      <Card size="small">
        <Flex justify="space-between" wrap gap={8} style={{ marginBottom: 12 }}>
          <Space wrap>
            <Segmented<Filtro> value={filtro} onChange={setFiltro} options={[
              { value: 'todos', label: 'Todos' },
              { value: 'pendentes', label: `Com pendência (${contagem.pendentes})` },
              { value: 'prontos', label: `Prontos (${contagem.prontos})` },
              { value: 'publicados', label: `Publicados (${contagem.publicados})` },
            ]} />
            <Input.Search placeholder="Buscar anúncio" allowClear value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 240 }} />
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdicionar(true)}>Adicionar do catálogo</Button>
          </Space>
        </Flex>

        <Table<AnuncioResumo>
          size="middle" rowKey="id" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          onRow={a => ({ onDoubleClick: () => setEditando(a.id), style: { cursor: 'pointer' } })}
          locale={{
            emptyText: (
              <Empty description={anuncios.length ? 'Nada neste filtro.' : 'Nenhum anúncio ainda: comece escolhendo uma família ou itens do catálogo.'}>
                {!anuncios.length && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdicionar(true)}>Adicionar do catálogo</Button>}
              </Empty>
            ),
          }}
          columns={[
            {
              title: '', width: 56,
              render: (_, a) => a.fotoUrl
                ? <Avatar shape="square" size={44} src={a.fotoUrl} />
                : <Avatar shape="square" size={44} icon={<PictureOutlined />} style={{ background: '#f5f5f5', color: '#bbb' }} />,
            },
            {
              title: 'Anúncio',
              render: (_, a) => (
                <div>
                  <a onClick={() => setEditando(a.id)}><Text strong>{a.titulo || '(sem título)'}</Text></a>
                  <div>
                    <Space size={4} wrap>
                      {a.familia ? <Tag>{a.qtdItens > 1 ? `${a.qtdItens} variações` : 'Item da família'} · {a.familia}</Tag> : <Tag>{a.qtdItens > 1 ? `${a.qtdItens} itens` : 'Item avulso'}</Tag>}
                      <Text type="secondary" style={{ fontSize: 12 }}>{a.categoriaNome || 'Sem categoria do ML'}</Text>
                    </Space>
                  </div>
                </div>
              ),
            },
            { title: 'Tipo', dataIndex: 'tipoAnuncio', width: 90, render: v => ROTULO_TIPO_ANUNCIO[v] || v },
            {
              title: 'Preço no ML', width: 170, align: 'right',
              render: (_, a) => a.precoMin === null ? '—' : a.precoMin === a.precoMax ? formatarMoeda(a.precoMin) : `${formatarMoeda(a.precoMin)} a ${formatarMoeda(a.precoMax)}`,
            },
            { title: 'Estoque', dataIndex: 'estoque', width: 80, align: 'right' },
            { title: 'Situação', width: 230, render: (_, a) => <SituacaoTag a={a} /> },
            {
              title: '', width: 90, align: 'right',
              render: (_, a) => (
                <Space size={0}>
                  <Tooltip title="Abrir"><Button type="text" icon={<EditOutlined />} onClick={() => setEditando(a.id)} /></Tooltip>
                  {a.situacao === 'RASCUNHO' && (
                    <Popconfirm title="Excluir este rascunho?" description="Os itens voltam a ficar livres para outro anúncio." okText="Excluir" okButtonProps={{ danger: true }} onConfirm={() => excluir(a.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <AdicionarAnuncioModal
        aberto={adicionar}
        onFechar={() => setAdicionar(false)}
        onCriados={ids => { setAdicionar(false); carregar(); if (ids.length === 1) setEditando(ids[0]); }}
      />
      <AnuncioEditor id={editando} onFechar={() => setEditando(null)} onAlterado={carregar} />
    </>
  );
};

export default AnunciosMercadoLivre;
