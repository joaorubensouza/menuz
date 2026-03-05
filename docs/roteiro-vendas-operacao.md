# Roteiro Comercial + Operacao (Menuz AR)

## Objetivo
- Vender a proposta de valor de forma simples.
- Colocar um restaurante em producao com fluxo de 20 fotos -> Meshy -> publicacao no cardapio.
- Garantir isolamento por restaurante (sem acesso cruzado de clientes).

## Pre-check tecnico (antes da reuniao)
1. Confirmar deploy online (`menuz.omniaprod.pt`).
2. Validar login master e login cliente.
3. Confirmar `MESHY_API_KEY` ativo.
4. Confirmar configuracoes de captura:
   - `CAPTURE_RECOMMENDED_FOOD=20`
   - `CAPTURE_RECOMMENDED_GENERAL=12`
5. Fazer um teste rapido:
   - criar job em auto mode
   - subir fotos
   - rodar automacao
   - confirmar item com `modelGlb` + `modelUsdz`.

## Passo a passo operacional (20 fotos)
1. Entrar em `/admin` com conta do restaurante.
2. Abrir `Fila 3D` e criar job com:
   - provedor: `Meshy`
   - `auto mode`: ligado
   - item correto selecionado.
3. Capturar 20 fotos:
   - 360 graus do prato (altura baixa + media + topo)
   - boa luz
   - fundo limpo
   - manter prato centralizado.
4. Enviar as 20 fotos no job.
5. O painel dispara automacao automaticamente para jobs em auto mode.
6. Acompanhar status:
   - `enviado/triagem` -> `processando` -> `revisao/publicado`.
7. Quando QA bater o minimo e houver GLB + USDZ:
   - publicacao entra no item automaticamente.
8. Validar em `/r/<slug>` e abrir `Ver em AR` no celular.

## Roteiro de fala (voce = vendedor, cliente = dono do restaurante)

### Bloco 1: Abertura
Vendedor:
"Hoje eu vou te mostrar como aumentar conversao do cardapio com AR, sem app, so com QR na mesa."

Cliente:
"Meu time nao e tecnico. Isso e dificil de operar?"

Vendedor:
"Nao. A operacao e em 3 passos: cadastrar prato, subir fotos, publicar. O resto da fila 3D pode rodar automatico."

### Bloco 2: Dor e valor
Vendedor:
"Seu cliente hoje escolhe no escuro. Com AR em tamanho real, ele decide mais rapido e com mais seguranca."

Cliente:
"Isso melhora ticket ou e so efeito visual?"

Vendedor:
"Melhora decisao e reduz indecisao. Voce acompanha funil no painel: menu -> AR -> pedido, por restaurante."

### Bloco 3: Seguranca e multiunidade
Cliente:
"Tenho mais de uma unidade. Uma unidade pode ver dados da outra?"

Vendedor:
"Nao. Cada usuario cliente so acessa o proprio restaurante. O backend bloqueia acesso cruzado por restaurante em todos os endpoints privados."

Cliente:
"E se tiver muito acesso ao mesmo tempo?"

Vendedor:
"A plataforma ja tem rate limit, sessao autenticada e isolamento por tenant. O deploy esta em Cloudflare para escalar trafego global."

### Bloco 4: Onboarding 20 fotos
Vendedor:
"Vamos pegar um prato real agora. Voce tira 20 fotos, eu subo no job automatico, e a IA do Meshy gera os modelos."

Cliente:
"Precisa de estudio?"

Vendedor:
"Nao. Boa luz, fundo limpo e 360 graus resolvem. O sistema escolhe um conjunto distribuido das imagens para enviar ao Meshy."

Cliente:
"E quando isso vira menu?"

Vendedor:
"Assim que QA aprovar e tiver GLB + USDZ, publica no item e ja aparece no cardapio com AR."

### Bloco 5: Fechamento comercial
Vendedor:
"Com isso, voce ganha velocidade para lancar pratos e um funil medivel de conversao por unidade."

Cliente:
"Qual o proximo passo?"

Vendedor:
"Hoje configuramos sua primeira unidade. Em seguida replicamos para as outras com o mesmo processo."

## Checklist de entrega para o cliente
- Link publico do cardapio por restaurante.
- Usuario e senha da unidade.
- 1 prato publicado em AR validado no celular.
- Dashboard de analytics funcionando.
- Procedimento de captura de 20 fotos documentado.
