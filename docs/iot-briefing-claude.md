  # Contexto para o Claude do navegador: montagem do painel e firmware do monitoramento de poços

  > Cole este texto no começo da conversa. Atualize a seção "Formato do envio" se o ERP mudar.

  ## Quem sou e o que estou fazendo
  Tenho uma loja de hidráulica/transmissão e uma empresa de **poços artesianos** (perfuração, instalação de bomba,
  manutenção). Desenvolvo meu próprio ERP (Node/Express + MySQL + React). Dentro dele há um módulo de **monitoramento
  remoto de poços (IoT)**, já pronto do lado do servidor. Agora quero **montar o hardware**: o quadro de comando da bomba
  com uma placa que lê os sensores e manda os dados para o ERP. **Ainda não tenho nenhuma placa**: estou escolhendo as
  peças e quero começar por um kit de bancada. Gosto do **ESP-01 (ESP8266)**, mas posso usar ESP32 (inclusive com 4G)
  conforme o local. Alguns poços **não têm internet**. Converse comigo em português, de forma prática; me ajude a escolher
  peças, desenhar ligações (com cuidado elétrico) e escrever o firmware (Arduino IDE ou PlatformIO).

  ## O que quero medir e mostrar
  - **Poço:** nível da água (transmissor de nível hidrostático 4–20 mA, cabo ventilado; alimentação 12–24 V) e, como
    proteção a seco, relé de nível com eletrodos.
  - **Caixa d'água:** nível (boias em alturas 20/40/60/80/100%, ultrassônico JSN-SR04T na tampa ou sensor de pressão na
    base). Obs.: o ERP **ainda não tem** campo para o nível da caixa; se formos usar, me avise que eu acrescento no ERP.
  - **Bomba e quadro:** tensão de cada fase (R, S, T), corrente (PZEM-004T v3 no monofásico; medidor Modbus RS485 ou
    3× SCT-013 no trifásico), energia acumulada (kWh), contator ligado (bobina), térmico/disjuntor-motor desarmado
    (contato auxiliar), boia/pressostato pedindo água, seletora MAN-0-AUTO, contador de partidas, horímetro.
  - **Saída do poço:** pressão (transdutor 0–10 bar, 0,5–4,5 V) e vazão (hidrômetro com saída de pulsos).
  - **No local:** sinaleiros 22 mm na porta (verde bomba ligada, vermelho térmico, amarelo fase/alarme, branco energia),
    barra de LEDs de nível da caixa (LEDs simples, barra de 10 segmentos ou WS2812B), display (OLED 0,96" I2C, LCD I2C ou
    TM1637), buzzer e botão "reconhecer alarme".

  ## Regras de segurança do quadro (não negociáveis)
  - Toda entrada de **220 V** chega à placa por **módulo detector de tensão AC optoacoplado (PC817)**; nunca direto.
  - Proteções em série com a bobina do contator: seletora → relé de falta/sequência de fase → relé de nível (a seco) →
    boia/pressostato → **relé da placa com contato NF** → bobina. A placa **nunca liga a bomba por cima das proteções**:
    o relé dela só **bloqueia** (energiza e abre o NF) ou **libera**. Se a placa morrer, o poço segue no automático.
  - DPS no quadro; **snubber RC na bobina do contator** (o ESP-01 reinicia com o ruído); eletrônica separada da força.

  ## Ideia de montagem com ESP-01
  - ESP-01 tem só **GPIO0 e GPIO2** livres + RX/TX e **não expõe entrada analógica**. Plano: GPIO0 = SDA, GPIO2 = SCL
    (pull-up 10 kΩ; os dois precisam estar em ALTO no boot) com **PCF8574** (8 pinos: 7 entradas do quadro + 1 saída do
    relé de bloqueio) e **ADS1115** (analógicas: nível 4–20 mA com shunt 150 Ω, pressão com divisor 10k/20k).
    RX/TX = PZEM (perde a serial de debug) ou MAX485 (Modbus trifásico). Alimentação 3,3 V por AMS1117 + 470 µF.
  - ESP32 dispensa o PCF8574, tem ADC e 3 seriais; versões 4G (LilyGO T-A7670/T-SIM7600) para poço sem Wi-Fi.
  - Sem internet: guardar em LittleFS ou microSD, hora por **RTC DS3231**, e baixar o arquivo (ex.: a placa cria uma rede
    Wi-Fi própria e o celular baixa) para importar no ERP.

  ## Formato do envio para o ERP (contrato do servidor — não mude sem me avisar)
  **Rota:** `POST https://<meu-servidor>/api/modulos/hidraulica/pocos/iot/leituras`
  **Cabeçalhos:** `Content-Type: application/json`, `X-Dispositivo: <identificador cadastrado, ex. ESP01-0001>`,
  `X-Chave: <chave de 32 caracteres que o ERP mostra para o aparelho>` (a chave é HMAC da chave mestra do servidor; não
  precisa ser calculada na placa, é só gravada no firmware).

  **Corpo** (todos os campos de leitura são opcionais; mande só o que o quadro tem; até 500 leituras por envio):
  ```json
  { "leituras": [ {
      "em": "2026-10-22T14:05:00-03:00",
      "nivel_m": 38.4,            "coluna_m": 21.6,
      "vazao_lh": 3200,           "pressao_bar": 3.1,
      "corrente_a": 6.8,          "tensao_v": 221,
      "fase_a_v": 221, "fase_b_v": 220, "fase_c_v": 219,
      "bomba": true,  "comando": true,  "termico_ok": true,  "boia": true,  "modo": "AUTO",
      "horimetro_h": 1532.4,      "energia_kwh": 8421.35,   "partidas": 1203,
      "temp_c": 31.5,             "sinal_dbm": -71,          "bateria_v": 12.6 } ],
    "confirmacoes": [ { "id": 12, "ok": true, "resposta": "relé acionado" } ] }
  ```
  - `em`: hora da medição, ISO com fuso (`-03:00`) ou `"AAAA-MM-DD HH:MM:SS"` (hora local). Sem `em`, vale a hora em que
    chegou. Recusado se estiver mais de 10 min no futuro (use NTP/RTC) ou com mais de 60 dias.
  - `nivel_m`: profundidade da água a partir da boca do poço (maior = mais fundo). Ou mande `coluna_m` (coluna d'água
    sobre o sensor) e o ERP calcula nível = profundidade do sensor (cadastrada) − coluna.
  - `bomba` (motor girando), `comando` (bobina do contator energizada), `termico_ok` (false = desarmado), `boia` (pedindo
    água): aceitam `true/false` ou `1/0`. `modo`: `AUTO`, `MANUAL` ou `DESLIGADO` (seletora).
  - `fase_a_v/b/c`: tensão de cada fase; abaixo de 50 V conta como sem tensão. Monofásico: só `fase_a_v` (ou `tensao_v`).
  - `energia_kwh` e `partidas` são **contadores acumulados** (o ERP faz a diferença por dia).
  - A mesma hora do mesmo aparelho **não duplica**: pode reenviar a fila inteira depois de ficar sem rede.

  **Respostas:**
  - `201` → `{ "ok": true, "recebidas": n, "gravadas": n, "alertasAbertos": n, "alertasFechados": n,
    "comandos": [ { "id": 13, "comando": "BLOQUEAR" } ], "servidor": "<hora ISO>" }`
  - `401` chave errada (não adianta reenviar) · `404` aparelho não cadastrado · `409` aparelho inativo ·
    `400` dado inválido (ex.: hora no futuro). Só guarde e tente de novo em **erro 5xx ou sem rede**.

  **Comandos remotos** (só se o aparelho estiver marcado "aceita comandos" no ERP): chegam em `comandos` na resposta do
  envio. `BLOQUEAR` = energizar o relé de bloqueio (abre o NF, a bomba não parte); `LIBERAR` = desenergizar;
  `RECONHECER` = silenciar o alarme local. A placa confirma no **envio seguinte** em `confirmacoes` (`ok: false` se
  falhou). Comando vale 10 min se a placa não buscar.

  **Poço sem internet:** o ERP importa um arquivo com até 1 ano de leituras: o mesmo JSON acima, **uma leitura JSON por
  linha (JSONL)**, ou **CSV** com cabeçalho nos mesmos nomes (`em;nivel_m;corrente_a;bomba;...`, separador `;` ou `,`,
  vírgula decimal aceita). Reimportar não duplica.

  ## O que o ERP faz com os dados (para a placa não precisar fazer)
  Alertas automáticos: nível baixo, bomba a seco (girando com corrente baixa), sobrecorrente, vazão baixa, tensão fora
  da faixa, **falta de fase**, **sem energia**, **não parte** (boia pede, energia ok, AUTO e contator desligado em 2
  leituras seguidas), **sem funcionamento** (contator ligado e corrente ≈ 0: bomba queimada/cabo), **térmico desarmado**,
  **pressão baixa** com a bomba trabalhando (cano/edutor estourado), **ligada demais** (boia travada/vazamento),
  **partidas demais** e **sem sinal**. Também faz o resumo do dia, o relatório do mês (horas, partidas, volume, kWh,
  custo, m³/kWh) e os gráficos. A placa só precisa **medir com hora certa e enviar** (e cuidar dos LEDs/display locais).

  ## Como quero trabalhar
  1. Começar por um **kit de bancada** (ESP32 e ESP-01, ADS1115, PCF8574, potenciômetro simulando o sensor de nível,
    botões simulando boia/térmico/contator, chave simulando falta de fase, LEDs, OLED, relé, RTC, microSD).
  2. Firmware em etapas: (a) ler entradas e mostrar no Serial/OLED; (b) montar o JSON e enviar; (c) fila offline com
    reenvio; (d) comandos; (e) LEDs/display de nível; (f) modo sem internet (arquivo + Wi-Fi próprio para baixar).
  3. Depois, o esquema elétrico do quadro real (mono e trifásico) e a lista de compra fechada.
  Quando houver dúvida sobre o formato, siga o contrato acima; se precisar de um campo novo (ex.: nível da caixa),
  me diga que eu acrescento no ERP antes.
