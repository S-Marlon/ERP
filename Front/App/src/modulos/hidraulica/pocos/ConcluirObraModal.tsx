// Obra › "Concluir a obra": antes de fechar, lança o custo real que faltou (horas da equipe e km já sugeridos pelo que
// falta da estimativa, diesel, desgaste, despesas, terceiros), avisa material sem conferir e mostra a margem real ao
// vivo. "Lançar e concluir" grava os custos e conclui; "Concluir sem lançar" fecha como antes.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Col, Input, Modal, Row, Space, Statistic, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { CampoData, CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustoRealForm, custosReaisApi, CustosReaisDados } from './obrasApi';
import { compararEstimadoReal, faltaDaEstimativa, TIPOS_CUSTO_REAL, TipoCustoReal } from './custoObra';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Linhas do fechamento: horas e km por quantidade; os demais em R$. */
const SO_VALOR: TipoCustoReal[] = ['COMBUSTIVEL', 'DESGASTE', 'DESPESA', 'TRANSPORTE', 'TERCEIRO'];
interface Rascunho { horas: number | null; custoHora: number | null; km: number | null; custoKm: number | null; valores: Partial<Record<TipoCustoReal, number | null>>; terceiroDescricao: string }

/** O que o rascunho vira de lançamentos (só o que tem valor). */
const lancamentosDoRascunho = (r: Rascunho, data: string): CustoRealForm[] => [
  ...(r.horas && r.custoHora !== null ? [{ data, tipo: 'EQUIPE' as const, descricao: 'Fechamento da obra', quantidade: r.horas, valorUnitario: r.custoHora, valor: null }] : []),
  ...(r.km && r.custoKm !== null ? [{ data, tipo: 'KM' as const, descricao: 'Fechamento da obra', quantidade: r.km, valorUnitario: r.custoKm, valor: null }] : []),
  ...SO_VALOR.filter(t => (r.valores[t] || 0) > 0).map(t => ({
    data, tipo: t, descricao: t === 'TERCEIRO' ? r.terceiroDescricao.trim() || null : 'Fechamento da obra', quantidade: null, valorUnitario: null, valor: r.valores[t]!,
  })),
];

export const ConcluirObraModal: React.FC<{
  aberto: boolean; idObra: number; perfuracao: boolean;
  onFechar: () => void; onConcluir: () => Promise<void>; onVerMateriais: () => void;
}> = ({ aberto, idObra, perfuracao, onFechar, onConcluir, onVerMateriais }) => {
  const [d, setD] = useState<CustosReaisDados | null>(null);
  const [rasc, setRasc] = useState<Rascunho | null>(null);
  const [data, setData] = useState(dayjs().format('YYYY-MM-DD'));
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setD(null); setRasc(null); setData(dayjs().format('YYYY-MM-DD'));
    custosReaisApi.carregar(idObra).then(x => {
      setD(x);
      const falta = faltaDaEstimativa(x.estimativa?.resultado as any, x.estimativa?.entrada as any, x.lancamentos);
      setRasc({ horas: falta.horas || null, custoHora: x.empresa.custoHoraEquipe || null, km: falta.km || null, custoKm: x.empresa.custoKm || null, valores: {}, terceiroDescricao: '' });
    }).catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os custos.'));
  }, [aberto, idObra]);

  const novos = rasc ? lancamentosDoRascunho(rasc, data) : [];
  const valorDe = (l: CustoRealForm) => (l.quantidade !== null ? r2(l.quantidade * (l.valorUnitario || 0)) : l.valor || 0);
  const c = d ? compararEstimadoReal(d.estimativa?.resultado as any, {
    materiais: d.materiais.materiais, bomba: d.materiais.bomba,
    lancamentos: [...d.lancamentos, ...novos.map(l => ({ tipo: l.tipo, quantidade: l.quantidade, valor: valorDe(l) }))],
  }, d.total, d.empresa.deducoesPct) : null;
  const ja = (tipo: TipoCustoReal) => (d ? r2(d.lancamentos.filter(l => l.tipo === tipo).reduce((s, l) => s + l.valor, 0)) : 0);
  const qtdJa = (tipo: TipoCustoReal) => (d ? r2(d.lancamentos.filter(l => l.tipo === tipo).reduce((s, l) => s + (l.quantidade || 0), 0)) : 0);
  const mudar = (x: Partial<Rascunho>) => setRasc(r => (r ? { ...r, ...x } : r));
  const jaTexto = (tipo: TipoCustoReal) => (ja(tipo) ? <Text type="secondary" style={{ fontSize: 11 }}>já lançado {brl(ja(tipo))}{qtdJa(tipo) ? ` (${num(qtdJa(tipo))} ${tipo === 'EQUIPE' ? 'h' : 'km'})` : ''}</Text> : null);

  const concluir = async (lancar: boolean) => {
    setGravando(true);
    try {
      // um por vez, limpando o campo de cada um que entrou (se der erro no meio, tentar de novo não duplica)
      if (lancar) for (const l of novos) {
        await custosReaisApi.lancar(idObra, l);
        if (l.tipo === 'EQUIPE') mudar({ horas: null }); else if (l.tipo === 'KM') mudar({ km: null });
        else setRasc(r => (r ? { ...r, valores: { ...r.valores, [l.tipo]: null } } : r));
      }
      await onConcluir();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao lançar os custos.');
      custosReaisApi.carregar(idObra).then(setD).catch(() => undefined);   // o que já entrou aparece como "já lançado"
    } finally { setGravando(false); }
  };

  const corMargem = !c || c.margemReal === null ? undefined : c.margemReal < 0 ? '#cf1322' : d && c.margemReal < d.empresa.margemMinimaPct ? '#d46b08' : '#389e0d';

  return (
    <Modal open={aberto} title="Concluir a obra" width={760} onCancel={onFechar} destroyOnHidden
      footer={[
        <Button key="c" onClick={onFechar}>Voltar</Button>,
        <Button key="s" loading={gravando} onClick={() => concluir(false)}>Concluir sem lançar</Button>,
        <Button key="l" type="primary" loading={gravando} disabled={!d} onClick={() => concluir(true)}>
          {novos.length ? `Lançar ${novos.length} custo(s) e concluir` : 'Concluir'}
        </Button>,
      ]}>
      {!d || !rasc || !c ? <div style={{ padding: 40, textAlign: 'center' }}><Text type="secondary">Carregando os custos...</Text></div> : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Text type="secondary">
            Lance o que a obra custou além dos materiais, para o resultado sair certo.
            {d.estimativa ? ' Horas e km já vêm com o que falta pela estimativa do orçamento: corrija se foi diferente.' : ''}
            {perfuracao ? ' Ao concluir, a ficha do poço recebe a profundidade, a vazão e os níveis do relatório.' : ''}
          </Text>
          {d.materiais.semConferir > 0 && (
            <Alert type="warning" showIcon message={`${d.materiais.semConferir} material(is) sem conferir o usado: entra o previsto.`}
              action={<Button size="small" onClick={onVerMateriais}>Conferir materiais</Button>} />
          )}
          {!d.materiais.linhas && <Alert type="info" showIcon message="Nenhum material lançado nesta obra."
            action={<Button size="small" onClick={onVerMateriais}>Lançar materiais</Button>} />}

          <Row gutter={[10, 8]} align="bottom">
            <Col xs={12} md={6}><Text>Data dos lançamentos</Text>
              <CampoData style={{ width: '100%' }} allowClear={false} value={dayjs(data)} onChange={v => { if (v && !Array.isArray(v)) setData(v.format('YYYY-MM-DD')); }} />
            </Col>
          </Row>
          <Row gutter={[10, 10]}>
            <Col xs={12} md={6}>
              <Text>Horas da equipe</Text>
              <CampoNumero min={0} suffix="h" style={{ width: '100%' }} value={rasc.horas ?? undefined} onChange={v => mudar({ horas: v === null || v === undefined ? null : Number(v) })} />
              {jaTexto('EQUIPE')}
            </Col>
            <Col xs={12} md={6}>
              <Text>Custo da hora</Text>
              <CampoDinheiro min={0} style={{ width: '100%' }} value={rasc.custoHora ?? undefined} onChange={v => mudar({ custoHora: v === null || v === undefined ? null : Number(v) })} />
            </Col>
            <Col xs={12} md={6}>
              <Text>Km rodados</Text>
              <CampoNumero min={0} suffix="km" style={{ width: '100%' }} value={rasc.km ?? undefined} onChange={v => mudar({ km: v === null || v === undefined ? null : Number(v) })} />
              {jaTexto('KM')}
            </Col>
            <Col xs={12} md={6}>
              <Text>Custo do km</Text>
              <CampoDinheiro min={0} style={{ width: '100%' }} value={rasc.custoKm ?? undefined} onChange={v => mudar({ custoKm: v === null || v === undefined ? null : Number(v) })} />
            </Col>
            {SO_VALOR.map(t => (
              <Col xs={12} md={6} key={t}>
                <Text>{TIPOS_CUSTO_REAL[t].texto}</Text>
                <CampoDinheiro min={0} style={{ width: '100%' }} placeholder={TIPOS_CUSTO_REAL[t].dica} value={rasc.valores[t] ?? undefined}
                  onChange={v => mudar({ valores: { ...rasc.valores, [t]: v === null || v === undefined ? null : Number(v) } })} />
                {jaTexto(t)}
              </Col>
            ))}
            {(rasc.valores.TERCEIRO || 0) > 0 && (
              <Col span={24}>
                <Text>Terceiros: o quê</Text>
                <Input maxLength={150} placeholder="retroescavadeira, munck, frete..." value={rasc.terceiroDescricao} onChange={e => mudar({ terceiroDescricao: e.target.value })} />
              </Col>
            )}
          </Row>

          <div style={{ background: 'rgba(0,0,0,.025)', borderRadius: 8, padding: '10px 12px' }}>
            <Row gutter={[12, 8]}>
              <Col xs={12} md={6}><Statistic title="Cobrado" value={brl(d.total)} valueStyle={{ fontSize: 16 }} /></Col>
              <Col xs={12} md={6}>
                <Statistic title="Custo real" value={brl(c.custoReal)} valueStyle={{ fontSize: 16 }} />
                {c.custoEstimado !== null && <Text type="secondary" style={{ fontSize: 11 }}>estimado {brl(c.custoEstimado)}</Text>}
              </Col>
              <Col xs={12} md={6}><Statistic title="Sobra" value={brl(c.lucroReal)} valueStyle={{ fontSize: 16, color: c.lucroReal !== null && c.lucroReal < 0 ? '#cf1322' : undefined }} /></Col>
              <Col xs={12} md={6}>
                <Statistic title="Margem real" value={pct(c.margemReal)} valueStyle={{ fontSize: 16, color: corMargem }} />
                {c.margemEstimada !== null && <Text type="secondary" style={{ fontSize: 11 }}>estimada {pct(c.margemEstimada)}</Text>}
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 11 }}>Com os valores acima, materiais e {pct(c.deducoesPct)} de impostos/taxas. Detalhe em "Custos e resultado".</Text>
          </div>
        </Space>
      )}
    </Modal>
  );
};
