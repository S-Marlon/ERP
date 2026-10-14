// Aba Itens e estoque do editor: divisão do estoque loja/ML, e cada item com foto, título no ML, situação no ML,
// e estoque. Preço e lucro de cada item ficam na aba Preço e lucro. Fotos, adicionar e tirar itens valem na hora.
import React, { useState } from 'react';
import { Alert, Avatar, Button, Card, Popconfirm, Space, Spin, Table, Tag, Tooltip, Typography, Upload } from 'antd';
import { BarcodeOutlined, DeleteOutlined, InboxOutlined, PictureOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import FotosMlModal from '../FotosMlModal';
import FotoFamiliaControle from '../../../../areas/catalogo/familias/FotoFamiliaControle';
import EnviarFotoPopover from '../../../../shared/components/EnviarFotoPopover';
import { AnuncioDetalhe, foraDoMl, ItemDoAnuncio, ROTULO_STATUS_ML } from '../mercadoLivreApi';
import { EstoqueAnuncioCard, EstoqueItemCelula } from '../EstoqueMl';
import type { RascunhoItem } from '../rascunhoAnuncio';

const { Text } = Typography;

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;                                  // com o rascunho aplicado
  rascunhoItens: Record<number, RascunhoItem>;
  onMudarEstoque: (corpo: { estoqueReserva?: number; estoqueMaximo?: number | null; estoqueAutomatico?: boolean }) => void;
  onMudarItem: (idItem: number, corpo: RascunhoItem) => void;
  filtro: { texto: string; ids: number[] } | null;
  onLimparFiltro: () => void;
  comErro: Set<number>;
  errosConferencia: Map<number, string[]>;
  enviandoFoto: number | 'todos' | null;
  onFoto: (item: ItemDoAnuncio, arquivo: File) => void;
  onFotoLink: (item: ItemDoAnuncio, url: string) => void;
  onFotoTodos: (arquivo: File) => void;
  onFotoFamilia: () => void;
  onAdicionarItens: () => void;
  onRemoverItem: (item: ItemDoAnuncio) => void;
  onDesligar: (item: ItemDoAnuncio) => void;
  sincronizando: boolean;
  onSincronizar: () => void;
}

const AbaItens: React.FC<Props> = p => {
  const { det } = p;
  const [fotosMl, setFotosMl] = useState<{ idItem: number | null } | null>(null);
  const visiveis = det.itens.filter(i => !p.filtro || p.filtro.ids.includes(i.idItem));
  const semFoto = det.itens.filter(i => i.fotos === 0 && !i.ml.mlbId);

  return (
    <>
      <EstoqueAnuncioCard det={det} sincronizando={p.sincronizando} onSincronizar={p.onSincronizar} onSalvar={p.onMudarEstoque} />
      <Card
        size="small"
        title={<Space>{det.itens.length > 1 ? `Itens (${det.itens.length})` : 'Item'}{det.eixos.length > 0 && <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>variando por {det.eixos.map(e => det.atributosCategoria.find(a => a.id === e)?.nome || e).join(', ')}</Text>}</Space>}
        extra={(
          <Space wrap>
            {det.idFamilia && <FotoFamiliaControle modo="compacto" idFamilia={det.idFamilia} nome={det.familia} imagem={det.fotoFamilia} onAlterada={p.onFotoFamilia} />}
            {semFoto.length > 0 && (
              <Upload accept="image/*" showUploadList={false} beforeUpload={f => { p.onFotoTodos(f); return false; }}>
                <Tooltip title="Coloca a mesma foto como principal em todos os itens que ainda não têm foto (vale na hora)">
                  <Button size="small" icon={<UploadOutlined />} loading={p.enviandoFoto === 'todos'}>Foto para os sem foto ({semFoto.length})</Button>
                </Tooltip>
              </Upload>
            )}
            <Tooltip title="Ver as fotos que os itens usam no ML, trazer para o cadastro do ERP ou buscar fotos de outro anúncio/catálogo">
              <Button size="small" icon={<PictureOutlined />} onClick={() => setFotosMl({ idItem: null })}>Fotos ML ↔ ERP</Button>
            </Tooltip>
            <Button size="small" icon={<PlusOutlined />} onClick={p.onAdicionarItens}>Adicionar itens</Button>
          </Space>
        )}
      >
        {p.filtro && (
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message={<>Mostrando {p.filtro.ids.length} item(ns) com: <b>{p.filtro.texto}</b></>}
            action={<Button size="small" onClick={p.onLimparFiltro}>Mostrar todos</Button>} />
        )}
        <Table<ItemDoAnuncio>
          size="small" rowKey="idItem" dataSource={visiveis} pagination={visiveis.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
          scroll={{ x: 760 }}
          rowClassName={i => (p.rascunhoItens[i.idItem] ? 'ml-linha-alterada' : p.comErro.has(i.idItem) || p.errosConferencia.has(i.idItem) ? 'ml-linha-erro' : '')}
          columns={[
            {
              title: 'Foto', width: 64,
              render: (_, i) => (
                <EnviarFotoPopover titulo={`Foto de ${i.sku}`} disabled={foraDoMl(i.ml.status)} onArquivo={f => p.onFoto(i, f)} onUrl={u => p.onFotoLink(i, u)}>
                  <Tooltip title={i.fotos ? `${i.fotos} foto(s): clique para enviar mais` : det.fotoFamilia ? 'Usa a foto da família. Clique para enviar uma própria.' : 'Sem foto: clique para enviar'}>
                    <Spin spinning={p.enviandoFoto === i.idItem} size="small">
                      {i.fotoUrl
                        ? <Avatar shape="square" size={46} src={i.fotoUrl} style={{ cursor: 'pointer' }} />
                        : det.fotoFamilia
                        ? <Avatar shape="square" size={46} src={det.fotoFamilia} style={{ cursor: 'pointer', opacity: 0.75, border: '1px dashed #1677ff' }} />
                        : <Avatar shape="square" size={46} icon={<UploadOutlined />} style={{ cursor: 'pointer', background: '#fff1f0', color: '#cf1322', border: '1px dashed #ffa39e' }} />}
                    </Spin>
                  </Tooltip>
                </EnviarFotoPopover>
              ),
            },
            {
              title: 'Item',
              render: (_, i) => (
                <div style={{ lineHeight: 1.35 }}>
                  <Space size={4} wrap>
                    <Text strong>{i.sku}</Text>
                    {!i.ativo && <Tag color="red">inativo</Tag>}
                    {p.rascunhoItens[i.idItem] && <Tag color="processing" style={{ fontSize: 11 }}>alterado</Tag>}
                  </Space>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>{i.nome}</Text></div>
                  {det.modo === 'SEPARADO' && i.tituloMl && i.tituloMl !== i.nome && (
                    <div><Text style={{ fontSize: 12 }}><Text type="secondary" style={{ fontSize: 12 }}>No ML: </Text>{i.tituloMl}</Text>{i.tituloCortado && <Tag color="orange" style={{ fontSize: 10, marginLeft: 4 }}>cortado</Tag>}</div>
                  )}
                  <Space size={4} wrap style={{ marginTop: 2 }}>
                    {i.ml.mlbId && (
                      <a href={i.ml.permalink || undefined} target="_blank" rel="noreferrer">
                        <Tag color={ROTULO_STATUS_ML[i.ml.status || '']?.cor || 'green'} style={{ fontSize: 11 }}>{i.ml.mlbId} · {ROTULO_STATUS_ML[i.ml.status || '']?.texto || i.ml.status}</Tag>
                      </a>
                    )}
                    {i.ml.mlbId && foraDoMl(i.ml.status) && (
                      <Popconfirm title="Desligar do Mercado Livre?" okText="Desligar" onConfirm={() => p.onDesligar(i)}
                        description={<div style={{ maxWidth: 300 }}>O anúncio {i.ml.mlbId} não existe mais no ML. O item volta a "a publicar".</div>}>
                        <Button size="small" type="link" style={{ padding: 0, fontSize: 12 }}>Desligar do ML</Button>
                      </Popconfirm>
                    )}
                    {!i.ml.mlbId && i.ml.erro && <Tooltip title={i.ml.erro}><Tag color="red" style={{ fontSize: 11 }}>não subiu: {i.ml.erro.slice(0, 50)}{i.ml.erro.length > 50 ? '…' : ''}</Tag></Tooltip>}
                    {!i.ml.mlbId && !i.ml.erro && det.publicados > 0 && <Tag style={{ fontSize: 11 }}>a publicar</Tag>}
                    {det.eixos.map(e => <Tag key={e} color="blue" style={{ fontSize: 11 }}>{i.valores[e]?.valor || '—'}{i.valores[e]?.unidade ? ` ${i.valores[e]?.unidade}` : ''}</Tag>)}
                  </Space>
                  {p.errosConferencia.get(i.idItem)?.map((e, k) => <div key={k}><Text type="danger" style={{ fontSize: 12 }}>ML: {e}</Text></div>)}
                </div>
              ),
            },
            {
              title: <Tooltip title="Saldo do ERP e o que vai para o ML. Clique para mudar a unidade vendida ou dar uma regra só a este item.">Estoque</Tooltip>, width: 110, align: 'right',
              render: (_, i) => <EstoqueItemCelula item={i} det={det} onSalvarRegra={regra => p.onMudarItem(i.idItem, regra)} />,
            },
            {
              title: '', width: 56,
              render: (_, i) => (
                <Space size={6}>
                  <Tooltip title={i.gtin ? `GTIN ${i.gtin}` : 'Sem código de barras'}><BarcodeOutlined style={{ color: i.gtin ? '#52c41a' : '#d9d9d9' }} /></Tooltip>
                  <Tooltip title={i.pesoKg && i.medidasCm ? `${i.pesoKg} kg · ${i.medidasCm.altura}×${i.medidasCm.largura}×${i.medidasCm.comprimento} cm` : 'Sem peso ou medidas'}>
                    <InboxOutlined style={{ color: i.pesoKg && i.medidasCm ? '#52c41a' : '#d9d9d9' }} />
                  </Tooltip>
                </Space>
              ),
            },
            {
              title: '', width: 40,
              render: (_, i) => (!i.ml.mlbId || foraDoMl(i.ml.status)) && (det.itens.length > 1 || foraDoMl(i.ml.status)) && (
                <Popconfirm title={`Tirar ${i.sku} deste anúncio?`} description="Vale na hora." okText="Tirar" onConfirm={() => p.onRemoverItem(i)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
      <FotosMlModal idAnuncio={fotosMl ? det.id : null} idItemInicial={fotosMl?.idItem} onFechar={() => setFotosMl(null)} onImportado={p.onFotoFamilia} />
    </>
  );
};

export default AbaItens;
