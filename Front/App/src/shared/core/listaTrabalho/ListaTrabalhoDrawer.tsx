// Painel da lista de trabalho (será aberto pela toolbar; já usado na Consulta de Saldo e na Etiquetagem).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Drawer, Empty, InputNumber, Popconfirm, Segmented, Space, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useListaTrabalho } from './ListaTrabalhoContext';
import { ItemListaTrabalho, TAGS_LISTA, TagLista } from './listaTrabalho';

interface Props {
  open: boolean;
  onClose: () => void;
  tagInicial?: TagLista | 'TODAS';
  // Ações da tela que abriu (ex.: "Ir para Etiquetagem")
  extra?: React.ReactNode;
}

export const ListaTrabalhoDrawer: React.FC<Props> = ({ open, onClose, tagInicial = 'TODAS', extra }) => {
  const lista = useListaTrabalho();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<TagLista | 'TODAS'>(tagInicial);
  // Aberto por um atalho de tarefa: já vem filtrado nela
  useEffect(() => { if (open) setFiltro(tagInicial); }, [open, tagInicial]);

  const itens = useMemo(
    () => (filtro === 'TODAS' ? lista.itens : lista.comTag(filtro)),
    [lista, filtro]
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={880}
      title={`Lista de trabalho (${lista.itens.length})`}
      extra={
        <Space>
          {extra}
          <Popconfirm
            title={filtro === 'TODAS' ? 'Esvaziar toda a lista?' : `Concluir "${TAGS_LISTA[filtro].label}" para todos?`}
            description={filtro === 'TODAS' ? undefined : 'Itens sem outra tarefa saem da lista.'}
            onConfirm={() => (filtro === 'TODAS' ? lista.limparTudo() : lista.concluirTag(filtro))}
            okText="Sim"
            cancelText="Não"
            disabled={itens.length === 0}
          >
            <Button danger disabled={itens.length === 0}>{filtro === 'TODAS' ? 'Esvaziar' : 'Concluir todos'}</Button>
          </Popconfirm>
        </Space>
      }
    >
      <Segmented
        style={{ marginBottom: 12 }}
        value={filtro}
        onChange={v => setFiltro(v as TagLista | 'TODAS')}
        options={[
          { value: 'TODAS', label: `Todas (${lista.itens.length})` },
          ...(Object.keys(TAGS_LISTA) as TagLista[]).map(t => ({ value: t, label: `${TAGS_LISTA[t].label} (${lista.contagem[t]})` })),
        ]}
      />
      <Table<ItemListaTrabalho>
        size="small"
        rowKey="idItem"
        dataSource={itens}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="Nada na lista. Use os botões de lista nas telas para incluir itens." /> }}
        columns={[
          {
            title: 'Item', key: 'item',
            render: (_, i) => (
              <div>
                <div style={{ fontWeight: 600 }}>{i.nome}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{i.sku}{i.origem ? ` · incluído em ${i.origem}` : ''}</div>
              </div>
            ),
          },
          {
            title: 'Tarefas', key: 'tags', width: 280,
            render: (_, i) => (
              <Space size={[4, 4]} wrap>
                {(Object.keys(TAGS_LISTA) as TagLista[]).map(t => (
                  <Tooltip key={t} title={TAGS_LISTA[t].descricao}>
                    <Tag.CheckableTag
                      checked={i.tags.includes(t)}
                      onChange={() => (i.tags.includes(t) ? lista.removerTag(i.idItem, t) : lista.alternarTag(i.idItem, t))}
                      style={i.tags.includes(t) ? undefined : { border: '1px dashed #cbd5e1' }}
                    >
                      {TAGS_LISTA[t].label}
                    </Tag.CheckableTag>
                  </Tooltip>
                ))}
              </Space>
            ),
          },
          {
            title: 'Qtd', key: 'qtd', width: 90,
            render: (_, i) => (
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                value={i.quantidade}
                placeholder="-"
                onChange={v => lista.atualizar(i.idItem, { quantidade: v === null ? undefined : Number(v) })}
              />
            ),
          },
          {
            title: '', key: 'acao', width: 120,
            render: (_, i) => (i.tags.includes('REVISAR') ? (
              <Tooltip title="Abre a ficha do produto no Gerenciador; ao fechar, pergunta se a revisão terminou">
                <Button size="small" icon={<EditOutlined />} onClick={() => { onClose(); navigate(`/catalogo/gerenciador?editar=${i.idItem}`); }}>
                  Abrir cadastro
                </Button>
              </Tooltip>
            ) : null),
          },
          {
            title: '', key: 'x', width: 40,
            render: (_, i) => (
              <Tooltip title="Tirar da lista">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => lista.remover(i.idItem)} />
              </Tooltip>
            ),
          },
        ]}
      />
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
        A lista fica salva neste navegador e continua disponível ao trocar de tela ou recarregar a página.
      </div>
    </Drawer>
  );
};
