// Catálogo do ML no anúncio: se cada item pode entrar no catálogo (com os produtos que combinam) e, para quem já
// está lá, a disputa pelo botão de compra (ganhando, preço para ganhar, oportunidades).
import React, { useState } from 'react';
import { Alert, Avatar, Button, Card, Empty, List, Popconfirm, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, PictureOutlined, SearchOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, CatalogoItem, formatarMoeda } from './mercadoLivreApi';

const { Text } = Typography;

const DISPUTA: Record<string, { texto: string; cor: string }> = {
  winning: { texto: 'Ganhando o botão de compra', cor: 'green' },
  sharing_first_place: { texto: 'Dividindo o primeiro lugar', cor: 'gold' },
  competing: { texto: 'Disputando (perdendo)', cor: 'orange' },
  listed: { texto: 'Só listado (não disputa)', cor: 'red' },
};

const CatalogoMlCard: React.FC<{ det: AnuncioDetalhe }> = ({ det }) => {
  const [itens, setItens] = useState<CatalogoItem[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [entrando, setEntrando] = useState<string | null>(null);

  const verificar = async () => {
    setCarregando(true);
    try { setItens((await anunciosApi.verificarCatalogo(det.id)).itens); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  };

  const entrar = async (item: CatalogoItem, produtoId: string) => {
    setEntrando(`${item.idItem}:${produtoId}`);
    try {
      const r = await anunciosApi.entrarNoCatalogo(det.id, item.idItem, produtoId);
      message.success(`${item.sku} entrou no catálogo${r.mlbCatalogo ? ` (${r.mlbCatalogo})` : ''}. Preço e estoque acompanham o anúncio de sempre.`);
      verificar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setEntrando(null);
    }
  };

  const publicados = det.itens.some(i => i.ml.mlbId && i.ml.status !== 'closed' && i.ml.status !== 'deleted');

  return (
    <Card
      size="small" style={{ marginBottom: 16 }} title="Catálogo do Mercado Livre"
      extra={<Button size="small" icon={<SearchOutlined />} loading={carregando} disabled={!publicados} onClick={verificar}>{itens ? 'Verificar de novo' : 'Verificar catálogo'}</Button>}
    >
      {!publicados && <Text type="secondary">Publique o anúncio primeiro: o catálogo é verificado sobre o anúncio que já está no ML.</Text>}
      {publicados && !itens && (
        <Text type="secondary">
          Mostra se cada item pode entrar numa página de catálogo (com os produtos que combinam pela marca, código de barras e medidas) e,
          para quem já está, se está ganhando o botão de compra e o que falta para ganhar.
        </Text>
      )}
      {itens && (
        <Table<CatalogoItem>
          size="small" rowKey="idItem" dataSource={itens} pagination={itens.length > 10 ? { pageSize: 10 } : false}
          columns={[
            { title: 'Item', width: 150, render: (_, i) => <div><Text strong>{i.sku}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{i.mlbId}</Text></div></div> },
            {
              title: 'Catálogo', width: 170,
              render: (_, i) => <Tag color={i.elegibilidade === 'READY_FOR_OPTIN' ? 'blue' : i.elegibilidade === 'COMPETING' || i.elegibilidade === 'ALREADY_OPTED_IN' ? 'green' : 'default'}>{i.elegibilidadeTexto}</Tag>,
            },
            {
              title: 'Situação',
              render: (_, i) => {
                if (i.disputa) {
                  const d = i.disputa;
                  const rot = DISPUTA[d.status] || { texto: d.status, cor: 'default' };
                  return (
                    <Space direction="vertical" size={2}>
                      <Space wrap size={4}>
                        <Tag color={rot.cor}>{rot.texto}</Tag>
                        {d.precoParaGanhar !== null && (
                          <Text style={{ fontSize: 12 }}>Preço para ganhar: <b>{formatarMoeda(d.precoParaGanhar)}</b>{d.precoAtual !== null && d.precoParaGanhar < d.precoAtual ? ` (hoje ${formatarMoeda(d.precoAtual)})` : ''}</Text>
                        )}
                        {d.ganhador?.preco != null && <Text type="secondary" style={{ fontSize: 12 }}>Ganhador: {formatarMoeda(d.ganhador.preco)}</Text>}
                      </Space>
                      {d.motivos.map(m => <Text key={m} type="danger" style={{ fontSize: 12 }}>• {m}</Text>)}
                      {d.oportunidades.length > 0 && (
                        <Space wrap size={2}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Ajuda a ganhar:</Text>
                          {d.oportunidades.map(o => <Tag key={o} style={{ fontSize: 11 }}>{o}</Tag>)}
                        </Space>
                      )}
                    </Space>
                  );
                }
                if (i.elegibilidade === 'READY_FOR_OPTIN') {
                  const lista = i.candidatos.slice(0, 4);
                  if (!lista.length) return <Text type="secondary" style={{ fontSize: 12 }}>Nenhum produto do catálogo combina: fica como anúncio próprio.</Text>;
                  return (
                    <List
                      size="small" dataSource={lista}
                      renderItem={c => (
                        <List.Item style={{ padding: '4px 0' }} actions={[
                          c.podeEntrar ? (
                            <Popconfirm key="e" title="Entrar neste produto do catálogo?"
                              description={<div style={{ maxWidth: 320 }}>Confira se é exatamente o mesmo produto (marca, medida, quantidade). Produto diferente do anunciado gera reclamação e prejudica a reputação.</div>}
                              okText="Entrar no catálogo" onConfirm={() => entrar(i, c.produtoId)}>
                              <Button size="small" type="primary" loading={entrando === `${i.idItem}:${c.produtoId}`}>Entrar neste</Button>
                            </Popconfirm>
                          ) : <Tooltip key="b" title={c.marcaConfere ? 'Medida ou quantidade diferente: é outro produto' : 'Outra marca: é outro produto'}><Button size="small" disabled>Não é o mesmo</Button></Tooltip>,
                        ]}>
                          <List.Item.Meta
                            avatar={c.foto ? <Avatar shape="square" size={40} src={c.foto} /> : <Avatar shape="square" size={40} icon={<PictureOutlined />} />}
                            title={<a href={`https://www.mercadolivre.com.br/p/${c.produtoId}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{c.nome}</a>}
                            description={
                              <Space wrap size={4} style={{ fontSize: 11 }}>
                                {c.gtinConfere && <Tag color="green" icon={<CheckCircleFilled />}>código de barras</Tag>}
                                <Tag color={c.marcaConfere ? 'green' : 'red'} icon={c.marcaConfere ? <CheckCircleFilled /> : <CloseCircleFilled />}>{c.marca || 'sem marca'}</Tag>
                                {c.conferem.length > 0 && <Text type="success" style={{ fontSize: 11 }}>confere: {c.conferem.join(', ')}</Text>}
                                {c.diferentes.map(d => <Tag key={d.nome} color="red">{d.nome}: {d.catalogo} x {d.item}</Tag>)}
                                {c.conferir.map(d => <Tag key={d.nome} color="orange" icon={<ExclamationCircleFilled />}>confira {d.nome}: {d.catalogo} x {d.item}</Tag>)}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  );
                }
                return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
              },
            },
          ]}
          locale={{ emptyText: <Empty description="Nenhum item publicado." /> }}
        />
      )}
      {itens?.some(i => i.disputa?.motivos.length) && (
        <Alert type="info" showIcon style={{ marginTop: 8 }}
          message="Reputação abaixo do mínimo: o ML só deixa ganhar o botão de compra depois de algumas vendas entregues no prazo e sem reclamação. Enquanto isso, o anúncio próprio continua vendendo normalmente." />
      )}
    </Card>
  );
};

export default CatalogoMlCard;
