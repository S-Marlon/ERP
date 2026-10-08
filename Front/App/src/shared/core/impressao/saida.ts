// Saídas de impressão do navegador: janela de impressão (HTML) e download de arquivo (PRN, TXT...).

/** Imprime um documento HTML num iframe oculto (não abre aba nova nem é bloqueado como pop-up). */
export const imprimirHtml = (html: string): Promise<void> => new Promise(resolve => {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    resolve();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const janela = iframe.contentWindow;
  const finalizar = () => { setTimeout(() => { iframe.remove(); resolve(); }, 500); };
  // Espera o layout (e os SVGs) antes de imprimir
  setTimeout(() => {
    janela.focus();
    janela.onafterprint = finalizar;
    janela.print();
    // Navegadores que não disparam onafterprint
    setTimeout(finalizar, 60000);
  }, 250);
});

/** Baixa um conteúdo como arquivo (PRN usa windows-1252 no nome do tipo, conteúdo já é ASCII). */
export const baixarArquivo = (conteudo: string, nomeArquivo: string, tipo = 'text/plain;charset=windows-1252') => {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Baixa bytes como arquivo (PRN com imagem: o conteúdo é binário e não pode passar por texto). */
export const baixarBinario = (bytes: Uint8Array, nomeArquivo: string) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
