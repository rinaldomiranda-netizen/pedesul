/* Pede Sul — temas da época (pedido do Rinaldo, 28/10/2026): perto de cada festa a vitrine muda sozinha
   as cores, ganha enfeites com movimento e uma propaganda de saudação no começo da faixa.
   Tudo pela data do aparelho (horário de Aracaju); nada para ligar. Carnaval e Páscoa mudam de data todo ano:
   são calculados a partir da Páscoa. Para ver um tema antes da hora: ?tema=natal (ou carnaval, saojoao...). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.PedeSulTemas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function dia(a, m, d) { return new Date(a, m - 1, d); }
  function somar(data, n) { var x = new Date(data.getTime()); x.setDate(x.getDate() + n); return x; }
  // Domingo de Páscoa (cálculo de Meeus/Jones/Butcher)
  function pascoa(a) {
    var b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25),
      h = Math.floor((c - g + 1) / 3), i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4,
      m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451), mes = Math.floor((i + m - 7 * n + 114) / 31),
      dd = ((i + m - 7 * n + 114) % 31) + 1;
    return dia(a, mes, dd);
  }
  // n-ésimo dia da semana do mês (0 = domingo)
  function enesimo(a, m, semana, n) {
    var x = dia(a, m, 1), conta = 0;
    while (true) { if (x.getDay() === semana && ++conta === n) return x; x = somar(x, 1); }
  }

  // id, nome, quando começa e termina (inclusive), cores (fundo1, fundo2, destaque), enfeite e saudação da faixa
  var TEMAS = {
    carnaval: { nome: 'Carnaval', cores: ['#5b1f8f', '#0e7c86', '#ffb627'], enfeite: 'confete', emoji: '🎭',
      saudacao: ['Carnaval na Zona Sul!', 'Fantasia pronta? A comida a gente leva até você.'] },
    pascoa: { nome: 'Páscoa', cores: ['#6b3e26', '#d98c5f', '#ffe1a8'], enfeite: 'ovos', emoji: '🐰',
      saudacao: ['Feliz Páscoa!', 'Doces e almoço de domingo das lojas da Zona Sul.'] },
    maes: { nome: 'Dia das Mães', cores: ['#8a1f4f', '#e05a8a', '#ffd1e0'], enfeite: 'coracoes', emoji: '💐',
      saudacao: ['Dia das Mães', 'Deixe a cozinha com a gente e aproveite o dia com ela.'] },
    saojoao: { nome: 'São João', cores: ['#7a2e0e', '#e0791a', '#ffd23f'], enfeite: 'bandeirinhas', emoji: '🌽',
      saudacao: ['Arraiá do Pede Sul!', 'Milho, canjica e comida boa no São João de Aracaju.'] },
    pais: { nome: 'Dia dos Pais', cores: ['#0f2a3d', '#1e5b8a', '#ffb627'], enfeite: 'estrelas', emoji: '👔',
      saudacao: ['Dia dos Pais', 'Um almoço especial sem ninguém precisar cozinhar.'] },
    patria: { nome: 'Semana da Pátria', cores: ['#0b6b3a', '#1f8f4e', '#ffd23f'], enfeite: 'estrelas', emoji: '💚',
      saudacao: ['Semana da Pátria', 'Feriado de 7 de Setembro com comida boa em casa.'] },
    criancas: { nome: 'Dia das Crianças', cores: ['#1f4fd1', '#ff5ca8', '#ffd23f'], enfeite: 'baloes', emoji: '🎈',
      saudacao: ['Dia das Crianças!', 'Lanche, doce e alegria entregues na sua porta.'] },
    blackfriday: { nome: 'Black Friday', cores: ['#0a0a0a', '#2a2a2a', '#ffb627'], enfeite: 'faiscas', emoji: '🏷️',
      saudacao: ['Black Friday', 'Fique de olho nas promoções das lojas da Zona Sul.'] },
    natal: { nome: 'Natal', cores: ['#8f1d22', '#0e5e3a', '#ffd23f'], enfeite: 'neve', emoji: '🎄',
      saudacao: ['Feliz Natal, Zona Sul!', 'Ceia, doces e presentes: as lojas do bairro levam até você.'] },
    anonovo: { nome: 'Ano Novo', cores: ['#0c1c3d', '#3b2a6b', '#ffd23f'], enfeite: 'fogos', emoji: '🎆',
      saudacao: ['Feliz Ano Novo!', 'Que o próximo ano venha com muito sabor. Obrigado, Zona Sul!'] }
  };

  // Quando cada tema fica no ar no ano "a" (a ordem resolve sobreposição: o primeiro que bater vale).
  function periodos(a) {
    var p = pascoa(a), carnaval = somar(p, -47); // terça de Carnaval
    var maes = enesimo(a, 5, 0, 2), pais = enesimo(a, 8, 0, 2), sexta = enesimo(a, 11, 5, 4);
    return [
      ['anonovo', dia(a, 1, 1), dia(a, 1, 6)],
      ['carnaval', somar(carnaval, -12), somar(carnaval, 1)],
      ['pascoa', somar(p, -7), p],
      ['maes', somar(maes, -7), maes],
      ['saojoao', dia(a, 6, 1), dia(a, 6, 30)],
      ['pais', somar(pais, -7), pais],
      ['patria', dia(a, 9, 1), dia(a, 9, 7)],
      ['criancas', dia(a, 10, 5), dia(a, 10, 12)],
      ['blackfriday', somar(sexta, -7), somar(sexta, 3)],
      ['natal', dia(a, 12, 1), dia(a, 12, 25)],
      ['anonovo', dia(a, 12, 26), dia(a, 12, 31)]
    ];
  }

  function soData(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  // Tema do dia (ou null). "agora" é a data do aparelho.
  function temaDoDia(agora) {
    var d = soData(agora || new Date()), lista = periodos(d.getFullYear());
    for (var i = 0; i < lista.length; i++) {
      if (d >= lista[i][1] && d <= lista[i][2]) return Object.assign({ id: lista[i][0], inicio: lista[i][1], fim: lista[i][2] }, TEMAS[lista[i][0]]);
    }
    return null;
  }
  // Próximos temas a partir de hoje (para o calendário da área do desenvolvedor)
  function proximos(agora, quantos) {
    var d = soData(agora || new Date()), lista = periodos(d.getFullYear()).concat(periodos(d.getFullYear() + 1));
    return lista.filter(function (x) { return x[2] >= d; }).slice(0, quantos || 12).map(function (x) {
      return Object.assign({ id: x[0], inicio: x[1], fim: x[2], ativo: d >= x[1] }, TEMAS[x[0]]);
    });
  }
  function porId(id) { return TEMAS[id] ? Object.assign({ id: id }, TEMAS[id]) : null; }

  return { TEMAS: TEMAS, temaDoDia: temaDoDia, proximos: proximos, porId: porId, pascoa: pascoa };
});
