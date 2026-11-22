/* Êta Brownie — Browneria Delivery (Salvador/BA), dona Jusileide. Cliente em negociação (22/11/2026).
   Conteúdo REAL do cardápio dela (lido no cardápio online que ela usa hoje): nomes, descrições, preços, promoções,
   esgotados e fotos dela (assets/lojas/etabrownie/). Fora da vitrine até ela aceitar; abre por loja.html?loja=etabrownie. */
(function () {
  'use strict';
  var D = window.AterrisseDadosDemo;
  if (!D) return;
  var criarOriginal = D.criar, seq = 0;
  var A = 'assets/lojas/etabrownie/';
  function id(p) { seq++; return p + '-eb' + ('000' + seq).slice(-4); }
  function grupo(nome, minimo, maximo, opcoes) {
    return { id: id('g'), nome: nome, minimo: minimo, maximo: maximo, opcoes: opcoes.map(function (o) { return { id: id('o'), nome: o[0], preco: o[1] || 0, disponivel: true }; }) };
  }
  function produto(cat, ordem, nome, desc, preco, foto, extra) {
    var p = { id: id('p'), categoria_id: cat, nome: nome, descricao: desc, preco: preco, icone: '🍫', imagem_url: foto ? A + foto + '.jpg' : null,
      imagem_ilustrativa: !foto, disponivel: true, ativo: true, destaque: false, demonstracao: false, ingredientes_removiveis: [], permite_observacao: true, ordem: ordem, grupos: [] };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  var COLHER = function () { return [grupo('Deseja colher descartável?', 0, 2, [['Colher descartável']])]; };
  function promo(de, desc) { return '🔥 Promoção: de R$ ' + de + '. ' + desc; }
  function criar() {
    seq = 0;
    var cats = [
      { id: 'c-terapia', slug: 'melhor-que-terapia', nome: 'Melhor que terapia', descricao: 'Brownies recheados de massa úmida e macia.', icone: '🍫', ordem: 1, ativa: true },
      { id: 'c-copo', slug: 'copo-da-felicidade', nome: 'Copo da Felicidade', descricao: 'Brownie e brigadeiro em camadas, no copo de 200 ml.', icone: '🥄', ordem: 2, ativa: true },
      { id: 'c-mainha', slug: 'abraco-de-mainha', nome: 'Abraço de Mainha 🫶', descricao: 'Para dividir (ou não).', icone: '🤎', ordem: 3, ativa: true },
      { id: 'c-choco', slug: 'chocotone', nome: 'Chocotone', descricao: 'Fatias de chocotone com massa super macia.', icone: '🎄', ordem: 4, ativa: true },
      { id: 'c-verao', slug: 'chegou-o-verao', nome: 'Êta! Chegou o Verão', descricao: 'Sobremesas geladinhas.', icone: '☀️', ordem: 5, ativa: true }
    ];
    var produtos = [
      produto('c-terapia', 1, 'Brownie recheado - Ninho com Nutella', 'Tá precisando de um docinho? Então você precisa experimentar esse brownie de massa úmida e macia, recheado com um brigadeiro cremoso de Ninho e finalizado com uma camada de Nutella.', 7.50, 'brownie-ninho-nutella', { destaque: true }),
      produto('c-terapia', 2, 'Brownie recheado - Cookies', promo('8,98', 'Brownie de chocolate macio recheado com brigadeiro de baunilha + crocantes de cookies, uma combinação irresistível de sabores e texturas! 🤎'), 6.99, 'brownie-cookies', { destaque: true }),
      produto('c-terapia', 3, 'Brownie recheado - Prestígio', 'A combinação que não tem erro: massa intensa de brownie + recheio cremoso de coco, criando aquele sabor clássico de prestígio que conquista na primeira mordida.', 6.99, 'brownie-prestigio'),
      produto('c-terapia', 4, 'Brownie recheado - Doce de leite', 'Perfeito para quem é formiguinha! Brownie recheado com o nosso doce de leite artesanal, feito aqui mesmo para garantir um sabor equilibrado e cremoso.', 6.99, 'brownie-doce-de-leite'),
      produto('c-terapia', 5, 'Brownie recheado - Mousse de maracujá', 'Ideal para quem ama um sabor mais equilibrado! Nosso brownie recheado com um brigadeiro de maracujá feito da fruta mesmo, cremoso e azedinho.', 6.99, 'brownie-mousse-maracuja'),
      produto('c-terapia', 6, 'Brownie recheado - Brigadeiro 50% cacau', 'Tradicional e delicioso! Brownie recheado com um brigadeiro cremoso de 50% cacau.', 6.99, 'brownie-brigadeiro-50'),
      produto('c-terapia', 7, 'Brownie recheado - Brigadeiro de café', 'Nosso brownie de chocolate, macio por dentro, com um recheio cremoso de café. O contraste do chocolate com o sabor intenso do café cria uma experiência simplesmente irresistível.', 6.99, 'brownie-brigadeiro-cafe'),
      produto('c-copo', 1, 'Copo da Felicidade - Brigadeiro branco com geleia de morango', promo('17,90', 'Brownie + brigadeiro branco de leite em pó + nossa geleia de morango artesanal. A combinação que você não sabia que precisava, mas conquistará o seu coração 🤍❤️ 200 ml.'), 14.99, 'copo-brigadeiro-branco-morango', { destaque: true, grupos: COLHER() }),
      produto('c-copo', 2, 'Copo da Felicidade - Maracujá com brigadeiro 50% cacau', 'O mais vendido! 200 ml. Tá precisando de um docinho meio azedinho? Essa é a opção perfeita pra você: brigadeiro de maracujá com brigadeiro 50% cacau e brownie.', 13.99, 'copo-maracuja', { disponivel: false, grupos: COLHER() }),
      produto('c-mainha', 1, 'Marmita Cookie', promo('21,90', 'O mais vendido! Marmita cookie com massa amanteigada, crocante por fora e macia por dentro, recheada com Nutella.'), 16.99, 'marmita-cookie', { disponivel: false }),
      produto('c-mainha', 2, 'Brownie SUPREME', promo('19,90', 'Recomendamos o consumo imediato. Dois brownies bem chocolatudos, com duas camadas generosas de recheio e cobertura.'), 14.50, 'brownie-supreme', { disponivel: false }),
      produto('c-choco', 1, 'Fatia Chocotone - Maracujá com brigadeiro 50% cacau', promo('18,00', 'Com uma massa super macia, recheada com nosso brigadeiro cremoso de maracujá, feito com a redução da própria fruta, e o equilíbrio perfeito do nosso intenso brigadeiro 50% cacau. 🤎'), 14.99, null, { grupos: COLHER() }),
      produto('c-choco', 2, 'Fatia Chocotone - Ninho com morango', promo('19,00', 'Nosso chocotone tem uma massa super macia, recheada com um cremoso brigadeiro de Ninho e morango.'), 16.99, 'chocotone-ninho-morango', { disponivel: false, grupos: COLHER() }),
      produto('c-verao', 1, 'Ice Cookie', promo('17,80', 'A sua nova sobremesa favorita! Cookie quentinho e macio, finalizado com Nutella e acompanhado de sorvete.'), 13.00, 'ice-cookie', { disponivel: false })
    ];
    return {
      loja: { nome: 'Êta Brownie', logo_url: A + 'logo.png', whatsapp: '5571986359939', aberto: true,
        aviso: 'Seu pedido é produzido após a confirmação. Entrega por motoboy de aplicativo (solicitado pelo cliente) ou retirada.',
        horario_funcionamento: 'Browneria Delivery · Salvador/BA', aceita_entrega: true, aceita_retirada: true, aceita_local: false,
        taxa_entrega: 0, taxas_bairro: [], pedido_minimo: 0, mesa_modo: 'desligado', mesas_qtd: 0, previsao_retirada_min: 30, previsao_entrega_min: 50, previsao_local_min: 30,
        pagamentos: [{ id: 'pix', nome: 'Pix', ativo: true }, { id: 'dinheiro', nome: 'Dinheiro', ativo: true }, { id: 'cartao', nome: 'Cartão (na retirada)', ativo: true }],
        url_publica: null, pix_chave: null, pix_nome: 'ETA BROWNIE', pix_cidade: 'SALVADOR', cor: '#e09a5a', endereco: null,
        regiao: 'BA', faixa_auto: true, anuncios: [] },
      destaques: [{ periodo: 'dia', titulo: 'Cardápio', inicio: '00:00', fim: '23:59', categorias: ['melhor-que-terapia', 'copo-da-felicidade'], ordem: 1, ativo: true }],
      categorias: cats, produtos: produtos
    };
  }
  D.criar = function (slug, nome) { return slug === 'etabrownie' ? criar() : criarOriginal(slug, nome); };
})();
