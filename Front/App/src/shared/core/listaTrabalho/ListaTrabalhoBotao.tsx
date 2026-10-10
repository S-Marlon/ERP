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
  const [tagAberta, setTagAberta] = useState<TagLista | 'TODAS'>('TODAS');

  // Para onde cada tarefa leva (as sem tela própria abrem a lista filtrada)
  const ROTA_DA_TAG: Partial<Record<TagLista, { rota: string; texto: string }>> = {
    ETIQUETAR: { rota: '/estoque/etiquetagem', texto: 'Etiquetar' },
    PRECIFICAR: { rota: '/catalogo/preco', texto: 'Precificar' },
    COMPRAR: { rota: '/compras', texto: 'Compras' },
  };
  const abrirTarefa = (t: TagLista) => {
    setResumoAberto(false);
    const destino = ROTA_DA_TAG[t];
    if (destino) { navigate(destino.rota); return; }
    setTagAberta(t);
    setAberta(true);
  };

  const resumo = (
    <Space direction="vertical" size={8} style={{ width: 300 }}>
      {(Object.keys(TAGS_LISTA) as TagLista[]).map(t => (
        <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Tooltip title={TAGS_LISTA[t].descricao} placement="left">
            <Tag color={TAGS_LISTA[t].color} style={{ margin: 0 }}>{TAGS_LISTA[t].label}</Tag>
          </Tooltip>
          <Space size={8}>
            <b>{lista.contagem[t]}</b>
            <Button size="small" type="link" style={{ padding: 0, width: 70, textAlign: 'right' }} disabled={lista.contagem[t] === 0} onClick={() => abrirTarefa(t)}>
              {ROTA_DA_TAG[t]?.texto || 'Ver itens'} →
            </Button>
          </Space>
        </div>
      ))}
      <Button size="small" type="primary" block style={{ marginTop: 4 }} onClick={() => { setResumoAberto(false); setTagAberta('TODAS'); setAberta(true); }}>
        Abrir lista completa
      </Button>
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
        tagInicial={tagAberta}
        extra={(
          <Space>
            {lista.contagem.PRECIFICAR > 0 && (
              <Button onClick={() => { setAberta(false); navigate('/catalogo/preco'); }}>
                Ir para Precificação ({lista.contagem.PRECIFICAR})
              </Button>
            )}
            {lista.contagem.ETIQUETAR > 0 && (
              <Button type="primary" onClick={() => { setAberta(false); navigate('/estoque/etiquetagem'); }}>
                Ir para Etiquetagem ({lista.contagem.ETIQUETAR})
              </Button>
            )}
          </Space>
        )}
      />
    </>
  );
};
