/* Pede Sul — ordem dos produtos na vitrine (pedido do Rinaldo, 28/10/2026).
   Os produtos de todas as lojas aparecem misturados. Quem tem plano mais caro aparece mais e mais na frente:
   Completo pesa 3, Profissional 2, Essencial 1 (produto marcado como destaque pela loja ganha um pouco mais).
   A ordem é sorteada com esse peso e muda sozinha a cada 15 minutos — mas, dentro do mesmo período,
   é igual em todo aparelho (não fica pulando a cada vez que a pessoa abre a página).
   Também evita dois produtos seguidos da mesma loja quando dá. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.PedeSulVitrineProdutos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PESO = { completo: 3, personalizado: 3, profissional: 2, essencial: 1 };
  var MINUTOS = 15;

  function peso(p) { return (PESO[p.plano] || 1) * (p.destaque ? 1.5 : 1); }
  // período atual (muda a cada 15 min)
  function periodo(data) { return Math.floor((data || new Date()).getTime() / (MINUTOS * 60000)); }

  // números "sorteados" que se repetem para a mesma semente (mulberry32)
  function hashTexto(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function sorteio(semente, texto) {
    var a = (hashTexto(String(texto)) ^ Math.imul(semente | 0, 2654435761)) >>> 0;
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297;  // entre 0 e 1, nunca 0
  }

  // Sorteio com peso: quanto maior o peso, maior a chance de ficar na frente.
  function misturar(produtos, semente) {
    var ordem = produtos.map(function (p) {
      return { p: p, chave: Math.pow(sorteio(semente, (p.loja || '') + ':' + p.id), 1 / peso(p)) };
    }).sort(function (a, b) { return b.chave - a.chave; }).map(function (x) { return x.p; });
    return espalharLojas(ordem);
  }
  // Se dois seguidos são da mesma loja, puxa o próximo de outra loja para o meio (sem mudar muito a ordem).
  function espalharLojas(lista) {
    var r = lista.slice();
    for (var i = 1; i < r.length; i++) {
      if (r[i].loja !== r[i - 1].loja) continue;
      for (var j = i + 1; j < r.length && j <= i + 4; j++) {
        if (r[j].loja !== r[i - 1].loja) { r.splice(i, 0, r.splice(j, 1)[0]); break; }
      }
    }
    return r;
  }

  // Lojas abertas primeiro (produto de loja fechada vai para o fim).
  function ordenar(produtos, data) {
    var sem = periodo(data);
    var abertos = produtos.filter(function (p) { return p.aberto !== false; });
    var fechados = produtos.filter(function (p) { return p.aberto === false; });
    return misturar(abertos, sem).concat(misturar(fechados, sem));
  }

  // Os que passam na faixa "Em destaque agora": só de lojas abertas, no máximo 2 por loja.
  function destaques(ordenados, quantos) {
    var conta = {}, r = [];
    for (var i = 0; i < ordenados.length && r.length < (quantos || 10); i++) {
      var p = ordenados[i];
      if (p.aberto === false) continue;
      conta[p.loja] = (conta[p.loja] || 0) + 1;
      if (conta[p.loja] <= 2) r.push(p);
    }
    return r;
  }

  return { PESO: PESO, MINUTOS: MINUTOS, peso: peso, periodo: periodo, misturar: misturar, ordenar: ordenar, destaques: destaques };
});
