// Traz para o ERP os anúncios que já estão na conta do ML: cada um é ligado a um item do catálogo (sugerido pelo SKU).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Button, Modal, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CloudDownloadOutlined, LinkOutlined, PictureOutlined } from '@ant-design/icons';
import { AnuncioNoMl, anunciosApi, formatarMoeda, ROTULO_STATUS_ML } from './mercadoLivreApi';

const { Text } = Typography;

interface Props { aberto: boolean; onFechar: () => void; onImportados: (ids: number[]) => void }

type Opcao = { value: number; label: string; disabled?: boolean };

/** Escolha do item do ERP com busca no catálogo. */
const ItemErpSelect: React.FC<{ valor: number | null; inicial: Opcao | null; onChange: (id: number | null, opcao: Opcao | null) => void }> = ({ valor, inicial, onChange }) => {
  const [opcoes, setOpcoes] = useState<Opcao[]>(inicial ? [inicial] : []);
  const [buscando, setBuscando] = useState(false);
  const temporizador = useRef<number>();
  const buscar = (texto: string) => {
    window.clearTimeout(temporizador.current);
    if (texto.trim().length < 2) return;
    temporizador.current = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await anunciosApi.candidatos(texto);
        setOpcoes(r.itens.map(i => ({ value: i.idItem, label: `${i.sku} · ${i.nome}${i.idAnuncio ? ` (já no anúncio #${i.idAnuncio})` : ''}`, disabled: !!i.idAnuncio })));
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erro.');
      } finally {
        setBuscando(false);
      }
    }, 300);
  };
  return (
    <Select
      showSearch allowClear style={{ width: '100%' }} placeholder="Buscar item do ERP (SKU ou nome)" value={valor ?? undefined}
      filterOption={false} onSearch={buscar} options={opcoes} notFoundContent={buscando ? <Spin size="small" /> : null}
      popupMatchSelectWidth={false}
      onChange={(v: number | undefined) => onChange(v ?? null, opcoes.find(o => o.value === v) || null)}
    />
  );
};

const ImportarMlModal: React.FC<Props> = ({ aberto, onFechar, onImportados }) => {
  const [itens, setItens] = useState<AnuncioNoMl[]>([]);
  const [jaLigados, setJaLigados] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [ligacoes, setLigacoes] = useState<Record<string, number | null>>({});
  const [selecionados, setSelecionados] = useState<string[]>([]);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    anunciosApi.previaImportacao()
      .then(r => {
        setItens(r.itens);
        setJaLigados(r.jaLigados);
        const iniciais: Record<string, number | null> = {};
        for (const i of r.itens) iniciais[i.mlbId] = i.sugestao && !i.sugestao.idAnuncio ? i.sugestao.idItem : null;
        setLigacoes(iniciais);
        setSelecionados(r.itens.filter(i => iniciais[i.mlbId]).map(i => i.mlbId));
      })
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro.'))
      .finally(() => setCarregando(false));
  }, [aberto]);

  const prontos = selecionados.filter(m => ligacoes[m]);

  const importar = async () => {
    setImportando(true);
    try {
      const r = await anunciosApi.importar(prontos.map(m => ({ mlbId: m, idItem: ligacoes[m]! })));
      message.success(`${r.ligados} anúncio(s) do ML ligados ao ERP.`);
      onImportados(r.ids);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao importar.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <Modal
      open={aberto} onCancel={onFechar} width={1100} destroyOnHidden title={<Space><CloudDownloadOutlined />Importar anúncios do Mercado Livre</Space>}
      footer={
        <Space>
          <Text type="secondary">{prontos.length} para importar</Text>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button type="primary" disabled={!prontos.length} loading={importando} onClick={importar}>Importar {prontos.length || ''}</Button>
        </Space>
      }
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Cada anúncio do ML é ligado a um item do catálogo. O item vem sugerido pelo SKU do anúncio; confira e troque se precisar."
        description={`O preço que está no ML vira o preço do item no anúncio (o ERP não muda sozinho). Anúncios da mesma família no ML entram juntos.${jaLigados ? ` ${jaLigados} anúncio(s) já estão ligados e não aparecem aqui.` : ''}`}
      />
      <Table<AnuncioNoMl>
        size="small" rowKey="mlbId" loading={carregando} dataSource={itens} pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: jaLigados ? 'Todos os anúncios da conta já estão ligados ao ERP.' : 'Nenhum anúncio na conta.' }}
        rowSelection={{
          selectedRowKeys: selecionados, onChange: k => setSelecionados(k as string[]),
          getCheckboxProps: i => ({ disabled: !ligacoes[i.mlbId] }),
        }}
        columns={[
          {
            title: '', width: 52,
            render: (_, i) => i.fotoUrl ? <Avatar shape="square" size={40} src={i.fotoUrl} /> : <Avatar shape="square" size={40} icon={<PictureOutlined />} />,
          },
          {
            title: 'Anúncio no ML',
            render: (_, i) => (
              <div>
                <Text strong>{i.titulo}</Text>
                <div>
                  <Space size={4} wrap>
                    <a href={i.permalink} target="_blank" rel="noreferrer"><Tag icon={<LinkOutlined />}>{i.mlbId}</Tag></a>
                    <Tag color={ROTULO_STATUS_ML[i.status]?.cor}>{ROTULO_STATUS_ML[i.status]?.texto || i.status}</Tag>
                    {i.catalogo && <Tooltip title="Anúncio de catálogo do ML (disputa a página do produto)"><Tag color="purple">catálogo</Tag></Tooltip>}
                    <Text type="secondary" style={{ fontSize: 12 }}>SKU {i.sku || '—'}</Text>
                  </Space>
                </div>
              </div>
            ),
          },
          { title: 'Preço', dataIndex: 'preco', width: 90, align: 'right', render: formatarMoeda },
          { title: 'Estoque', dataIndex: 'estoque', width: 70, align: 'right' },
          {
            title: 'Item do ERP', width: 360,
            render: (_, i) => (
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <ItemErpSelect
                  valor={ligacoes[i.mlbId] ?? null}
                  inicial={i.sugestao ? { value: i.sugestao.idItem, label: `${i.sugestao.sku} · ${i.sugestao.nome}`, disabled: !!i.sugestao.idAnuncio } : null}
                  onChange={id => {
                    setLigacoes(l => ({ ...l, [i.mlbId]: id }));
                    setSelecionados(s => (id ? [...new Set([...s, i.mlbId])] : s.filter(x => x !== i.mlbId)));
                  }}
                />
                {i.sugestao && !i.sugestao.idAnuncio && ligacoes[i.mlbId] === i.sugestao.idItem && <Text type="success" style={{ fontSize: 12 }}>Achado pelo SKU</Text>}
                {i.sugestao?.idAnuncio && <Text type="warning" style={{ fontSize: 12 }}>{i.sugestao.sku} já está no rascunho #{i.sugestao.idAnuncio}: exclua o rascunho para ligar aqui.</Text>}
                {!i.sugestao && <Text type="secondary" style={{ fontSize: 12 }}>SKU não encontrado no ERP: busque o item.</Text>}
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default ImportarMlModal;
