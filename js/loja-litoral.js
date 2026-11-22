/* Cardápio da Litoral Açaí e Lanches (copiado dos folhetos que o Rinaldo mandou, 22/11/2026), loja de exemplo para mostrar ao cliente.
   Abre em loja.html?loja=litoral (fora da vitrine até o cliente aceitar). */
(function () {
  'use strict';
  var D = window.AterrisseDadosDemo, criarOriginal = D.criar, seq = 0;
  function id(p) { seq++; return p + '-l' + ('000' + seq).slice(-4); }
  function grupo(nome, minimo, maximo, opcoes) {
    return { id: id('g'), nome: nome, minimo: minimo, maximo: maximo,
      opcoes: opcoes.map(function (o) { return { id: id('o'), nome: o[0], preco: o[1] || 0, disponivel: true }; }) };
  }
  function produto(cat, ordem, nome, descricao, preco, icone, extra) {
    var p = { id: id('p'), categoria_id: cat, nome: nome, descricao: descricao, preco: preco, icone: icone, imagem_url: null, imagem_ilustrativa: true,
      disponivel: true, ativo: true, destaque: false, demonstracao: false, ingredientes_removiveis: [], permite_observacao: true, ordem: ordem, grupos: [] };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  var EXTRA_ACAI = [['Leite condensado ou mel', 2], ['Granola', 2], ['Amendoim', 2], ['Nutella', 5], ['Castanha', 3], ['Ovomaltine', 3], ['Paçoca', 2], ['Creme', 5],
    ['Ninho', 3], ['M&M', 2], ['Banana', 2], ['Cupuaçu', 5], ['Morango', 5], ['Uva', 4]];
  var EXTRA_LANCHE = [['Carne de hambúrguer', 4], ['Ovo', 3], ['Queijo', 3], ['Presunto', 3], ['Frango', 7], ['Calabresa', 7], ['Bacon', 9], ['Coração', 9], ['Filé', 9], ['Catupiry', 5]];
  function acai(ordem, nome, desc, p, m, g, destaque) {
    return produto('c-acai', ordem, nome, desc, p, '🍇', { destaque: !!destaque, grupos: [
      grupo('Tamanho', 1, 1, [['P'], ['M', Math.round((m - p) * 100) / 100], ['G', Math.round((g - p) * 100) / 100]]),
      grupo('Porções extra', 0, 6, EXTRA_ACAI)] });
  }
  function criarLitoral() {
    seq = 0;
    var cats = [
      { id: 'c-acai', slug: 'acai', nome: 'Açaí', descricao: 'Tamanhos P, M e G. Escolha leite condensado ou mel.', icone: '🍇', ordem: 1, ativa: true },
      { id: 'c-tap-sal', slug: 'tapioca-salgada', nome: 'Tapioca salgada', descricao: 'Temos catupiry! Troque o queijo tradicional por catupiry.', icone: '🫓', ordem: 2, ativa: true },
      { id: 'c-tap-doce', slug: 'tapioca-doce', nome: 'Tapioca doce', descricao: '', icone: '🫓', ordem: 3, ativa: true },
      { id: 'c-hotdog', slug: 'hot-dog', nome: 'Hot Dog', descricao: '', icone: '🌭', ordem: 4, ativa: true },
      { id: 'c-burger', slug: 'hamburguer', nome: 'Hambúrguer', descricao: 'Catupiry no hambúrguer: + R$ 5,00.', icone: '🍔', ordem: 5, ativa: true },
      { id: 'c-polpa', slug: 'sucos-polpa', nome: 'Sucos de polpa', descricao: 'Com água R$ 6,00 · com leite R$ 7,00.', icone: '🧃', ordem: 6, ativa: true },
      { id: 'c-fruta', slug: 'sucos-fruta', nome: 'Sucos de frutas', descricao: 'Com leite + R$ 1,00.', icone: '🍓', ordem: 7, ativa: true },
      { id: 'c-bebida', slug: 'bebidas', nome: 'Bebidas', descricao: '', icone: '🥤', ordem: 8, ativa: true }
    ];
    var queijoCatupiry = function () { return [grupo('Queijo', 0, 1, [['Queijo tradicional'], ['Trocar por catupiry']])]; };
    var tapSal = [['Pura c/ manteiga', 9], ['Queijo', 12], ['Queijo c/ coco', 14], ['Dois queijos', 16], ['Queijo e tomate', 12], ['Queijo e presunto', 16], ['Queijo c/ ovo', 14],
      ['Queijo frango', 18], ['Queijo charque', 20], ['Queijo calabresa', 17], ['Queijo bacon', 20], ['Queijo carne de sol', 20]];
    var tapDoce = [['Queijo e leite condensado', 15], ['Queijo, coco e leite condensado', 16], ['Queijo, banana, canela e açúcar', 16], ['Queijo e nutella', 19], ['Romeu e Julieta', 16]];
    var RECHEIOS = [['Frango'], ['Charque'], ['Calabresa'], ['Bacon'], ['Carne de sol'], ['Presunto'], ['Ovo'], ['Tomate'], ['Coco'], ['Catupiry']];
    var produtos = [
      acai(1, '01. Açaí Tradicional', 'Banana, amendoim, granola, leite condensado ou mel.', 18, 20, 22, true),
      acai(2, '02. Açaí com creme de cupuaçu', 'Cupuaçu, banana, amendoim, granola, leite condensado ou mel.', 22, 23, 24),
      acai(3, '03. Açaí com creme de ninho', 'Creme, banana, amendoim, granola, leite condensado ou mel.', 22, 23, 24, true),
      acai(4, '04. Açaí com fruta', 'Banana, outra fruta, amendoim, granola, leite condensado ou mel.', 22, 23, 24),
      acai(5, '05. Açaí brincadeira de criança', 'Ovomaltine, confete, granola, leite condensado ou mel.', 20, 22, 24),
      acai(6, '06. Açaí Tropical', 'Creme, banana, morango, uva, amendoim, granola, leite condensado ou mel.', 24, 26, 28),
      acai(7, '07. Açaí com sorvete', 'Sorvete, amendoim, granola, leite condensado ou mel.', 20, 22, 23),
      acai(8, '08. Açaí Primavera', 'Sorvete, banana, outra fruta, amendoim, granola, leite condensado ou mel.', 23, 25, 27),
      acai(9, '09. Açaí Sergipano', 'Banana, paçoca, amendoim, granola, leite condensado ou mel.', 20, 21, 23),
      acai(10, '10. Açaí Ovomaltine', 'Ovomaltine, banana, amendoim, granola, leite condensado ou mel.', 19, 21, 23),
      acai(11, '11. Açaí Nutella', 'Banana, morango, nutella, leite em pó, granola, leite condensado ou mel.', 24, 26, 28, true)
    ];
    tapSal.forEach(function (t, i) {
      produtos.push(produto('c-tap-sal', i + 1, (12 + i) + '. Tapioca ' + t[0].toLowerCase(), '', t[1], '🫓', /queijo/i.test(t[0]) ? { grupos: queijoCatupiry() } : {}));
    });
    produtos.push(produto('c-tap-sal', 13, '24. Tapioca montada', '1 queijo e 2 recheios (catupiry também vale como recheio).', 22, '🫓', { destaque: true,
      grupos: [grupo('Queijo', 1, 1, [['Queijo tradicional'], ['Catupiry']]), grupo('Recheios', 2, 2, RECHEIOS)] }));
    tapDoce.forEach(function (t, i) { produtos.push(produto('c-tap-doce', i + 1, (25 + i) + '. Tapioca ' + t[0].toLowerCase(), '', t[1], '🫓')); });
    produtos.push(produto('c-tap-doce', 6, '30. Tapioca montada (doce)', '1 queijo e 2 recheios.', 22, '🫓'));
    [['31. Cachorro-quente tradicional', 'Pão, salsicha, molho, alface, milho, ervilha, batata palha, queijo ralado.', 11],
     ['32. Cachorro-quente de frango', 'Pão, salsicha, molho, frango, alface, milho, ervilha, batata palha e queijo ralado.', 15],
     ['33. Cachorro-quente de carne', 'Pão, salsicha, molho, carne, alface, milho, ervilha, batata palha e queijo ralado.', 15]].forEach(function (h, i) {
      produtos.push(produto('c-hotdog', i + 1, h[0], h[1], h[2], '🌭', { ingredientes_removiveis: ['Alface', 'Milho', 'Ervilha', 'Batata palha'] }));
    });
    [['34. Misto', 'Queijo e presunto.', 10], ['35. Americano', 'Queijo e presunto, ovo, alface e tomate.', 11], ['36. X-burger', 'Carne, queijo, presunto, alface e tomate.', 12],
     ['37. X-burger hot', 'Carne, queijo, presunto, salsicha, milho, batata palha, alface e tomate.', 14], ['38. Eggs-burger', 'Carne, ovo, queijo, presunto, alface e tomate.', 14],
     ['39. Eggs-duplo', 'Duas carnes, dois ovos, dois queijos, dois presuntos, batata palha, alface e tomate.', 19],
     ['40. Eggs-bacon', 'Carne, ovo, queijo, presunto, bacon, batata palha, alface, tomate e milho.', 20],
     ['41. Eggs-frango', 'Frango, ovo, queijo, presunto, alface, tomate, milho e batata palha.', 19],
     ['42. Eggs-calabresa', 'Carne, calabresa, ovo, queijo, presunto, batata palha, alface, tomate e milho.', 20],
     ['43. Alasanhado', 'Carne, frango, ovo, queijo, presunto, alface, tomate, batata palha e milho.', 20],
     ['44. Especial da casa', 'Carne, bacon, calabresa, ovo, queijo, presunto, alface, tomate, batata palha e milho.', 20],
     ['45. Super Especial', '2 carnes, bacon, calabresa, frango, ovo, queijo, presunto, alface, tomate, batata palha e milho.', 24],
     ['46. Eggs-coração', 'Coração, ovo, queijo, presunto, alface, tomate, milho, cebola e batata palha.', 22],
     ['47. Eggs-filé', 'Filé acebolado, ovo, queijo, presunto, alface, tomate, milho e batata palha.', 24],
     ['48. Super Litoral', '2 carnes, frango, calabresa, bacon, coração, filé, ovo, queijo, presunto, alface, tomate, cebola, milho e batata palha.', 34]].forEach(function (b, i) {
      produtos.push(produto('c-burger', i + 1, b[0], b[1], b[2], '🍔', { destaque: b[0].indexOf('Super Litoral') >= 0, ingredientes_removiveis: ['Alface', 'Tomate', 'Milho', 'Batata palha'],
        grupos: [grupo('Porções extra', 0, 6, EXTRA_LANCHE)] }));
    });
    produtos.push(produto('c-polpa', 1, 'Suco de polpa', 'Escolha o sabor. Com leite + R$ 1,00.', 6, '🧃', { grupos: [
      grupo('Sabor', 1, 1, [['Maracujá'], ['Cajá'], ['Mangaba'], ['Graviola'], ['Umbu'], ['Cacau'], ['Cupuaçu'], ['Acerola'], ['Manga'], ['Ameixa']]),
      grupo('Preparo', 1, 1, [['Com água'], ['Com leite', 1]])] }));
    [['Morango c/ laranja', 8], ['Morango', 7], ['Laranja', 7], ['Açaí', 7]].forEach(function (s, i) {
      produtos.push(produto('c-fruta', i + 1, 'Suco de ' + s[0].toLowerCase(), '', s[1], '🍓', { grupos: [grupo('Preparo', 1, 1, [['Com água'], ['Com leite', 1]])] }));
    });
    [['Coca lata', 6], ['Guaraná lata', 6], ['Fanta lata', 6], ['Sprite lata', 6], ['Água mineral c/ gás', 3], ['Água mineral s/ gás', 2], ['Coca litro', 9],
     ['Guaraná litro', 8], ['Guará mix', 3], ['Pitchulinha Goob', 2.5], ['Amstel', 5]].forEach(function (b, i) { produtos.push(produto('c-bebida', i + 1, b[0], '', b[1], '🥤')); });
    return {
      loja: { nome: 'Litoral Açaí e Lanches', logo_url: 'assets/litoral_logo.png', whatsapp: '5579988683293', aberto: true, aviso: 'Temos catupiry! Delivery e retirada.',
        horario_funcionamento: 'Delivery: (79) 98868-3293 · (79) 99630-5414', aceita_entrega: true, aceita_retirada: true, aceita_local: true,
        taxa_entrega: 5, taxas_bairro: [{ bairro: 'Atalaia', taxa: 4 }, { bairro: 'Coroa do Meio', taxa: 5 }, { bairro: 'Farolândia', taxa: 6 }],
        pedido_minimo: 0, mesa_modo: 'opcional', mesas_qtd: 8, previsao_retirada_min: 20, previsao_entrega_min: 40, previsao_local_min: 20,
        pagamentos: [{ id: 'pix', nome: 'Pix (QR Code na tela ou na entrega)', ativo: true }, { id: 'dinheiro', nome: 'Dinheiro (paga ao entregador ou no balcão)', ativo: true },
          { id: 'cartao', nome: 'Cartão (Elo, Visa, Master, Hipercard, Amex, Diners)', ativo: true }],
        url_publica: null, pix_chave: '+5579988683293', pix_nome: 'LITORAL ACAI E LANCHES', pix_cidade: 'ARACAJU', cor: '#a35ee0', endereco: 'Zona Sul de Aracaju' },
      destaques: [{ periodo: 'dia', titulo: 'Cardápio', inicio: '00:00', fim: '23:59', categorias: ['acai', 'tapioca-salgada', 'hamburguer'], ordem: 1, ativo: true }],
      categorias: cats, produtos: produtos
    };
  }
  D.criar = function (slug, nome) { return slug === 'litoral' ? criarLitoral() : criarOriginal(slug, nome); };
})();
