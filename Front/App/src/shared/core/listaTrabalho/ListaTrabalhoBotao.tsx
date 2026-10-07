// Botão da toolbar para a lista de trabalho: contador, resumo por tarefa e atalhos.
import React, { useState } from 'react';
import { Badge, Button, Popover, Space, Tag, Tooltip } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useListaTrabalho } from './ListaTrabalhoContext';
import { ListaTrabalhoDrawer } from './ListaTrabalhoDrawer';
import { TAGS_LISTA, TagLista } from './listaTrabalho';

interface Props {
  // Estilo do botão (cabeçalho claro ou escuro)
  cor?: string;
}

export const ListaTrabalhoBotao: React.FC<Props> = ({ cor }) => {
  const lista = useListaTrabalho();
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);

  const resumo = (
    <Space direction="vertical" size={8} style={{ width: 240 }}>
      {(Object.keys(TAGS_LISTA) as TagLista[]).map(t => (
        <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag color={TAGS_LISTA[t].color} style={{ margin: 0 }}>{TAGS_LISTA[t].label}</Tag>
          <b>{lista.contagem[t]}</b>
        </div>
      ))}
      <Space style={{ marginTop: 4 }}>
        <Button size="small" type="primary" onClick={() => { setResumoAberto(false); setAberta(true); }}>Abrir lista</Button>
        <Button size="small" disabled={lista.contagem.ETIQUETAR === 0}
          onClick={() => { setResumoAberto(false); navigate('/estoque/etiquetagem'); }}>
          Etiquetar ({lista.contagem.ETIQUETAR})
        </Button>
      </Space>
    </Space>
  );

  return (
    <>
      <Popover content={resumo} title={`Lista de trabalho (${lista.itens.length})`} trigger="click" open={resumoAberto} onOpenChange={setResumoAberto} placement="bottomRight">
        <Tooltip title="Lista de trabalho: etiquetar, comprar, conferir..." placement="bottom">
          <Button type="text" style={{ color: cor }} icon={
            <Badge count={lista.itens.length} size="small" overflowCount={99}>
              <UnorderedListOutlined style={{ fontSize: 18, color: cor }} />
            </Badge>
          } />
        </Tooltip>
      </Popover>
      <ListaTrabalhoDrawer
        open={aberta}
        onClose={() => setAberta(false)}
        extra={lista.contagem.ETIQUETAR > 0 && (
          <Button type="primary" onClick={() => { setAberta(false); navigate('/estoque/etiquetagem'); }}>
            Ir para Etiquetagem ({lista.contagem.ETIQUETAR})
          </Button>
        )}
      />
    </>
  );
};
