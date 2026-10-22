# Monitoramento de poços: lista de peças (referência para compra e montagem)

Lista de apoio para montar o monitoramento do poço (módulo Obras de poços › Monitoramento remoto). Nada aqui é
obrigatório: a placa e os sensores podem mudar em cada poço, e o ERP aceita qualquer combinação que mande o formato do
envio (ou o arquivo, no poço sem internet). Os modelos citados são exemplos fáceis de achar; confira as especificações
na compra. Custo relativo: $ barato · $$ médio · $$$ caro.

## 0. Antes de comprar: o que cada poço precisa medir

| Quero saber | Sensor | Seção |
|---|---|---|
| Quanta água tem no poço (nível estático/dinâmico, a seco) | transmissor de nível 4–20 mA (ou eletrodos, só "tem/não tem") | 1 |
| Quanta água tem na caixa | boias em alturas, ultrassônico na tampa ou sensor de pressão na base | 2 |
| Se a bomba está girando e gastando quanto | medidor de energia (PZEM / Modbus) ou TC de corrente | 5 |
| Falta de fase, térmico, boia pedindo, contator, seletora | detector de tensão AC optoacoplado (1 por ponto) | 5 |
| Cano estourado | transdutor de pressão na saída | 6 |
| Volume bombeado | hidrômetro com saída de pulsos | 6 |
| Ver tudo no local, sem celular | LEDs, sinaleiros e display na tampa | 3 |

---

## 1. Nível da água no poço

**Recomendado: transmissor de nível hidrostático submersível 4–20 mA** ($$–$$$)
- Inox (de preferência 316), IP68, **cabo ventilado** (com tubinho de respiro: sem ele a leitura varia com a pressão
  do ar).
- **Faixa** = coluna d'água máxima acima do sensor + margem. Ex.: sensor a 60 m, água podendo subir até 20 m da boca
  → até 40 m de coluna → escolha 0–50 mca. Faixa grande demais perde precisão; pequena demais satura.
- **Alimentação 12–24 V** (laço 4–20 mA): a placa de 3,3/5 V não alimenta o sensor sozinha. Precisa de fonte de 12 V
  ou 24 V no quadro (seção 7).
- Comprimento do cabo = profundidade do sensor + o caminho até o quadro (peça com sobra).
- Instalar **abaixo do nível dinâmico e acima da bomba**, preso ao edutor ou à corda, e anotar a profundidade no
  cadastro do aparelho (o ERP converte coluna d'água em nível).

**Para ler o 4–20 mA na placa** ($)
- Módulo **conversor 4–20 mA → 0–3,3 V / 0–5 V** (pronto, com ajuste de zero e escala), ou
- **ADS1115** (conversor analógico 16 bits, I2C) + **resistor shunt de 150 Ω, 0,1%** (4 mA = 0,6 V; 20 mA = 3,0 V).
- O ADC interno do ESP32 é impreciso para isso; o ESP-01 nem tem entrada analógica exposta.

**Alternativa barata: eletrodos + relé de nível** ($)
- 3 eletrodos inox no poço e um relé de nível no quadro: não mede, só diz "tem água acima do eletrodo".
- Serve como **proteção a seco** (corta a bomba) e a placa lê o contato do relé como uma entrada digital.

**Não serve dentro do poço:** sensor ultrassônico (diâmetro pequeno, eco nas paredes) e boia de nível.

## 2. Nível da caixa d'água

A **boia elétrica de comando** (tipo pera ou chave-boia) continua ligando e desligando o contator. Os sensores abaixo
são só para **medir e mostrar**, e não substituem a boia.

**Opção A, boias em alturas (discreto)** ($), a mais robusta e simples:
- 3 a 5 **sensores de nível tipo boia** (chave reed, montagem lateral ou vertical) em 20 / 40 / 60 / 80 / 100%.
- Cada um é uma entrada digital (contato seco: liga direto na placa, sem 220 V).
- Mostra degraus (ex.: "entre 60 e 80%"); ótimo para os LEDs da tampa.

**Opção B, ultrassônico à prova d'água na tampa (contínuo)** ($)
- **JSN-SR04T** ou **AJ-SR04M** (sonda à prova d'água, cabo de ~2,5 m).
- Mede a distância até a água: % = (altura útil − distância) ÷ altura útil.
- Zona morta de ~20–25 cm (a água cheia não pode chegar mais perto que isso da sonda); condensação e espuma atrapalham;
  serve para caixas até uns 4 m.

**Opção C, sensor de pressão na base (contínuo, mais preciso)** ($$)
- Transmissor de nível 4–20 mA de faixa pequena (0–5 mca), no fundo da caixa ou na saída.
- Não sofre com condensação; mesma leitura do poço (ADS1115 + shunt).

**Opção D, radar 24/60 GHz** ($$$): profissional, para caixas grandes ou tanques.

## 3. Painel no local: LEDs, sinaleiros e display na tampa

**Sinaleiros industriais 22 mm na porta do quadro** ($), ligados direto nos pontos do quadro, funcionam **mesmo sem
placa**:
| Cor | Liga em | Significa |
|---|---|---|
| Verde | saída do contator | bomba ligada |
| Vermelho | auxiliar do disjuntor-motor/térmico | falha / térmico desarmado |
| Amarelo | saída do relé de falta de fase (ou de nível) | alarme: fase ou poço baixo |
| Branco ou azul | depois do disjuntor de comando | energia no quadro |

**Barra de nível da caixa (ou do poço) na tampa** ($)
- **Opção simples:** 5 LEDs 5 mm de alto brilho (2 verdes, 2 amarelos, 1 vermelho) + resistores de 220–330 Ω, um por
  boia da opção A (cada boia acende o seu LED). Dá para fazer **sem placa nenhuma**.
- **Barra de 10 segmentos** (módulo "LED bar graph" verde/amarelo/vermelho) acionada pela placa (pelo PCF8574 ou por
  um 74HC595).
- **LEDs endereçáveis WS2812B** (fita ou anel "NeoPixel", 5 V): 1 pino controla vários LEDs com cor. Ex.: 10 LEDs =
  10%, verde acima de 50%, amarelo entre 20 e 50%, vermelho piscando abaixo de 20%. Precisa de um pino livre: melhor
  com ESP32 (no ESP-01 os pinos já vão para o I2C).
- Passe os LEDs por **prensa-cabos ou porta-LED com vedação** para não perder o IP65 da caixa.

**Display** ($)
- **OLED 0,96" I2C (SSD1306)** ou **LCD 16×2 / 20×4 I2C**: mostra nível do poço (m), caixa (%), corrente, pressão e
  o último alerta. Usa o mesmo I2C do PCF8574/ADS1115.
- **TM1637 (4 dígitos, 7 segmentos)**: só um número grande (ex.: % da caixa), visível de longe.

**Alarme no local** ($)
- **Buzzer ou sirene 12 V** + **botão "reconhecer alarme"** (entrada da placa; o ERP já tem o comando RECONHECER).

## 4. Quadro de comando (força e proteção)

Dimensionar pela **potência e corrente nominal da bomba** (placa do motor) e pela alimentação (mono/bi/trifásica).

- **DPS** (protetor contra surtos) classe II, um por fase + neutro. Raio é o que mais queima bomba e placa.
- **Disjuntor geral** (curva C, ou D para partida pesada).
- **Disjuntor-motor** (com ajuste da corrente na faixa da bomba) **com contato auxiliar** (NA/NF): o auxiliar avisa
  "desarmou". Alternativa: disjuntor + relé térmico com contato auxiliar.
- **Contator** categoria AC-3 para a potência da bomba (bobina 220 V), com **contato auxiliar** se quiser confirmar
  que fechou.
- **Relé de falta e sequência de fase** (trifásico): corta o comando quando falta fase ou inverte.
- **Relé de nível com eletrodos** (proteção a seco no poço).
- **Seletora 3 posições MAN-0-AUTO**, botoeiras liga/desliga (manual).
- **Disjuntor de comando 2 A**, trilho DIN, bornes, canaleta, caixa metálica ou plástica IP65 com espaço sobrando.
- **Snubber RC** na bobina do contator (ex.: 0,1 µF + 100 Ω, 400 V, ou o snubber pronto do fabricante do contator):
  o ruído da bobina reinicia placas, principalmente o ESP-01.

## 5. Medição elétrica e estados do quadro

- **Monofásico:** **PZEM-004T v3** com TC (até 100 A): tensão, corrente, potência e **energia acumulada (kWh)** pela
  serial. ($)
- **Trifásico:** **medidor de energia com Modbus RS485** (ex.: Eastron SDM630 ou similar) + **módulo MAX485** na placa.
  ($$) Opção mais barata: 3 × **SCT-013** (TC não invasivo; 030 = 30 A, 100 = 100 A) + ADS1115, que mede só a corrente.
- **Detector de tensão AC optoacoplado (PC817)**, módulo de 1 ou 4 canais, um canal por ponto de 220 V: fase R, S,
  T, auxiliar do térmico, saída da boia, bobina do contator, seletora em AUTO. ($)
  Isola os 220 V da placa: **nunca ligue 220 V direto num pino**.

## 6. Pressão e vazão

- **Transdutor de pressão 0–10 bar** (rosca 1/4" NPT ou G1/4, saída 0,5–4,5 V, alimentação 5 V; 0–16 bar se a rede for
  de alta pressão), na saída do poço. Com ADS1115 em 3,3 V, use um **divisor de tensão** (ex.: 10 kΩ / 20 kΩ). ($)
  É o que acusa **cano ou edutor estourado** (bomba girando e pressão caindo).
- **Hidrômetro com saída de pulsos** (reed switch, ex.: 1 pulso a cada 10 L) na saída do poço: volume confiável. ($$)
  Sensores de turbina baratos (YF-DN25, YF-DN32) funcionam, mas entopem com areia.

## 7. Placa, módulos e alimentação

| Peça | Para quê | Custo |
|---|---|---|
| **ESP-01 (ESP8266)** + **adaptador/programador USB** (CH340, com chave PROG/UART) | Wi-Fi barato; 2 pinos (I2C) + serial | $ |
| **ESP32 DevKit** | pinos e ADC de sobra, 3 seriais; LEDs WS2812B e display ficam fáceis | $ |
| **LilyGO T-A7670 / T-SIM7600** (ESP32 + 4G) + chip de dados M2M | poço sem Wi-Fi (evite SIM800L: 2G sendo desligado) | $$ |
| **Heltec WiFi LoRa 32 V3** + gateway LoRa | vários poços perto, sem chip | $$ |
| **PCF8574** (I2C, 8 pinos) | entradas do quadro + saída do relé (essencial no ESP-01) | $ |
| **ADS1115** (I2C, 4 analógicas, 16 bits) | nível 4–20 mA, pressão | $ |
| **MAX485** | medidor trifásico Modbus | $ |
| **Módulo relé 1 canal** (bobina 5 V, optoacoplado), contato **NF** em série com a bobina do contator | bloqueio remoto | $ |
| **RTC DS3231** | hora certa sem internet (o arquivo precisa de hora) | $ |
| **Módulo microSD** | guardar meses de leituras no poço sem internet | $ |
| **Fonte HLK-PM01** (220 V → 5 V) ou fonte 5 V em trilho DIN | placa e módulos | $ |
| **Fonte 12 V ou 24 V em trilho DIN** | laço 4–20 mA dos sensores de nível, sirene | $ |
| **Regulador AMS1117 3,3 V** + capacitor 470 µF | ESP-01 (não liga em 5 V) | $ |
| **Sem energia no local:** painel solar 10–20 W + controlador de carga + bateria 12 V 7 Ah | poço isolado | $$ |

## 8. Instalação

- Caixa **IP65** para a eletrônica (ou dentro do quadro, separada da força), **prensa-cabos** em todas as entradas.
- **Cabo blindado** (par trançado) para os sinais (4–20 mA, RS485, pulsos), longe dos cabos de força; malha
  aterrada só de um lado.
- Cabo PP para o sensor no poço, fita de autofusão nas emendas, abraçadeiras inox no edutor.
- Bornes, terminais tipo ilhós, etiquetas (anilhas) para identificar os fios.

## 9. Ferramentas

Multímetro, **alicate amperímetro** (para conferir a corrente normal da bomba e calibrar os limites), ferro de solda,
protoboard e jumpers para a bancada, chave de fenda isolada.

## 10. Kit de bancada para começar (sem poço)

Para aprender e testar com o ERP antes de ir a campo (o painel do módulo recebe tudo igual):
- 1 ESP32 DevKit + 1 ESP-01 com programador USB
- ADS1115, PCF8574, conversor 4–20 mA (ou só um **potenciômetro de 10 kΩ** para simular o sensor de nível)
- 4 **botões** (simulam boia, térmico, bobina, seletora) e 1 **chave** (simula falta de fase)
- 10 LEDs (verde/amarelo/vermelho) + resistores de 220 Ω, ou um anel WS2812B de 8–12 LEDs
- OLED 0,96" I2C, buzzer 5 V, módulo relé 1 canal
- RTC DS3231 + módulo microSD (para o teste "sem internet")
- Protoboard, jumpers, fonte 5 V

Roteiro: cadastre o aparelho no ERP → grave a chave no firmware → mexa no potenciômetro e nos botões → veja o painel, os
alertas (falta de fase, não parte, sem funcionamento...) e o relatório do mês. Sem internet: grave em CSV no microSD e
use "Importar arquivo".

## Ainda não está no ERP

- **Nível da caixa** como medida própria (hoje o envio tem o nível do poço). Quando definir o sensor da caixa,
  entra um campo novo no envio e no painel (pede um script pequeno).
- **Ligar/desligar a bomba à distância**: de propósito, o comando só **bloqueia e libera** (o relé fica em série com
  as proteções).
