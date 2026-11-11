// WhatsApp sem API: link wa.me com o texto pronto (o arquivo vai pelo compartilhamento do sistema ou anexado à mão).

/** Link do WhatsApp: número com DDD; sem DDI recebe o 55 do Brasil. Sem número abre para escolher o contato. */
export const linkWhatsapp = (celular: string, texto: string) => {
  let numero = String(celular || '').replace(/\D/g, '');
  if (numero.length === 10 || numero.length === 11) numero = `55${numero}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
};

/** Primeiro telefone que aparece num texto livre ("João (11) 98888-7777"); null se não tiver. */
export const telefoneDoTexto = (texto?: string | null) => {
  const achado = String(texto || '').match(/(?:\+?55\s*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]?\d{4}/);
  if (!achado) return null;
  const d = achado[0].replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13 ? d : null;
};

/** Telefone com máscara para mostrar: (11) 98888-7777. */
export const formatarTelefone = (v?: string | null) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v || '';
};
