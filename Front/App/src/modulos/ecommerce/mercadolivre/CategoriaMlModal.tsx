// Escolha da categoria do ML: sugestões pelo título, navegação pela árvore ou o código MLB direto.
import React, { useEffect, useState } from 'react';
import { Breadcrumb, Button, Divider, Empty, Input, List, Modal, Space, Spin, Tag, Typography, message } from 'antd';
import { BulbOutlined, CheckOutlined, RightOutlined } from '@ant-design/icons';
import { anunciosApi, CategoriaNo } from './mercadoLivreApi';

const { Text } = Typography;

interface Props {
  aberto: boolean;
  titulo: string;
  atual: string | null;
  onFechar: () => void;
  onEscolher: (id: string) => Promise<void> | void;
}

const CategoriaMlModal: React.FC<Props> = ({ aberto, titulo, atual, onFechar, onEscolher }) => {
  const [texto, setTexto] = useState(titulo);
  const [sugestoes, setSugestoes] = useState<{ id: string; nome: string; dominio: string }[]>([]);
  const [sugerindo, setSugerindo] = useState(false);
  const [trilha, setTrilha] = useState<{ id: string | null; nome: string }[]>([]);
  const [no, setNo] = useState<CategoriaNo | null>(null);
  const [navegando, setNavegando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const sugerir = async (q: string) => {
    if (!q.trim()) return;
    setSugerindo(true);
    try { setSugestoes(await anunciosApi.sugerirCategorias(q)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setSugerindo(false); }
  };

  const abrir = async (id: string | null, nome: string, novaTrilha?: { id: string | null; nome: string }[]) => {
    setNavegando(true);
    try {
      const c = await anunciosApi.categoria(id);
      setNo(c);
      setTrilha(novaTrilha || [...trilha, { id, nome }]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setNavegando(false);
    }
  };

  useEffect(() => {
    if (!aberto) return;
    setTexto(titulo);
    setCodigo('');
    setSugestoes([]);
    sugerir(titulo);
    abrir(null, 'Todas', [{ id: null, nome: 'Todas' }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const escolher = async (id: string) => {
    setSalvando(true);
    try { await onEscolher(id); } finally { setSalvando(false); }
  };

  return (
    <Modal open={aberto} onCancel={onFechar} footer={null} width={760} destroyOnHidden title="Categoria do Mercado Livre">
      <Spin spinning={salvando}>
        <Text type="secondary">A categoria define os atributos que o ML pede e a comissão. Escolha a mais específica.</Text>

        <Divider titlePlacement="start" plain style={{ margin: '12px 0 8px' }}><BulbOutlined /> Sugestões pelo título</Divider>
        <Input.Search value={texto} onChange={e => setTexto(e.target.value)} onSearch={sugerir} enterButton="Sugerir" loading={sugerindo} />
        <List
          size="small" style={{ marginTop: 8 }} loading={sugerindo} dataSource={sugestoes}
          locale={{ emptyText: <Text type="secondary">Sem sugestão para esse texto: tente palavras mais simples (ex.: "terminal mangueira hidráulica") ou navegue abaixo.</Text> }}
          renderItem={s => (
            <List.Item actions={[<Button key="u" size="small" type={s.id === atual ? 'default' : 'primary'} icon={<CheckOutlined />} onClick={() => escolher(s.id)}>{s.id === atual ? 'Atual' : 'Usar'}</Button>]}>
              <List.Item.Meta title={<Space>{s.nome}<Tag>{s.id}</Tag></Space>} description={s.dominio} />
            </List.Item>
          )}
        />

        <Divider titlePlacement="start" plain style={{ margin: '12px 0 8px' }}>Navegar pelas categorias</Divider>
        <Breadcrumb
          items={trilha.map((t, k) => ({
            title: k < trilha.length - 1 ? <a onClick={() => abrir(t.id, t.nome, trilha.slice(0, k + 1))}>{t.nome}</a> : t.nome,
          }))}
        />
        <Spin spinning={navegando}>
          {no && no.id && no.final ? (
            <Space style={{ marginTop: 12 }}>
              <Text>Categoria final: <Text strong>{no.nome}</Text> <Tag>{no.id}</Tag></Text>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => escolher(no.id!)}>Usar esta</Button>
            </Space>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
              {no?.filhos.length ? (
                <List
                  size="small" dataSource={no.filhos}
                  renderItem={f => (
                    <List.Item style={{ cursor: 'pointer' }} onClick={() => abrir(f.id, f.nome)}>
                      <span>{f.nome}</span><RightOutlined style={{ color: '#bbb' }} />
                    </List.Item>
                  )}
                />
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </div>
          )}
        </Spin>

        <Divider titlePlacement="start" plain style={{ margin: '12px 0 8px' }}>Já sabe o código?</Divider>
        <Space.Compact>
          <Input placeholder="MLB455026" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} style={{ width: 200 }} />
          <Button disabled={!/^MLB\d+$/.test(codigo.trim())} onClick={() => escolher(codigo.trim())}>Usar código</Button>
        </Space.Compact>
      </Spin>
    </Modal>
  );
};

export default CategoriaMlModal;
