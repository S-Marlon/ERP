// Mover itens para uma família (ou tirar da família) pelo fluxo do PIM: os atributos de cada item
// (DNA, grade, ficha) são preenchidos na própria família, com o tipo certo de cada atributo.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Flex, List, Modal, Select, Tag, Typography, message } from 'antd';
import { ClusterOutlined } from '@ant-design/icons';
import { getFamilies, vincularItensFamilia } from '../familias/FamilyManager.api';
import type { Grupo } from '../familias/CatalogManager.types';

export interface ItemParaMover { idItem: number; sku: string; nome: string; familiaId?: number | null }

interface Props {
  itens: ItemParaMover[];
  onFechar: () => void;
  onConcluido: () => void;
}

const COR_STATUS: Record<string, string> = { ATIVO: 'green', RASCUNHO: 'gold', INATIVO: 'default', BLOQUEADO_INCONSISTENCIA: 'red' };

export const MoverParaFamiliaModal: React.FC<Props> = ({ itens, onFechar, onConcluido }) => {
  const navigate = useNavigate();
  const [familias, setFamilias] = useState<Grupo[]>([]);
  const [destino, setDestino] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const aberto = itens.length > 0;

  useEffect(() => {
    if (!aberto) return;
    setDestino(null);
    getFamilies().then(setFamilias).catch(e => message.error(e.message));
  }, [aberto]);

  const mover = async () => {
    if (!destino) return;
    setSalvando(true);
    try {
      // Pedido explícito de mudar: itens de outra família também vêm (mover = true)
      const r = await vincularItensFamilia(destino, itens.map(i => i.idItem), 'adicionar', true);
      const fam = familias.find(f => f.id === destino);
      onConcluido();
      Modal.success({
        title: `${r.alterados} item(ns) na família "${fam?.nome || ''}"`,
        content: 'Agora preencha os atributos de cada item (DNA e grade) na família: o nome e o SKU são montados por eles.',
        okText: 'Abrir a família',
        closable: true,
        onOk: () => navigate(`/catalogo/familias?familia=${destino}`),
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao mover os itens.');
    } finally {
      setSalvando(false);
    }
  };

  const jaEmFamilia = itens.filter(i => i.familiaId && String(i.familiaId) !== destino).length;

  return (
    <Modal open={aberto} onCancel={onFechar} width={620} destroyOnHidden
      title={<span><ClusterOutlined /> Mover para família</span>}
      footer={(
        <Flex justify="space-between" gap={8} wrap>
          <Button type="link" onClick={() => navigate('/catalogo/familias')}>Criar família nova…</Button>
          <Flex gap={8}>
            <Button onClick={onFechar}>Cancelar</Button>
            <Button type="primary" disabled={!destino} loading={salvando} onClick={mover}>Mover {itens.length} item(ns)</Button>
          </Flex>
        </Flex>
      )}>
      <Flex vertical gap={12}>
        <Select showSearch optionFilterProp="label" placeholder="Escolha a família de destino" style={{ width: '100%' }}
          value={destino ?? undefined} onChange={setDestino}
          options={familias.map(f => ({
            value: f.id,
            label: `${f.nome}${f.categoriaPaiNome ? ` · ${f.categoriaPaiNome}` : ''}`,
          }))}
          optionRender={o => {
            const f = familias.find(x => x.id === o.value);
            return (
              <Flex justify="space-between" gap={8}>
                <span>{f?.nome}{f?.categoriaPaiNome ? <Typography.Text type="secondary"> · {f.categoriaPaiNome}</Typography.Text> : null}</span>
                {f?.status && <Tag color={COR_STATUS[f.status] || 'default'} style={{ margin: 0 }}>{f.status.toLowerCase()}</Tag>}
              </Flex>
            );
          }} />
        {jaEmFamilia > 0 && (
          <Alert type="warning" showIcon title={`${jaEmFamilia} item(ns) saem da família atual`}
            description="Eles passam a usar os atributos da família de destino; os valores de grade precisam ser preenchidos de novo lá." />
        )}
        <List size="small" bordered style={{ maxHeight: 220, overflow: 'auto' }} dataSource={itens}
          renderItem={i => <List.Item><span><Tag style={{ margin: 0 }}>{i.sku}</Tag> {i.nome}</span></List.Item>} />
      </Flex>
    </Modal>
  );
};

export default MoverParaFamiliaModal;
