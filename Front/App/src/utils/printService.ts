// utils/printService.ts

interface ItemVenda {
  codigo?: string;
  name: string;
  quantity: number;
  price: number;
  desconto?: number;
  unidade?: string;
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

 

  const conteudo = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 600; }
        @page { size: 100% auto; margin: 0; }
        html, body {
            width: 80mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            margin: 0; 
            
            color: #100e0e;
            line-height: 1.2;
        }
        
       

        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .hr { border-bottom: 1px dashed #000; margin: 5px 0; }
        .flex { display: flex; justify-content: space-between; }
        
        .tabela-itens { width: 100%; border-collapse: collapse; margin-top: 5px; }
        .tabela-itens th { text-align: left; border-bottom: 1px solid #000; font-size: 10px; }
        .tabela-itens th,
        .tabela-itens td {
            padding: 2px 3px;
            vertical-align: top;
        }
        
        .tabela-itens th.col-total { text-align: right; }
        .col-qtd { text-align: center; }
        .col-desc {
            width: 50%;
            word-break: keep-all;
            white-space: normal;
        }
        .col-total {
            text-align: right;
            white-space: nowrap;
        }

        .footer { margin-top: 15px; font-size: 9px; }
        .cut-area { height: 15mm; }

        @media print {
            header, footer { display: none !important; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    
    <div class="text-center bold" style="font-size: 16px;">ATIMANG</div>
    <div class="text-center">MANUTENCAO E PECAS HIDRAULICAS</div>

    <div class="text-center">${CNPJ} - ${CEL}</div> 
    <div class="text-center" style="font-size: 9px;">${END}</div>

    <div class="hr"></div>

    <!-- AVISO DE DOCUMENTO NÃO FISCAL -->
    <div class="text-center bold" style="font-size: 10px; border: 1px solid #000; padding: 4px; margin-bottom: 5px;">
        COMPROVANTE DE VENDA INTERNO<br>
        <span style="font-size: 9px; font-weight: normal;">NÃO É DOCUMENTO FISCAL</span>
    </div>

    <div class="text-center bold" style="letter-spacing: 2px;">PEDIDO Nº ${dados.numero}</div>
    <div class="text-center">${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</div>
    
    <div class="hr"></div>
    <div class="flex">
        <span class="bold">CLIENTE:</span>
        <span>${dados.cliente.toUpperCase()}</span>
    </div>

    ${dados.cpf ? `
    <div class="flex">
        <span class="bold">CPF/CNPJ:</span>
        <span>${dados.cpf}</span>
    </div>
    ` : ''}

    <div class="hr"></div>
    
    <table class="tabela-itens">
        <thead style="font-size: 8px;">
            <tr class="bold">
                <th class="col-qtd">COD</th>
                <th class="col-desc">DESCRICAO</th>
                <th class="col-qtd">UoM</th>
                <th class="col-total">VALOR</th>
                <th class="col-qtd">QTD</th>
                <th class="col-total">TOTAL</th>
            </tr>
        </thead>
        <tbody style="font-size: 8px;">
        ${dados.itens.map(item => {
          const desconto = item.desconto || 0;
          const totalItem = (item.quantity * item.price) - desconto;

          return `
            <tr>
                <td class="col-qtd">${item.codigo || '-'}</td>
                <td class="col-desc">${item.name.toUpperCase()}</td>
                <td class="col-qtd">${item.unidade || 'UN'}</td>
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
                  ${totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
        <span>R$ ${dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>

    ${dados.troco > 0 ? `
    <div class="flex">
        <span>TROCO:</span>
        <span>R$ ${dados.troco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
    ` : ''}

    <div class="hr"></div>
    
    <div class="text-center footer">
       
        <p class="bold" style="font-size: 11px; margin-bottom: 5px; letter-spacing: 0.5px;">
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

  printWindow.document.open();
  printWindow.document.write(conteudo);
  printWindow.document.close();
  printWindow.focus();
};