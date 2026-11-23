// Lançar em Materiais da obra o que o relatório técnico consumiu (barras de revestimento e filtro, tubo edutor, cabo,
// corda, pré-filtro e cimento), sem digitar de novo. Mostra o que já está lançado na obra para não duplicar.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Checkbox, Empty, Modal, Table, Tag, Typography, message } from 'antd';
import { LinhaMaterialObra, materiaisApi, MaterialPoco } from './obrasApi';
import { consumoDoRelatorio } from './materiaisPoco';

const { Text } = Typography;
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const LancarMateriais: React.FC<{
  aberto: boolean; idObra: number; dados: Record<string, any>; catalogo: MaterialPoco[]; onFechar: () => void;
}> = ({ aberto, idObra, dados, catalogo, onFechar }) => {
  const [naObra, setNaObra] = useState<LinhaMaterialObra[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [lancando, setLancando] = useState(false);
  const consumo = useMemo(() => (aberto ? consumoDoRelatorio(dados, catalogo) : []), [aberto, dados, catalogo]);

  useEffect(() => {
    if (!aberto) return;
    setNaObra(null);
    materiaisApi.daObra(idObra).then(r => {
      setNaObra(r.linhas);
      // já lançado na obra começa desmarcado (para não duplicar)
      const ja = new Set(r.linhas.map(l => l.idMaterial));
      setEscolhidos(consumoDoRelatorio(dados, catalogo).filter(c => !ja.has(c.idMaterial)).map(c => c.idMaterial));
    }).catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os materiais da obra.'));
  }, [aberto, idObra]);   // eslint-disable-line react-hooks/exhaustive-deps

  const lancar = async () => {
    setLancando(true);
    try {
      for (const c of consumo.filter(x => escolhidos.includes(x.idMaterial))) {
        await materiaisApi.adicionar(idObra, { idMaterial: c.idMaterial, qtdPrevista: c.quantidade, qtdUsada: c.quantidade, observacao: `Do relatório técnico (${c.origem})` });
      }
      message.success('Materiais lançados na obra.');
      onFechar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao lançar.'); } finally { setLancando(false); }
  };

  const jaLancado = (id: number) => (naObra || []).filter(l => l.idMaterial === id).reduce((s, l) => s + (l.qtdUsada ?? l.qtdPrevista), 0);

  return (
    <Modal open={aberto} title="Lançar materiais do relatório na obra" width={720} okText={`Lançar ${escolhidos.length} item(ns)`} cancelText="Cancelar"
      okButtonProps={{ disabled: !escolhidos.length }} confirmLoading={lancando} onOk={lancar} onCancel={onFechar} destroyOnHidden>
      {consumo.length === 0 ? (
        <Empty description="Nada para lançar: escolha os materiais do cadastro no revestimento, no tubo edutor, no cabo, na corda e na completação." />
      ) : (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 10 }}
            message="As quantidades saem do relatório: barras pelo trecho e o comprimento da barra do cadastro, metros e sacos informados. Entram como usadas, com o custo do cadastro." />
          <Table size="small" rowKey="idMaterial" dataSource={consumo} pagination={false} loading={naObra === null}
            columns={[
              { key: 'x', width: 36, render: (_, c) => <Checkbox checked={escolhidos.includes(c.idMaterial)} onChange={e => setEscolhidos(l => (e.target.checked ? [...l, c.idMaterial] : l.filter(x => x !== c.idMaterial)))} /> },
              { title: 'Material', render: (_, c) => <><Text strong>{c.nome}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{c.origem}</Text></> },
              { title: 'Quantidade', align: 'right', width: 110, render: (_, c) => `${qtd(c.quantidade)} ${c.unidade}` },
              { title: 'Já na obra', align: 'right', width: 130, render: (_, c) => (jaLancado(c.idMaterial) ? <Tag color="orange" style={{ margin: 0 }}>{qtd(jaLancado(c.idMaterial))} {c.unidade}</Tag> : <Text type="secondary">—</Text>) },
            ]} />
        </>
      )}
    </Modal>
  );
};
