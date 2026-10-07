import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { AtributoFicha, FichaTecnica, getFichaTecnica, salvarFichaTecnica } from './CatalogSku.service';
import CampoAtributo, { PAPEL_ATRIBUTO as PAPEL, ordenarPorPapel } from './CampoAtributo';

const { Text } = Typography;


interface FichaTecnicaCardProps {
  idItem: number;
  onSalvo?: () => void; // ex: atualizar a situação de publicação na ficha
}

/**
 * Atributos do item (herdados da categoria + da família) com edição por tipo.
 * DNA com valor fixo vem da família e não é editado aqui.
 */
export default function FichaTecnicaCard({ idItem, onSalvo }: FichaTecnicaCardProps) {
  const [ficha, setFicha] = useState<FichaTecnica | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editados, setEditados] = useState<Record<number, unknown>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setFicha(await getFichaTecnica(idItem));
      setEditados({});
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Erro ao carregar a ficha técnica.');
    } finally {
      setLoading(false);
    }
  }, [idItem]);

  useEffect(() => { carregar(); }, [carregar]);

  const valorAtual = (a: AtributoFicha) => (a.atributoId in editados ? editados[a.atributoId] : a.valor);
  const alterar = (a: AtributoFicha, valor: unknown) => {
    setEditados(prev => {
      const proximo = { ...prev };
      const original = a.valor ?? '';
      if (String(valor ?? '') === String(original)) delete proximo[a.atributoId];
      else proximo[a.atributoId] = valor;
      return proximo;
    });
  };

  const atributos = useMemo(
    () => ordenarPorPapel(ficha?.atributos || []),
    [ficha]
  );
  const pendentes = atributos.filter(a => a.obrigatorio && !a.valorFixo && (valorAtual(a) === null || String(valorAtual(a) ?? '').trim() === ''));
  const qtdEditados = Object.keys(editados).length;

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      setFicha(await salvarFichaTecnica(idItem, editados));
      setEditados({});
      message.success('Ficha técnica salva.');
      onSalvo?.();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Erro ao salvar a ficha técnica.');
    } finally {
      setSalvando(false);
    }
  };

  const removerEstatico = async (atributoId: number) => {
    setSalvando(true);
    try {
      setFicha(await salvarFichaTecnica(idItem, { [atributoId]: null }));
      message.success('Valor removido.');
      onSalvo?.();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Erro ao remover o valor.');
    } finally {
      setSalvando(false);
    }
  };

  const campo = (a: AtributoFicha) => <CampoAtributo atributo={a} valor={valorAtual(a)} onChange={v => alterar(a, v)} />;

  return (
    <Spin spinning={loading || salvando}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Space wrap size={8}>
            <Text type="secondary">Família:</Text>
            {ficha?.familia ? <Tag color="geekblue">{ficha.familia.nome}</Tag> : <Tag>sem família</Tag>}
            <Text type="secondary">Categoria:</Text>
            {ficha?.categoria ? <Tag>{ficha.categoria.nome}</Tag> : <Tag>sem categoria</Tag>}
          </Space>
          {!ficha?.familia && !ficha?.categoria && (
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
              Sem família nem categoria o item não herda atributos. Vincule-o a uma família no Gerenciador de Catálogos.
            </Text>
          )}
        </Card>

        {pendentes.length > 0 && (
          <Alert type="warning" showIcon message={`Obrigatórios sem valor: ${pendentes.map(p => p.nome).join(', ')}`}
            description="Enquanto faltarem, o item não é publicado no PDV/canais." />
        )}

        <Table
          size="small"
          rowKey="atributoId"
          pagination={false}
          dataSource={atributos}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum atributo herdado" /> }}
          columns={[
            {
              title: 'Atributo', key: 'nome', width: '38%',
              render: (_: unknown, a: AtributoFicha) => (
                <Space size={4}>
                  <Tag color={PAPEL[a.papel]?.color} style={{ fontSize: 10, margin: 0 }}>{PAPEL[a.papel]?.label || a.papel}</Tag>
                  <Text>{a.nome}{a.obrigatorio && <Text type="danger"> *</Text>}</Text>
                  {a.origem === 'categoria' && <Tooltip title="Herdado da categoria"><Tag style={{ fontSize: 10, margin: 0 }}>cat.</Tag></Tooltip>}
                </Space>
              ),
            },
            { title: 'Valor', key: 'valor', render: (_: unknown, a: AtributoFicha) => campo(a) },
          ]}
        />

        {qtdEditados > 0 && (
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button icon={<UndoOutlined />} onClick={() => setEditados({})}>Desfazer</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={salvando} onClick={handleSalvar}>
              Salvar Ficha Técnica ({qtdEditados})
            </Button>
          </Space>
        )}

        {(ficha?.estaticos.length || 0) > 0 && (
          <Card size="small" title="Ficha estática (atributos que saíram da família)" bordered={false} style={{ background: '#fafafa' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              Valores preservados de atributos que não pertencem mais à família/categoria deste item.
            </Text>
            <Space wrap>
              {ficha!.estaticos.map(e => (
                <Tag key={e.atributoId} style={{ padding: '2px 6px' }}>
                  {e.nome}: <b>{e.valor ?? '—'}</b>
                  <Popconfirm title="Remover este valor do item?" onConfirm={() => removerEstatico(e.atributoId)}>
                    <DeleteOutlined style={{ marginLeft: 6, color: '#999', cursor: 'pointer' }} />
                  </Popconfirm>
                </Tag>
              ))}
            </Space>
          </Card>
        )}
      </Space>
    </Spin>
  );
}
