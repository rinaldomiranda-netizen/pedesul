/* Planos do Pede Sul (RMD Delivery) e a promoção de lançamento. Usado pela área do desenvolvedor (rmd.js) e pela página de vendas (vendas.js).
   22/11/2026 (pedido do Rinaldo): vários planos para cada cliente escolher, tendo o iFood como referência (sem copiar as taxas)
   e sempre mais vantajoso: nenhum plano cobra comissão em porcentagem. Preços = sugestão da RMD; o Rinaldo decide. Mudou aqui, muda nas telas.
   Os códigos (id) antigos continuam (essencial, profissional, completo) para não quebrar lojas e inscrições que já existem:
     essencial = Sistema · profissional = Entrega Própria · completo = Entrega Total · por_pedido = Pague por Pedido (novo) · salao = Salão. */
(function (raiz) {
  'use strict';
  // "recursos" = o que o botão "Ligar recursos deste plano" (área do desenvolvedor) deixa ligado na loja.
  // parceiros = chamar o entregador parceiro da RMD (motoboy de fora da loja); a loja paga VALOR_CHAMADA por chamado aceito.
  var SO_SISTEMA = { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: false, entregadores: false, oferta: false, caixa: false, mesas: false, clientes: false, relatorios: false, parceiros: false };
  var PLANOS = [
    { id: 'por_pedido', nome: 'Pague por Pedido', preco: 0, porPedido: 0.99, teto: 139.90, para: 'Quem está começando e vende pouco: sem mensalidade',
      itens: ['Sem mensalidade: R$ 0,99 por pedido recebido', 'Nunca paga mais que R$ 139,90 no mês', 'Tudo do plano Sistema', 'Pedido cancelado não conta'],
      recursos: SO_SISTEMA },
    { id: 'essencial', nome: 'Sistema', preco: 69.90, anual: 699.00, para: 'O básico: a loja tem o seu sistema de pedidos',
      itens: ['Cardápio online com QR Code e link', 'Pedidos de entrega, retirada e mesa', 'Painel de pedidos com contagem do prazo', 'Pix direto na conta da loja, sem taxa da RMD',
        'Taxa de entrega por bairro', 'Logo e cores da loja', 'Post do dia e cardápio do dia (tem / não tem)', 'A loja entrega do jeito dela'],
      recursos: SO_SISTEMA },
    { id: 'profissional', nome: 'Entrega Própria', preco: 139.90, anual: 1399.00, para: 'A loja cadastra os entregadores dela', destaque: true,
      itens: ['Tudo do Sistema', 'Cadastro dos entregadores da loja', 'Tela do entregador no celular, com Google Maps e Waze', 'Entrega oferecida ao entregador online (aceita ou passa ao próximo)',
        'Tela da cozinha e comanda impressa', 'Caixa: abrir, vender no balcão, sangria e fechamento', 'Suporte por WhatsApp em horário comercial'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: true, entregadores: true, oferta: true, caixa: true, mesas: false, clientes: false, relatorios: false, parceiros: false } },
    { id: 'completo', nome: 'Entrega Total', preco: 219.90, anual: 2199.00, para: 'Entregadores da loja + entregador parceiro da RMD quando faltar',
      itens: ['Tudo do Entrega Própria', 'Chamar entregador parceiro da RMD (de fora da loja): R$ 1,50 por chamado aceito, e o motoboy fica com a taxa de entrega',
        'Mesas e garçom, com conta da mesa', 'Cadastro de clientes pelo telefone', 'Relatórios de vendas e produtos mais pedidos', 'Cadastro inicial do cardápio feito pela RMD', 'Suporte prioritário'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: true, entregadores: true, oferta: true, caixa: true, mesas: true, clientes: true, relatorios: true, parceiros: true } },
    // Salão: só a organização DENTRO da loja (caixa, balcão, cozinha, mesas; o cliente pede pelo QR da mesa). Fica fora da vitrine.
    { id: 'salao', nome: 'Salão', preco: 59.90, anual: 599.00, para: 'Só a organização interna: balcão, cozinha e mesas', interno: true,
      itens: ['Caixa: abrir, vender no balcão, sangria e fechamento', 'Mesas e garçom, com conta da mesa', 'Cliente vê o cardápio e pede pelo QR Code da mesa', 'Tela da cozinha e comanda impressa', 'Cadastro de clientes e relatórios', 'Não recebe pedido de fora da loja (sem entrega e sem retirada)'],
      recursos: { entrega: false, retirada: false, local: true, qrcode: true, post: true, cozinha: true, entregadores: false, oferta: false, caixa: true, mesas: true, clientes: true, relatorios: true, parceiros: false } },
    // Cortesia (Rinaldo, 22/11/2026): loja que a RMD dá de graça (ex.: Êta Brownie). Tudo ligado, nada a cobrar. Não aparece na página de vendas.
    { id: 'cortesia', nome: 'Cortesia RMD (grátis)', preco: 0, gratis: true, oculto: true, para: 'Loja que a RMD dá de presente: sem mensalidade e sem cobrança',
      itens: ['Tudo do Entrega Total', 'Sem mensalidade', 'Chamados de entregador parceiro sem cobrança'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: true, entregadores: true, oferta: true, caixa: true, mesas: true, clientes: true, relatorios: true, parceiros: true } }
  ];
  // Promoção de lançamento (decisão do Rinaldo, 27/10/2026): os 5 primeiros restaurantes inscritos levam o plano
  // mais completo (Entrega Total) pelo preço do Sistema e, nos 3 primeiros meses, pagam metade disso. Quem conta as vagas é o servidor
  // (aterrisse-delivery/supabase/007_vagas_lancamento.sql); se mudar o número de vagas, mudar lá também.
  var PROMOCAO = { vagas: 5, plano: 'completo', pagaComo: 'essencial', mesesMetade: 3 };
  var BASE = PLANOS.filter(function (p) { return p.id === PROMOCAO.pagaComo; })[0];
  PROMOCAO.preco = BASE.preco;
  PROMOCAO.precoInicio = Math.round(BASE.preco * 50) / 100;

  // Quanto a loja paga no mês (para a área RMD). pedidos = pedidos do mês (sem cancelados); chamadas = chamados de parceiro aceitos.
  function valorDoMes(planoId, pedidos, chamadas) {
    var pl = PLANOS.filter(function (p) { return p.id === planoId; })[0];
    if (pl && pl.gratis) return { plano: 0, chamadas: 0, total: 0, gratis: true };
    var fixo = pl ? (pl.porPedido ? Math.min(pl.teto, Math.round(pl.porPedido * (pedidos || 0) * 100) / 100) : pl.preco) : 0;
    var extra = Math.round(VALOR_CHAMADA * (chamadas || 0) * 100) / 100;
    return { plano: fixo, chamadas: extra, total: Math.round((fixo + extra) * 100) / 100 };
  }
  var VALOR_CHAMADA = 1.50; // igual a pedesul__valor_chamada() no banco (supabase/003_planos_parceiros.sql)

  raiz.RmdPlanos = { PLANOS: PLANOS, PROMOCAO: PROMOCAO, IMPLANTACAO: 150, MES_GRATIS: true, VALOR_CHAMADA: VALOR_CHAMADA,
    valorDoMes: valorDoMes, WHATSAPP_RMD: '5579988653766' };
})(typeof self !== 'undefined' ? self : this);
