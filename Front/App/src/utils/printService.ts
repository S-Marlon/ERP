// utils/printService.ts

interface ItemVenda {
  codigo?: string;
  name: string;
  quantity: number;
  price: number;
  desconto?: number;
  unidade?: string; // 👈 NOVO
}

interface ImpressaoDados {
  cliente: string;
  cpf?: string;
  itens: ItemVenda[];
  total: number;
pagamentos: { metodo: string; valor: number; parcelas?: number }[];
  troco: number;
  numero: string;
}

export const imprimirExtratoElgin = (dados: ImpressaoDados) => {
const printWindow = window.open('', '_blank', 'width=350,height=600');

const CNPJ = "61.225.297/0001-88";
const CEL = "(11) 99995-5005";
const END = "Rua Otávio Passos, 274 - Alvinópolis - Atibaia/SP";

if (!printWindow) {
    alert("O bloqueador de pop-ups impediu a impressão!");
    return;
  }

const logoAscii = `
 █████  ████████ ██ ███    ███  █████  ███    ██  ██████  
██   ██    ██    ██ ████  ████ ██   ██ ████   ██ ██       
███████    ██    ██ ██ ████ ██ ███████ ██ ██  ██ ██   ███ 
██   ██    ██    ██ ██  ██  ██ ██   ██ ██  ██ ██ ██    ██ 
██   ██    ██    ██ ██      ██ ██   ██ ██   ████  ██████  
`;

const conteudo = `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 72mm auto; margin: 0; }
        html, body {
            width: 72mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            margin: 0; 
        padding: 2mm; /* Um pequeno respiro nas laterais */
            color: #000;
            line-height: 1.2;
            
        }
        
        /* Estilo para o Logo ASCII */
      .ascii-logo {
    font-family: 'Courier New', Courier, monospace;
    font-size: 6px; /* Reduzi um pouco para garantir que não quebre a linha em 72mm */
    line-height: 7px; /* Quase o mesmo tamanho da fonte para colar as linhas */
    white-space: pre;
    text-align: center;
    font-weight: bold; /* Deixa o preenchimento mais denso */
    display: block;
    margin-bottom: 8px;
    letter-spacing: -0.5px; /* Cola uma letra na outra horizontalmente */
}

        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .hr { border-bottom: 1px dashed #000; margin: 5px 0; }
        .flex { display: flex; justify-content: space-between; }
        
        .titulo { font-size: 14px; margin: 5px 0; border-y: 1px solid #000; }
        
        .tabela-itens { width: 100%; border-collapse: collapse; margin-top: 5px; }
        .tabela-itens th { text-align: left; border-bottom: 1px solid #000; font-size: 10px; }
        .tabela-itens th,
.tabela-itens td {
    padding: 2px 3px; /* 2px vertical, 3px horizontal */
    vertical-align: top;
}
        
        .tabela-itens th.col-total {
  text-align: right;
}
        
         .col-qtd {
  text-align: center;
}
        .col-desc {
  width: 50%;
  word-break: keep-all;       /* NÃO quebra palavra no meio */
  white-space: normal;        /* permite quebra só em espaços */
}
        .col-total {
  text-align: right;
  white-space: nowrap;
}

        .footer { margin-top: 15px; font-size: 9px; }
        .cut-area { height: 15mm; } /* Espaço para o corte manual ou automático */

       @media print {
        header, footer { display: none !important; }
        .no-print { display: none !important; }
    }
    </style>
</head>
<body>
    <div class="ascii-logo">${logoAscii}</div>
    
    <div class="text-center bold" style="font-size: 16px;">ATIMANG</div>
    <div class="text-center">MANUTENCAO E PECAS HIDRAULICAS</div>

    <div class="text-center">${CNPJ}</div> - <div class="text-center">${CEL}</div> 
    <div class="text-center">${END}</div>

    <div class="hr"></div>

    <div class="text-center bold" style="letter-spacing: 2px;">EXTRATO DE VENDA Nº ${dados.numero}</div>
    <div class="text-center">${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</div>
    
    <div class="hr"></div>
    <div class="flex">
    <span class="bold">CLIENTE:</span>
    <span>${dados.cliente.toUpperCase()}</span>
</div>

${dados.cpf ? `
<div class="flex">
    <span class="bold">CPF:</span>
    <span>${dados.cpf}</span>
</div>
` : ''}
    <div class="hr"></div>
    
    <table class="tabela-itens">
        <thead>
    <tr class="bold">
        <th class="col-qtd">COD</th>
        <th class="col-desc">DESCRICAO</th>
        <th class="col-qtd">UoM</th>
        <th class="col-total">VALOR</th>
        <th class="col-qtd">QTD</th>
        <th class="col-total">TOTAL</th>
    </tr>
</thead>
       <tbody>
${dados.itens.map(item => {
  const desconto = item.desconto || 0;
  const totalItem = (item.quantity * item.price) - desconto;

  return `
    <tr>
        <td class="col-qtd">${item.codigo || '-'}</td>
        <td class="col-desc">${item.name.toUpperCase()}</td>
        <td class="col-qtd">${item.unidade}</td>
        
        <td class="col-total">
        ${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        
        ${desconto > 0 ? `
            <br>
            <span style="font-size:9px;">
            Desc: -${desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            ` : ''}
            </td>
            <td class="col-qtd">${item.quantity}</td>

        <td class="col-total">
            R$${totalItem}
        </td>
    </tr>
  `;
}).join('')}
</tbody>
    </table>

    <div class="hr" style="border-bottom-style: solid;"></div>
    
    <div class="bold">PAGAMENTOS:</div>
    ${dados.pagamentos.map(p => `
        <div class="flex">
            <span>
  > ${p.metodo.toUpperCase()}
  ${p.parcelas && p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}
</span>
            <span>${p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
    `).join('')}

    <div class="hr"></div>
    
    <div class="flex bold" style="font-size: 14px;">
        <span>TOTAL GERAL:</span>
        <span>R$ ${dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>

    ${dados.troco > 0 ? `
    <div class="flex">
        <span>TROCO:</span>
        <span>R$ ${dados.troco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>
    ` : ''}

    <div class="hr"></div>
    
    <div class="text-center footer">
    <p class="bold" style="font-size: 11px; margin-bottom: 8px; letter-spacing: 0.5px;">
           *** DEUS É FIEL ***
        </p>
        <p class="bold">*** OBRIGADO PELA PREFERENCIA ***</p>
        <p>www.atimang.com.br</p>
        
    </div>


    <div class="cut-area"></div>

    <script>
       window.onload = function() {
  window.print();
  setTimeout(() => window.close(), 500);
};
    </script>
</body>
</html>
`;

// LIMPEZA E ESCRITA FORÇADA
  printWindow.document.open(); // Abre o fluxo de escrita explicitamente
  printWindow.document.write(conteudo);
  
  // O segredo para não aparecer about:blank é fechar o fluxo de escrita 
  // MAS manter a janela aberta para o script interno rodar
  printWindow.document.close(); 
  
  // Opcional: focar na janela para garantir que ela apareça na frente
  printWindow.focus();
  
};










// import QRCode from 'qrcode';

// export const imprimirExtratoElgin = async (dados: ImpressaoDados) => {
//   const printWindow = window.open('', '_blank', 'width=350,height=600');
//   if (!printWindow) { alert("Bloqueador de pop-ups!"); return; }

//   // Gerar QR Code como imagem base64
//   const urlCupom = `https://meusistema.com/nota/${dados.numero}`;
//   const qrCodeBase64 = await QRCode.toDataURL(urlCupom);

//   const conteudo = `
//   <!DOCTYPE html>
//   <html>
//   <head>
//   <style>
//     /* ...seu CSS existente... */
//     .qr-code { text-align: center; margin-top: 5px; }
//   </style>
//   </head>
//   <body>
//     <!-- ...conteúdo do extrato... -->

//     <div class="qr-code">
//       <img src="${qrCodeBase64}" width="80" height="80" />
//       <div style="font-size: 8px;">Acesse seu cupom online</div>
//     </div>

//     <script>
//        window.onload = function() {
//          window.print();
//          setTimeout(() => window.close(), 500);
//        };
//     </script>
//   </body>
//   </html>
//   `;

//   printWindow.document.open();
//   printWindow.document.write(conteudo);
//   printWindow.document.close();
//   printWindow.focus();
// };