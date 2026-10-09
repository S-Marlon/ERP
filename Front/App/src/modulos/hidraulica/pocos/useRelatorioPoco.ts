// Estado da tela do módulo Poços. Sem banco: o rascunho fica no navegador (salvo sozinho a cada alteração)
// e o relatório vai para arquivo XML (exportar/importar) ou para a impressão.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Modal, message } from 'antd';
import dayjs from 'dayjs';
import { baixarArquivo, imprimirHtml } from '../../../shared/core/impressao/saida';
import { Dados, deRascunho, deXml, Empresa, encadear, paraRascunho, paraXml, SecaoId, SECOES_PADRAO, VALORES_INICIAIS } from './relatorioPoco';
import { gerarModelo, MODELOS, ModeloId } from './templatesPoco';

const CHAVE_RASCUNHO = 'erp.poco.rascunho';
const CHAVE_SECOES = 'erp.poco.secoes';
const CHAVE_EMPRESA = 'erp.poco.empresa';

const ler = <T,>(chave: string, padrao: T): T => {
  try { const v = localStorage.getItem(chave); return v ? { ...padrao, ...JSON.parse(v) } : padrao; } catch { return padrao; }
};
const gravar = (chave: string, valor: unknown) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
};

export function useRelatorioPoco() {
  const [form] = Form.useForm();
  const valores: Dados = Form.useWatch([], form) || {};
  const [secoes, setSecoes] = useState<Record<SecaoId, boolean>>(() => ler(CHAVE_SECOES, SECOES_PADRAO));
  const [empresa, setEmpresaEstado] = useState<Empresa>(() => ler(CHAVE_EMPRESA, {}));
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => gravar(CHAVE_SECOES, secoes), [secoes]);
  const setEmpresa = (patch: Partial<Empresa>) => setEmpresaEstado(e => { const n = { ...e, ...patch }; gravar(CHAVE_EMPRESA, n); return n; });
  const alternarSecao = (id: SecaoId, ligado: boolean) => setSecoes(s => ({ ...s, [id]: ligado }));

  // Abre o último rascunho (se houver)
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_RASCUNHO);
      if (bruto) {
        const r = JSON.parse(bruto);
        form.setFieldsValue({ ...VALORES_INICIAIS, ...deRascunho(r.dados || {}) });
        setSalvoEm(r.salvoEm || null);
        if (r.dados?.cliente) message.info(`Rascunho de ${r.dados.cliente} reaberto (salvo em ${r.salvoEm}).`);
        return;
      }
    } catch { /* rascunho ilegível: começa do zero */ }
    form.setFieldsValue(VALORES_INICIAIS);
  }, [form]);

  const salvarRascunho = useCallback(() => {
    const agora = dayjs().format('DD/MM/YYYY HH:mm');
    gravar(CHAVE_RASCUNHO, { salvoEm: agora, dados: paraRascunho(form.getFieldsValue(true)) });
    setSalvoEm(agora);
  }, [form]);

  // Cada camada de perfuração/revestimento começa onde a anterior terminou; o rascunho salva sozinho
  const aoMudar = (mudou: Dados) => {
    if (mudou.perfuracoes) {
      const atual = form.getFieldValue('perfuracoes');
      const ajustada = encadear(atual, 'perfDe', 'perfAte');
      if (JSON.stringify(ajustada) !== JSON.stringify(atual)) form.setFieldValue('perfuracoes', ajustada);
    }
    if (mudou.revestimentos) {
      const atual = form.getFieldValue('revestimentos');
      const ajustada = encadear(atual, 'revDe', 'revAte');
      if (JSON.stringify(ajustada) !== JSON.stringify(atual)) form.setFieldValue('revestimentos', ajustada);
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(salvarRascunho, 600);
  };

  const html = (modelo: ModeloId) => gerarModelo(modelo, form.getFieldsValue(true), { secoes, empresa });

  const imprimir = async (modelo: ModeloId = 'completo') => {
    if (modelo !== 'branco' && !form.getFieldValue('cliente')) {
      const ok = await new Promise<boolean>(res => Modal.confirm({
        title: 'Relatório sem o nome do cliente', content: 'Imprimir assim mesmo?', okText: 'Imprimir', cancelText: 'Voltar',
        onOk: () => res(true), onCancel: () => res(false),
      }));
      if (!ok) return;
    }
    if (modelo === 'branco') { await imprimirHtml(html(modelo)); return; }
    salvarRascunho();
    message.info(`Imprimindo: ${MODELOS.find(m => m.id === modelo)?.nome}`);
    await imprimirHtml(html(modelo));
  };

  const exportar = () => {
    const v = form.getFieldsValue(true);
    const nome = String(v.cliente || 'poco').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40);
    baixarArquivo(paraXml(v), `Relatorio_${nome}_${dayjs().format('YYYY-MM-DD')}.xml`, 'text/xml;charset=utf-8');
    message.success('Arquivo exportado: guarde-o para reabrir este relatório depois.');
  };

  const carregar = (dados: Dados) => {
    form.resetFields();
    form.setFieldsValue({ ...VALORES_INICIAIS, ...dados });
    salvarRascunho();
  };
  const importar = (arquivo: File) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        carregar(deXml(String(leitor.result || ''), new DOMParser()));
        message.success('Relatório importado.');
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
      }
    };
    leitor.readAsText(arquivo);
    return false; // o Upload do antd não envia nada
  };

  const novo = () => Modal.confirm({
    title: 'Começar um relatório novo?',
    content: 'O formulário é limpo. Se precisar deste relatório depois, exporte o arquivo antes.',
    okText: 'Começar novo', okButtonProps: { danger: true }, cancelText: 'Cancelar',
    onOk: () => {
      form.resetFields();
      form.setFieldsValue(VALORES_INICIAIS);
      try { localStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
      setSalvoEm(null);
    },
  });

  return { form, valores, secoes, alternarSecao, empresa, setEmpresa, salvoEm, aoMudar, imprimir, exportar, importar, novo, html };
}
