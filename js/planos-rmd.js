/* Planos do Pede Sul (RMD Delivery) e a promoção de lançamento. Copiado do Aterrisse, com os recursos que vieram do CONIS. Usado pela área do desenvolvedor (rmd.js) e pela página de vendas (vendas.js).
   Preços sugeridos pela RMD (pesquisa de mercado de 25/10/2026). Mudou aqui, muda nas duas telas. */
(function (raiz) {
  'use strict';
  // "recursos" = o que o botão "Ligar recursos deste plano" (área do desenvolvedor) deixa ligado na loja.
  // Salão: só a organização DENTRO da loja (caixa, balcão, cozinha, mesas; o cliente pede pelo QR da mesa).
  // Não vende para fora e fica fora da vitrine: a loja continua vendendo para fora do jeito que ela escolher.
  // Se quiser vender para fora pelo Pede Sul, a RMD liga entrega/retirada como adicional. Preço = sugestão (decisão do Rinaldo).
  var PLANOS = [
    { id: 'salao', nome: 'Salão', preco: 59.90, anual: 599.00, para: 'Só a organização interna: balcão, cozinha e mesas', interno: true,
      itens: ['Caixa: abrir, vender no balcão, sangria e fechamento', 'Mesas e garçom, com conta da mesa', 'Cliente vê o cardápio e pede pelo QR Code da mesa', 'Tela da cozinha e comanda impressa', 'Cadastro de clientes e relatórios', 'Não recebe pedido de fora da loja (sem entrega e sem retirada)'],
      recursos: { entrega: false, retirada: false, local: true, qrcode: true, post: true, cozinha: true, entregadores: false, oferta: false, caixa: true, mesas: true, clientes: true, relatorios: true } },
    { id: 'essencial', nome: 'Essencial', preco: 79.90, anual: 799.00, para: 'Quem está começando o delivery próprio',
      itens: ['Cardápio online com QR Code e link', 'Pedidos de entrega, retirada e mesa', 'Painel de pedidos com contagem do prazo', 'Logo e cores da loja', 'Post do dia e cardápio do dia (tem / não tem)', 'Busca do endereço pelo CEP', 'Acessos da equipe com usuário e senha'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: false, entregadores: false, oferta: false, caixa: false, mesas: false, clientes: false, relatorios: false } },
    { id: 'profissional', nome: 'Profissional', preco: 149.90, anual: 1499.00, para: 'Restaurante com cozinha e entregadores', destaque: true,
      itens: ['Tudo do Essencial', 'Tela da cozinha e comanda impressa', 'Tela do entregador no celular, com Google Maps e Waze', 'Entrega oferecida ao entregador online (aceita ou passa ao próximo)', 'Caixa: abrir, vender no balcão, sangria e fechamento', 'Ocorrências de entrega', 'Suporte por WhatsApp em horário comercial'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: true, entregadores: true, oferta: true, caixa: true, mesas: false, clientes: false, relatorios: false } },
    { id: 'completo', nome: 'Completo', preco: 229.90, anual: 2299.00, para: 'Quem quer controle e números do negócio',
      itens: ['Tudo do Profissional', 'Mesas e garçom, com conta da mesa', 'Cadastro de clientes pelo telefone', 'Relatórios de vendas e produtos mais pedidos', 'Cadastro inicial do cardápio feito pela RMD', 'QR Codes impressos das mesas', 'Suporte prioritário'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, post: true, cozinha: true, entregadores: true, oferta: true, caixa: true, mesas: true, clientes: true, relatorios: true } }
  ];
  // Promoção de lançamento (decisão do Rinaldo, 27/10/2026): os 5 primeiros restaurantes inscritos levam o plano
  // Completo pelo preço do Essencial e, nos 3 primeiros meses, pagam metade disso. Quem conta as vagas é o servidor
  // (supabase/007_vagas_lancamento.sql); se mudar o número de vagas, mudar lá também.
  var PROMOCAO = { vagas: 5, plano: 'completo', pagaComo: 'essencial', mesesMetade: 3 };
  var ESSENCIAL = PLANOS.filter(function (p) { return p.id === 'essencial'; })[0];
  PROMOCAO.preco = ESSENCIAL.preco;
  PROMOCAO.precoInicio = Math.round(ESSENCIAL.preco * 50) / 100;
  raiz.RmdPlanos = { PLANOS: PLANOS, PROMOCAO: PROMOCAO, IMPLANTACAO: 150, WHATSAPP_RMD: '5579988653766' };
})(typeof self !== 'undefined' ? self : this);
