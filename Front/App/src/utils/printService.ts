// utils/printService.ts

interface ItemVenda {
  name: string;
  quantity: number;
  price: number;
}

interface ImpressaoDados {
  cliente: string;
  itens: ItemVenda[]; // Nova lista de itens
  total: number;
  pagamentos: { metodo: string; valor: number }[];
  troco: number;
}

export const imprimirExtratoElgin = (dados: ImpressaoDados) => {
const printWindow = window.open('', '_blank', 'width=350,height=600');

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
        .tabela-itens td { padding: 2px 0; vertical-align: top; }
        
        .col-qtd { width: 15%; }
        .col-desc { width: 50%; word-wrap: break-word; }
        .col-total { width: 35%; text-align: right; }

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
    <div class="hr"></div>

    <div class="text-center bold" style="letter-spacing: 2px;">EXTRATO DE VENDA</div>
    <div class="text-center">${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</div>
    
    <div class="hr"></div>
    <div class="flex">
        <span class="bold">CLIENTE:</span>
        <span>${dados.cliente.toUpperCase()}</span>
    </div>
    <div class="hr"></div>
    
    <table class="tabela-itens">
        <thead>
            <tr class="bold">
                <th class="col-qtd">QTD</th>
                <th class="col-desc">DESCRICAO</th>
                <th class="col-total">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${dados.itens.map(item => `
                <tr>
                    <td class="col-qtd">${item.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td class="col-desc">${item.name.toUpperCase()}</td>
                    <td class="col-total">${(item.quantity * item.price).toLocaleString('pt-BR', { minimumStyle: 'currency', currency: 'BRL' })}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="hr" style="border-bottom-style: solid;"></div>
    
    <div class="bold">PAGAMENTOS:</div>
    ${dados.pagamentos.map(p => `
        <div class="flex">
            <span>> ${p.metodo.toUpperCase()}</span>
            <span>${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
            setTimeout(() => {
                window.print();
                window.close();
            }, 300);
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