flowchart TD

%% ========================
%% INÍCIO
%% ========================
A[Iniciar venda] --> B[Carrinho vazio]

%% ========================
%% ADIÇÃO DE ITENS
%% ========================
B --> C{Tipo de item}

C -->|Produto| D[Adicionar ao carrinho]
C -->|OS| E[Selecionar OS]

%% ========================
%% VALIDAÇÃO DA OS
%% ========================
E --> E1[Carregar: total, paid, remaining]

E1 --> E2{remaining > 0?}

E2 -->|Não| E3[Bloquear inclusão da OS]
E2 -->|Sim| E4[Definir valor = remaining]

E4 --> D

%% ========================
%% CARRINHO ATUALIZADO
%% ========================
D --> F[Carrinho atualizado]

%% ========================
%% AÇÕES NO CARRINHO
%% ========================
F --> G{Ação do usuário}

G -->|Adicionar item| C
G -->|Alterar quantidade| H[Atualizar quantidade]
G -->|Remover item| I[Remover item]
G -->|Aplicar desconto manual| J[Solicitar desconto]

H --> F
I --> F

%% ========================
%% DESCONTO MANUAL
%% ========================
J --> J1{Item é OS?}

J1 -->|Sim| J2[Bloquear desconto]
J1 -->|Não| J3[Aplicar desconto ao item]

J2 --> F
J3 --> F

%% ========================
%% VALIDAÇÃO FINAL
%% ========================
F --> K[Validar carrinho]

K --> K1{Contém OS?}

K1 -->|Sim| K2[Travar valor da OS = remaining]
K2 --> K3[Bloquear edição da OS]

K1 -->|Não| L
K3 --> L

%% ========================
%% SAÍDA
%% ========================
L[Carrinho pronto para pagamento]