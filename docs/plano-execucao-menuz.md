# Plano de Execucao - Menuz AR (Restaurantes)

Data: 02/03/2026  
Responsavel: Joao Rubens / Menuz

## 1) Objetivo
- Vender cardapio com AR para restaurantes, sem app obrigatorio para cliente final.
- Garantir qualidade visual (3D realista), estabilidade 24h e operacao repetivel.

## 2) Status tecnico atual
- Backend cloud-native em Cloudflare Worker + D1 + R2.
- Site publico e painel admin operando no mesmo dominio.
- Fila 3D com Meshy integrada (criar job, enviar fotos, iniciar IA, sincronizar).
- Gate de publicacao ativo: exige GLB + USDZ + score QA minimo.

## 3) Seguranca aplicada
- Limitador de tentativas de login por IP.
- Rate limit para pedidos publicos.
- Rate limit para acao de IA (start/sync).
- Headers de seguranca (CSP, HSTS, frame deny, no sniff, etc.).
- Sanitizacao de campos (itens, restaurantes, pedidos e URLs).
- Limpeza de senha em texto claro apos login bem-sucedido.

## 4) Fluxo operacional recomendado (padrao)
1. Cliente fotografa prato (8-16 fotos no painel ou via scanner).
2. Job entra na Fila 3D com provider Meshy.
3. Operador clica `Rodar IA` e depois `Sincronizar`.
4. Operador revisa GLB/USDZ.
5. Operador clica `Avaliar QA`.
6. Se score >= 70 e GLB+USDZ validos -> `Publicar`.
7. Prato fica ativo no cardapio e em AR.

## 5) Padrao de captura de fotos (comida)
- Fundo simples e sem reflexo forte.
- Luz difusa (evitar flash estourado).
- Fazer volta de 180-270 graus no prato.
- Distancias: perto, medio e geral.
- Nao cortar bordas do prato em todas as fotos.
- Evitar objetos extras (talheres, copo, mao) na frente.

## 6) SLA interno por prato
- Recebimento e triagem: ate 15 minutos.
- Geracao IA + sync: 10-25 minutos.
- Revisao e QA: 10 minutos.
- Publicacao final: ate 1 hora (modelo padrao).

## 7) Precos sugeridos (SaaS)
- Plano Start: EUR 99/mes, ate 25 itens, ate 20 jobs 3D/mes.
- Plano Growth: EUR 199/mes, ate 80 itens, ate 60 jobs 3D/mes.
- Plano Premium: EUR 399/mes, multi-unidade, fila prioritaria, suporte dedicado.
- Setup inicial opcional: EUR 300-EUR 900 por restaurante (onboarding + treinamento).

## 8) Como fechar os primeiros 10 restaurantes
1. Prospeccao local (BH + regiao): lista de 50 alvos com ticket medio alto.
2. Oferta de piloto 14 dias para 1-3 pratos.
3. Demonstracao presencial: QR na mesa + comparativo com/sem AR.
4. Fechamento com contrato mensal + setup.
5. Coletar depoimento e video curto do dono para prova social.

## 9) KPIs obrigatorios (monitoramento semanal)
- Taxa de abertura do QR por mesa.
- Taxa de clique em `Realidade Aumentada`.
- Conversao para pedido apos AR.
- Tempo medio entre job criado e prato publicado.
- Taxa de reprova QA.
- Churn de restaurante.

## 10) Roadmap (60 dias)
- Semana 1-2: padronizar onboarding e playbook comercial.
- Semana 3-4: melhorar dashboard de KPI por restaurante.
- Semana 5-6: automacao de notificacao (job pronto/reprovado).
- Semana 7-8: fechar 10 contratos ativos e publicar estudo de caso.

## 11) Riscos e mitigacao
- Risco: 3D inconsistente em comida complexa.  
  Mitigacao: fluxo hibrido (captura melhor + QA + ajuste manual quando necessario).
- Risco: cliente sem disciplina de captura.  
  Mitigacao: checklist simples no app e treinamento de 20 minutos.
- Risco: custo de IA subir.  
  Mitigacao: limites por plano e fila priorizada por receita.

## 12) Proximo passo imediato (esta semana)
1. Validar 3 pratos reais no fluxo completo (captura -> QA -> publicacao).
2. Montar proposta comercial PDF para piloto.
3. Agendar 5 demos presenciais com restaurantes alvo.
