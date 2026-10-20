// Categorias das contas (plano de contas simples): criar, renomear, mudar de grupo e desativar (some das novas contas,
// as antigas continuam com ela).
import React, { useEffect, useState } from 'react';
import { AutoComplete, Button, Drawer, Input, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { CategoriaConta, pagarApi } from './pagarApi';

const { Text } = Typography;

const CategoriasDrawer: React.FC<{ aberto: boolean; onFechar: () => void; onAlterado?: () => void }> = ({ aberto, onFechar, onAlterado }) => {
  const [lista, setLista] = useState<CategoriaConta[]>([]);
  const [nova, setNova] = useState({ grupo: '', nome: '' });
  const [editando, setEditando] = useState<{ id: number; grupo: string; nome: string } | null>(null);

  const carregar = () => pagarApi.categorias().then(setLista).catch(e => message.error(e.message));
  useEffect(() => { if (aberto) carregar(); }, [aberto]);
  const grupos = [...new Set(lista.map(c => c.grupo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const salvar = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); message.success(ok); carregar(); onAlterado?.(); return true; }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); return false; }
  };
  const criar = async () => {
    if (await salvar(() => pagarApi.criarCategoria({ tipo: 'DESPESA', grupo: nova.grupo.trim(), nome: nova.nome.trim() }), 'Categoria criada.')) setNova({ grupo: nova.grupo, nome: '' });
  };

  return (
    <Drawer open={aberto} onClose={onFechar} title="Categorias das contas" width={620} destroyOnHidden>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <AutoComplete style={{ width: '40%' }} placeholder="Grupo (ex.: Consumo)" value={nova.grupo} options={grupos.map(g => ({ value: g }))}
          filterOption={(t, o) => String(o?.value).toLowerCase().includes(t.toLowerCase())} onChange={grupo => setNova(n => ({ ...n, grupo }))} />
        <Input placeholder="Nome (ex.: Água)" value={nova.nome} onChange={e => setNova(n => ({ ...n, nome: e.target.value }))} onPressEnter={criar} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!nova.grupo.trim() || !nova.nome.trim()} onClick={criar}>Criar</Button>
      </Space.Compact>
      <Table<CategoriaConta>
        size="small" rowKey="idCategoria" pagination={false} dataSource={lista.filter(c => c.tipo === 'DESPESA')}
        columns={[
          {
            title: 'Grupo', dataIndex: 'grupo', width: 170,
            render: (v, c) => editando?.id === c.idCategoria
              ? <AutoComplete size="small" style={{ width: '100%' }} value={editando.grupo} options={grupos.map(g => ({ value: g }))} onChange={grupo => setEditando(e => e && { ...e, grupo })} />
              : <Text type="secondary">{v}</Text>,
          },
          {
            title: 'Categoria', dataIndex: 'nome',
            render: (v, c) => editando?.id === c.idCategoria
              ? <Input size="small" value={editando.nome} onChange={e => setEditando(x => x && { ...x, nome: e.target.value })} />
              : <span>{v} {c.uso > 0 && <Text type="secondary" style={{ fontSize: 12 }}>· {c.uso} conta(s)</Text>}</span>,
          },
          {
            title: 'Ativa', width: 70, align: 'center',
            render: (_, c) => <Switch size="small" checked={c.ativo} onChange={ativo => salvar(() => pagarApi.salvarCategoria(c.idCategoria, { tipo: c.tipo, grupo: c.grupo, nome: c.nome, ativo }), ativo ? 'Categoria ativada.' : 'Categoria desativada.')} />,
          },
          {
            title: '', width: 120, align: 'right',
            render: (_, c) => editando?.id === c.idCategoria ? (
              <Space size={4}>
                <Button size="small" type="primary" onClick={async () => {
                  if (await salvar(() => pagarApi.salvarCategoria(c.idCategoria, { tipo: c.tipo, grupo: editando.grupo.trim(), nome: editando.nome.trim(), ativo: c.ativo }), 'Categoria salva.')) setEditando(null);
                }}>Salvar</Button>
                <Button size="small" type="text" onClick={() => setEditando(null)}>×</Button>
              </Space>
            ) : <Button size="small" type="link" onClick={() => setEditando({ id: c.idCategoria, grupo: c.grupo, nome: c.nome })}>Editar</Button>,
          },
        ]}
      />
      <div style={{ marginTop: 8 }}><Tag>Desativar</Tag><Text type="secondary" style={{ fontSize: 12 }}>tira a categoria das contas novas; as que já usam continuam com ela.</Text></div>
    </Drawer>
  );
};

export default CategoriasDrawer;
