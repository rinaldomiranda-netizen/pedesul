/* Pede Sul — dados iniciais de cada loja no MODO DEMONSTRAÇÃO (só no navegador).
   - aterrisse: os mesmos do Aterrisse (almoço com preços do cardápio divulgado; o resto é FICTÍCIO).
   - conis-burger: produtos e complementos padrão do CONIS (preços de exemplo).
   - ohane: delicatessen de exemplo.
   - loja nova (criada na área do desenvolvedor): começa com o cardápio vazio. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.AterrisseDadosDemo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var seq = 0;
  function id(prefixo) { seq++; return prefixo + '-' + ('000' + seq).slice(-4); }
  function grupo(nome, minimo, maximo, opcoes) {
    return {
      id: id('g'), nome: nome, minimo: minimo, maximo: maximo,
      opcoes: opcoes.map(function (o) { return { id: id('o'), nome: o[0], preco: o[1] || 0, disponivel: true }; })
    };
  }
  function quentinha() {
    return [
      grupo('Carne', 1, 2, [['Costela de boi'], ['Coxa assada'], ['Carne do sol'], ['Peito de frango acebolado'], ['Toscana'], ['Bisteca']]),
      grupo('Feijão', 0, 1, [['Caldo / tradicional'], ['Tropeiro']]),
      grupo('Acompanhamentos', 0, 3, [['Arroz branco'], ['Macarrão'], ['Farofa']]),
      grupo('Salada', 0, 3, [['Verde'], ['Legumes'], ['Maionese']])
    ];
  }
  function produto(cat, ordem, nome, descricao, preco, icone, demo, extra) {
    var p = {
      id: id('p'), categoria_id: cat, nome: nome, descricao: descricao, preco: preco, icone: icone,
      imagem_url: null, imagem_ilustrativa: true, disponivel: true, ativo: true, destaque: false,
      demonstracao: demo, ingredientes_removiveis: [], permite_observacao: true, ordem: ordem, grupos: []
    };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  function criarAterrisse() {
    seq = 0;
    var cats = [
      { id: 'c-almoco', slug: 'almoco', nome: 'Almoço / Quentinhas', descricao: 'Monte sua quentinha com as opções do dia. As opções podem variar.', icone: '🍛', ordem: 1, ativa: true },
      { id: 'c-lanches', slug: 'lanches', nome: 'Lanches', descricao: 'Hambúrgueres e cachorro-quente.', icone: '🍔', ordem: 2, ativa: true },
      { id: 'c-jantar', slug: 'jantar', nome: 'Jantar nordestino', descricao: 'Cuscuz, macaxeira, carne do sol, tapioca, escondidinho e caldinhos.', icone: '🌽', ordem: 3, ativa: true },
      { id: 'c-acomp', slug: 'acompanhamentos', nome: 'Acompanhamentos', descricao: 'Porções para acompanhar.', icone: '🍟', ordem: 4, ativa: true },
      { id: 'c-bebidas', slug: 'bebidas', nome: 'Bebidas', descricao: 'Bebidas geladas.', icone: '🥤', ordem: 5, ativa: true }
    ];
    var adicLanche = function (lista) { return [grupo('Adicionais', 0, lista.length, lista)]; };
    var produtos = [
      produto('c-almoco', 1, 'Quentinha P', 'Escolha a carne, o feijão, os acompanhamentos e a salada do dia.', 18, '🍱', false, { destaque: true, grupos: quentinha() }),
      produto('c-almoco', 2, 'Quentinha G', 'Escolha a carne, o feijão, os acompanhamentos e a salada do dia.', 20, '🍱', false, { destaque: true, grupos: quentinha() }),
      produto('c-lanches', 1, 'X-Burger Aterrisse', 'Pão, hambúrguer bovino, queijo, presunto, alface, tomate e molho da casa.', 18, '🍔', true,
        { ingredientes_removiveis: ['Alface', 'Tomate', 'Presunto', 'Molho da casa'], grupos: adicLanche([['Bacon', 4], ['Ovo', 2], ['Queijo extra', 3], ['Hambúrguer extra', 6]]) }),
      produto('c-lanches', 2, 'X-Salada', 'Pão, hambúrguer, queijo, alface, tomate, cebola e molho da casa.', 20, '🥗', true,
        { ingredientes_removiveis: ['Alface', 'Tomate', 'Cebola', 'Molho da casa'], grupos: adicLanche([['Bacon', 4], ['Ovo', 2], ['Queijo extra', 3]]) }),
      produto('c-lanches', 3, 'X-Bacon', 'Pão, hambúrguer, queijo, bacon crocante, alface, tomate e molho da casa.', 23, '🥓', true,
        { ingredientes_removiveis: ['Alface', 'Tomate', 'Molho da casa'], grupos: adicLanche([['Ovo', 2], ['Queijo extra', 3]]) }),
      produto('c-lanches', 4, 'Cachorro-quente', 'Pão, salsicha, molho, milho, batata palha e queijo ralado.', 12, '🌭', true,
        { ingredientes_removiveis: ['Milho', 'Batata palha', 'Queijo ralado'] }),
      produto('c-jantar', 1, 'Cuscuz com ovo e queijo', 'Cuscuz de milho com ovo e queijo.', 14, '🌽', true),
      produto('c-jantar', 2, 'Cuscuz com carne do sol e queijo coalho', 'Cuscuz com carne do sol desfiada e queijo coalho.', 24, '🌽', true),
      produto('c-jantar', 3, 'Macaxeira com carne do sol', 'Macaxeira cozida com carne do sol na manteiga.', 28, '🥩', true),
      produto('c-jantar', 4, 'Macaxeira com queijo coalho', 'Macaxeira cozida com queijo coalho.', 18, '🧀', true),
      produto('c-jantar', 5, 'Escondidinho de macaxeira', 'Purê de macaxeira gratinado com o recheio escolhido.', 22, '🥘', true,
        { grupos: [grupo('Recheio', 1, 1, [['Carne do sol'], ['Frango'], ['Charque']])] }),
      produto('c-jantar', 6, 'Caldinho da noite', 'Caldinho do dia (pergunte o sabor).', 10, '🥣', true),
      produto('c-jantar', 7, 'Tapioca recheada', 'Tapioca com o recheio escolhido.', 12, '🫓', true,
        { grupos: [grupo('Recheio', 1, 1, [['Queijo coalho'], ['Carne do sol com queijo', 4], ['Frango com catupiry', 3], ['Coco com leite condensado', 2]])] }),
      produto('c-jantar', 8, 'Baião de dois', 'Arroz, feijão verde, queijo coalho e temperos.', 20, '🍚', true),
      produto('c-acomp', 1, 'Batata frita', 'Porção de batata frita.', 10, '🍟', true),
      produto('c-bebidas', 1, 'Refrigerante em lata', 'Lata 350 ml (pergunte os sabores).', 6, '🥤', true)
    ];
    return {
      loja: {
        nome: 'Restaurante Aterrisse', logo_url: 'assets/marca/selo_256.png', whatsapp: '5579988476641', aberto: true, aviso: null,
        horario_funcionamento: null, aceita_entrega: true, aceita_retirada: true, aceita_local: true,
        taxa_entrega: 0, pedido_minimo: 0, mesa_modo: 'opcional', previsao_retirada_min: 30, previsao_entrega_min: 30, previsao_local_min: 30,
        pagamentos: [
          { id: 'pix', nome: 'Pix (QR Code na tela ou na entrega)', ativo: true },
          { id: 'dinheiro', nome: 'Dinheiro (paga ao entregador ou no balcão)', ativo: true },
          { id: 'cartao', nome: 'Cartão (maquininha na entrega ou no balcão)', ativo: true }
        ],
        url_publica: null, pix_chave: '+5579996899727', pix_nome: 'RESTAURANTE ATERRISSE', pix_cidade: 'ARACAJU'
      },
      destaques: [
        { periodo: 'almoco', titulo: 'Almoço', inicio: '06:00', fim: '14:59', categorias: ['almoco'], ordem: 1, ativo: true },
        { periodo: 'lanches', titulo: 'Lanches', inicio: '15:00', fim: '17:59', categorias: ['lanches', 'acompanhamentos', 'bebidas'], ordem: 2, ativo: true },
        { periodo: 'jantar', titulo: 'Jantar nordestino', inicio: '18:00', fim: '05:59', categorias: ['jantar', 'lanches'], ordem: 3, ativo: true }
      ],
      categorias: cats,
      produtos: produtos
    };
  }

  var PAGAMENTOS = function () {
    return [
      { id: 'pix', nome: 'Pix (QR Code na tela ou na entrega)', ativo: true },
      { id: 'dinheiro', nome: 'Dinheiro (paga ao entregador ou no balcão)', ativo: true },
      { id: 'cartao', nome: 'Cartão (maquininha na entrega ou no balcão)', ativo: true }
    ];
  };
  function lojaPadrao(nome, extra) {
    var l = {
      nome: nome, logo_url: null, whatsapp: '5579988476641', aberto: true, aviso: null, horario_funcionamento: null,
      aceita_entrega: true, aceita_retirada: true, aceita_local: true, taxa_entrega: 5, pedido_minimo: 0, mesa_modo: 'opcional', mesas_qtd: 10,
      previsao_retirada_min: 25, previsao_entrega_min: 40, previsao_local_min: 25, pagamentos: PAGAMENTOS(),
      url_publica: null, pix_chave: null, pix_nome: null, pix_cidade: 'ARACAJU'
    };
    Object.keys(extra || {}).forEach(function (k) { l[k] = extra[k]; });
    return l;
  }
  function destaquesDia(cats) {
    return [{ periodo: 'dia', titulo: 'Cardápio', inicio: '00:00', fim: '23:59', categorias: cats, ordem: 1, ativo: true }];
  }

  // Cardápio padrão do CONIS (Conis Burger), com os complementos dele em grupos.
  function criarConis() {
    seq = 0;
    var cats = [
      { id: 'c-burger', slug: 'burger', nome: 'Burgers', descricao: 'Burgers artesanais.', icone: '🍔', ordem: 1, ativa: true },
      { id: 'c-combo', slug: 'combo', nome: 'Combos', descricao: 'Burger + batata + refrigerante.', icone: '🍟', ordem: 2, ativa: true },
      { id: 'c-acomp', slug: 'acompanhamentos', nome: 'Acompanhamentos', descricao: 'Porções.', icone: '🥔', ordem: 3, ativa: true },
      { id: 'c-bebida', slug: 'bebidas', nome: 'Bebidas', descricao: 'Bebidas geladas e sucos.', icone: '🥤', ordem: 4, ativa: true }
    ];
    var complementos = function () {
      return [
        grupo('Adicionais', 0, 5, [['Bacon', 5], ['Cheddar', 4], ['Mussarela', 4], ['Catupiry', 5], ['Ovo', 3.5], ['Cebola caramelizada', 3], ['Picles', 2], ['Carne extra 100g', 8]]),
        grupo('Molhos', 0, 3, [['Ketchup'], ['Mostarda'], ['Maionese da casa', 2], ['Molho barbecue', 2.5], ['Molho cheddar', 3]])
      ];
    };
    var produtos = [
      produto('c-burger', 1, 'X-Conis', 'Burger artesanal, queijo e molho da casa.', 29.9, '🍔', true, { destaque: true, ingredientes_removiveis: ['Molho da casa'], grupos: complementos() }),
      produto('c-burger', 2, 'Duplo Conis', 'Dois burgers, queijo e cebola.', 39.9, '🍔', true, { ingredientes_removiveis: ['Cebola'], grupos: complementos() }),
      produto('c-combo', 1, 'Combo Conis', 'Burger + batata + refrigerante.', 42.9, '🍟', true, { destaque: true,
        grupos: [grupo('Refrigerante', 1, 1, [['Coca-Cola lata'], ['Guaraná lata'], ['Fanta lata']])].concat(complementos()) }),
      produto('c-acomp', 1, 'Batata frita', 'Porção de batata frita.', 7, '🍟', true),
      produto('c-acomp', 2, 'Batata rústica', 'Porção de batata rústica.', 8, '🥔', true),
      produto('c-acomp', 3, 'Anéis de cebola', 'Porção de anéis de cebola empanados.', 8, '🧅', true),
      produto('c-bebida', 1, 'Refrigerante lata', 'Lata 350 ml.', 6, '🥤', true),
      produto('c-bebida', 2, 'Suco natural', 'Suco preparado na hora.', 9.9, '🧃', true)
    ];
    return { loja: lojaPadrao('Conis Burger', { pix_nome: 'CONIS BURGER' }), destaques: destaquesDia(['burger', 'combo']), categorias: cats, produtos: produtos };
  }

  // Delicatessen de exemplo (a parte "Ohane" do pacote do CONIS).
  function criarOhane() {
    seq = 0;
    var cats = [
      { id: 'c-salg', slug: 'salgados', nome: 'Salgados e sanduíches', descricao: 'Feitos na casa.', icone: '🥪', ordem: 1, ativa: true },
      { id: 'c-doce', slug: 'doces', nome: 'Doces e bolos', descricao: 'Bolo do dia, brownie e mais.', icone: '🍰', ordem: 2, ativa: true },
      { id: 'c-beb', slug: 'bebidas', nome: 'Cafés e sucos', descricao: 'Bebidas.', icone: '☕', ordem: 3, ativa: true }
    ];
    var produtos = [
      produto('c-salg', 1, 'Salgados assados', 'Seleção de salgados artesanais.', 9.5, '🥐', true,
        { grupos: [grupo('Sabor', 1, 1, [['Frango com catupiry'], ['Carne'], ['Queijo e presunto']])] }),
      produto('c-salg', 2, 'Sanduíche especial', 'Pão artesanal, frios e queijo.', 18.9, '🥪', true, { ingredientes_removiveis: ['Tomate', 'Alface'] }),
      produto('c-doce', 1, 'Fatia de bolo', 'Bolo do dia da delicatessen.', 12.9, '🍰', true,
        { destaque: true, grupos: [grupo('Bolo do dia', 1, 1, [['Chocolate'], ['Cenoura com chocolate'], ['Laranja']])] }),
      produto('c-doce', 2, 'Brownie', 'Brownie artesanal de chocolate.', 10.9, '🍫', true),
      produto('c-beb', 1, 'Café expresso', 'Café expresso.', 6, '☕', true),
      produto('c-beb', 2, 'Suco natural', 'Suco preparado na hora.', 9.9, '🧃', true)
    ];
    return { loja: lojaPadrao('Ohane Delicatessen', { taxa_entrega: 6, pix_nome: 'OHANE DELICATESSEN' }),
      destaques: destaquesDia(['salgados', 'doces']), categorias: cats, produtos: produtos };
  }

  // Loja nova: cardápio vazio, o dono cadastra no painel.
  function criarVazia(nome) {
    seq = 0;
    return { loja: lojaPadrao(nome || 'Loja nova'), destaques: destaquesDia([]),
      categorias: [{ id: 'c-cardapio', slug: 'cardapio', nome: 'Cardápio', descricao: '', icone: '🍽️', ordem: 1, ativa: true }], produtos: [] };
  }

  function criar(slug, nome) {
    if (!slug || slug === 'aterrisse') {
      var a = criarAterrisse();
      a.loja.mesas_qtd = 10;
      if (nome) a.loja.nome = nome;
      return a;
    }
    if (slug === 'conis-burger') return criarConis();
    if (slug === 'ohane') return criarOhane();
    return criarVazia(nome);
  }

  return { criar: criar };
});
