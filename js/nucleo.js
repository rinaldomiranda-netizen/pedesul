/* Mini Delivery Aterrisse — regras comuns (sem tela).
   Usado pelo cardápio público, pelo painel, pelo modo demonstração e pelos testes (Node). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.AterrisseNucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FUSO = 'America/Maceio';
  var WHATSAPP_PADRAO = '5579988476641';

  // Usado só se o servidor não mandar horários (o painel é quem manda).
  var DESTAQUES_PADRAO = [
    { periodo: 'almoco', titulo: 'Almoço', inicio: '06:00', fim: '14:59', categorias: ['almoco'], ordem: 1 },
    { periodo: 'lanches', titulo: 'Lanches', inicio: '15:00', fim: '17:59', categorias: ['lanches', 'acompanhamentos', 'bebidas'], ordem: 2 },
    { periodo: 'jantar', titulo: 'Jantar nordestino', inicio: '18:00', fim: '05:59', categorias: ['jantar', 'lanches'], ordem: 3 }
  ];

  var STATUS_NOMES = {
    RECEBIDO: 'Recebido', ACEITO: 'Aceito', EM_PREPARACAO: 'Em preparação', PRONTO: 'Pronto',
    SAIU_PARA_ENTREGA: 'Saiu para entrega', ENTREGUE: 'Entregue', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado'
  };
  var MODALIDADE_NOMES = { entrega: 'Entrega', retirada: 'Retirada no balcão', local: 'Consumo na loja' };

  // ------------------------------------------------------------ formatação

  function reais(valor) {
    var n = Math.round(Number(valor || 0) * 100) / 100;
    return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function centavos(valor) { return Math.round(Number(valor || 0) * 100); }

  function dataHora(iso, fuso) {
    try {
      return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso || FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        .format(new Date(iso));
    } catch (e) { return String(iso || ''); }
  }

  function diaNoFuso(data, fuso) {
    var p = partesNoFuso(data, fuso);
    return p.ano + '-' + p.mes + '-' + p.dia;
  }

  // ------------------------------------------------------------ horário de destaque

  function partesNoFuso(data, fuso) {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: fuso || FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    var r = {};
    f.formatToParts(data).forEach(function (p) { r[p.type] = p.value; });
    return { ano: r.year, mes: r.month, dia: r.day, hora: Number(r.hour) % 24, minuto: Number(r.minute) };
  }

  function minutosNoFuso(data, fuso) {
    var p = partesNoFuso(data, fuso);
    return p.hora * 60 + p.minuto;
  }

  function paraMinutos(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  // O fim é inclusivo (14:59 inclui 14:59). Intervalo que cruza a meia-noite: 18:00–05:59.
  function dentroDoIntervalo(minutos, inicio, fim) {
    var i = paraMinutos(inicio), f = paraMinutos(fim);
    if (i === null || f === null) return false;
    if (i <= f) return minutos >= i && minutos <= f;
    return minutos >= i || minutos <= f;
  }

  function destaqueAtual(destaques, data, fuso) {
    var lista = (destaques && destaques.length ? destaques : DESTAQUES_PADRAO).slice()
      .filter(function (d) { return d.ativo !== false; })
      .sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    var min = minutosNoFuso(data || new Date(), fuso);
    for (var k = 0; k < lista.length; k++) {
      if (dentroDoIntervalo(min, lista[k].inicio, lista[k].fim)) return lista[k];
    }
    return null;
  }

  // Avisos para o painel: buracos e sobreposições no dia (verifica minuto a minuto).
  function conferirHorarios(destaques) {
    var ativos = (destaques || []).filter(function (d) { return d.ativo !== false; });
    var sem = 0, duplo = 0;
    for (var m = 0; m < 1440; m++) {
      var n = ativos.filter(function (d) { return dentroDoIntervalo(m, d.inicio, d.fim); }).length;
      if (n === 0) sem++;
      if (n > 1) duplo++;
    }
    var avisos = [];
    if (ativos.some(function (d) { return paraMinutos(d.inicio) === null || paraMinutos(d.fim) === null; })) avisos.push('Há horário em formato inválido (use HH:MM).');
    if (sem) avisos.push(sem + ' minuto(s) do dia ficam sem destaque (o cardápio aparece completo, sem destaque).');
    if (duplo) avisos.push(duplo + ' minuto(s) têm dois destaques ao mesmo tempo (vale o de menor ordem).');
    return avisos;
  }

  // ------------------------------------------------------------ produto / sacola

  function acharProduto(cardapio, id) {
    var ps = (cardapio && cardapio.produtos) || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i];
    return null;
  }

  function opcoesEscolhidas(produto, ids) {
    var r = [];
    (produto.grupos || []).forEach(function (g) {
      (g.opcoes || []).forEach(function (o) { if ((ids || []).indexOf(o.id) >= 0) r.push({ grupo: g.nome, grupo_id: g.id, id: o.id, nome: o.nome, preco: Number(o.preco || 0), disponivel: o.disponivel !== false }); });
    });
    return r;
  }

  function precoUnitario(produto, adicionais) {
    var c = centavos(produto.preco);
    opcoesEscolhidas(produto, adicionais).forEach(function (o) { c += centavos(o.preco); });
    return c / 100;
  }

  // Erros de uma escolha (mesmas regras do servidor). Lista vazia = ok.
  function validarEscolha(produto, escolha) {
    var erros = [];
    if (!produto) return ['Este produto não existe mais no cardápio.'];
    if (produto.disponivel === false) erros.push('"' + produto.nome + '" está esgotado.');
    var q = Number(escolha.quantidade);
    if (!(q >= 1 && q <= 50 && Math.floor(q) === q)) erros.push('Quantidade entre 1 e 50.');
    var ids = escolha.adicionais || [];
    var validas = opcoesEscolhidas(produto, ids);
    if (validas.length !== ids.length) erros.push('Opção inválida em "' + produto.nome + '".');
    validas.forEach(function (o) { if (!o.disponivel) erros.push('A opção "' + o.nome + '" acabou.'); });
    (produto.grupos || []).forEach(function (g) {
      var n = validas.filter(function (o) { return o.grupo_id === g.id; }).length;
      if (n < g.minimo || n > g.maximo) {
        erros.push(g.minimo === g.maximo
          ? g.nome + ': escolha ' + g.minimo + '.'
          : g.nome + ': escolha de ' + g.minimo + ' a ' + g.maximo + '.');
      }
    });
    var podeTirar = produto.ingredientes_removiveis || [];
    (escolha.removidos || []).forEach(function (r) { if (podeTirar.indexOf(r) < 0) erros.push('Não é possível retirar "' + r + '".'); });
    var obs = String(escolha.observacao || '');
    if (obs.length > 200) erros.push('Observação do item com no máximo 200 caracteres.');
    if (obs.trim() && produto.permite_observacao === false) erros.push('Este item não aceita observação.');
    return erros;
  }

  // Sacola: [{ chave, produto_id, quantidade, adicionais:[ids], removidos:[], observacao }]
  function totaisSacola(sacola, cardapio, modalidade) {
    var loja = (cardapio && cardapio.loja) || {};
    var sub = 0, itens = 0, problemas = [];
    (sacola || []).forEach(function (it) {
      var p = acharProduto(cardapio, it.produto_id);
      var erros = validarEscolha(p, it);
      if (erros.length) problemas.push({ chave: it.chave, erros: erros });
      if (p) sub += centavos(precoUnitario(p, it.adicionais)) * Number(it.quantidade || 0);
      itens += Number(it.quantidade || 0);
    });
    var taxa = modalidade === 'entrega' ? centavos(loja.taxa_entrega) : 0;
    return { subtotal: sub / 100, taxa_entrega: taxa / 100, total: (sub + taxa) / 100, itens: itens, problemas: problemas };
  }

  function chaveItem(it) {
    return [it.produto_id, (it.adicionais || []).slice().sort().join(','), (it.removidos || []).slice().sort().join(','), String(it.observacao || '').trim()].join('|');
  }

  // ------------------------------------------------------------ checkout

  function soDigitos(t) { return String(t || '').replace(/\D/g, ''); }

  function normalizarTelefone(t) {
    var d = soDigitos(t);
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d;
  }

  // Retorna { campo: 'mensagem' }. Vazio = ok.
  function validarCheckout(dados, loja) {
    loja = loja || {};
    var e = {};
    var nome = String(dados.nome || '').trim();
    if (nome.length < 2) e.nome = 'Informe seu nome.';
    else if (nome.length > 80) e.nome = 'Nome com no máximo 80 letras.';
    var mod = dados.modalidade;
    var aceitas = { entrega: loja.aceita_entrega !== false, retirada: loja.aceita_retirada !== false, local: loja.aceita_local !== false };
    if (!aceitas[mod]) e.modalidade = 'Escolha como quer receber o pedido.';
    var tel = soDigitos(dados.telefone);
    if (mod === 'entrega' || mod === 'retirada' || tel) {
      if (tel.length < 10 || tel.length > 13) e.telefone = 'Informe um telefone com DDD.';
    }
    if (mod === 'entrega') {
      var en = dados.endereco || {};
      if (String(en.rua || '').trim().length < 3) e.rua = 'Informe a rua.';
      if (!String(en.numero || '').trim()) e.numero = 'Informe o número (ou "s/n").';
      if (String(en.bairro || '').trim().length < 2) e.bairro = 'Informe o bairro.';
    }
    if (mod === 'local' && loja.mesa_modo === 'obrigatoria' && !String(dados.mesa || '').trim()) e.mesa = 'Informe a mesa ou o código do atendimento.';
    if (String(dados.mesa || '').length > 20) e.mesa = 'Mesa/código com no máximo 20 caracteres.';
    var pags = (loja.pagamentos || []).filter(function (p) { return p.ativo !== false; }).map(function (p) { return p.id; });
    if (pags.indexOf(dados.pagamento) < 0) e.pagamento = 'Escolha a forma de pagamento.';
    if (String(dados.observacoes || '').length > 500) e.observacoes = 'Observações com no máximo 500 caracteres.';
    return e;
  }

  function validarTroco(troco, total) {
    if (troco === '' || troco === null || troco === undefined) return null;
    var v = Number(String(troco).replace(/\./g, '').replace(',', '.'));
    if (!isFinite(v) || v < total) return 'O troco deve ser para um valor maior ou igual ao total (' + reais(total) + ').';
    return null;
  }

  // ------------------------------------------------------------ WhatsApp (canal extra, não substitui o pedido)

  function linkWhatsApp(numero, texto) {
    var n = soDigitos(numero) || WHATSAPP_PADRAO;
    return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  function textoResumoPedido(pedido, loja) {
    var l = [];
    l.push('Olá, ' + ((loja && loja.nome) || 'Restaurante Aterrisse') + '! Acabei de fazer o pedido nº ' + pedido.numero + ' pelo cardápio online.');
    (pedido.itens || []).forEach(function (i) {
      var extra = (i.adicionais || []).map(function (a) { return a.nome; });
      var linha = '• ' + i.quantidade + 'x ' + i.nome + (extra.length ? ' (' + extra.join(', ') + ')' : '');
      if (i.removidos && i.removidos.length) linha += ' — sem ' + i.removidos.join(', ');
      if (i.observacao) linha += ' — obs.: ' + i.observacao;
      l.push(linha);
    });
    l.push('Modalidade: ' + (MODALIDADE_NOMES[pedido.modalidade] || pedido.modalidade));
    l.push('Total: ' + reais(pedido.total));
    return l.join('\n');
  }

  // ------------------------------------------------------------ status (igual ao servidor)

  function transicaoValida(modalidade, de, para) {
    if (para === 'CANCELADO') return ['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(de) < 0;
    switch (de) {
      case 'RECEBIDO': return para === 'ACEITO';
      case 'ACEITO': return para === 'EM_PREPARACAO';
      case 'EM_PREPARACAO': return para === 'PRONTO';
      case 'PRONTO': return modalidade === 'entrega' ? para === 'SAIU_PARA_ENTREGA' : para === 'CONCLUIDO';
      case 'SAIU_PARA_ENTREGA': return para === 'ENTREGUE';
      default: return false;
    }
  }

  function proximosStatus(modalidade, de) {
    return Object.keys(STATUS_NOMES).filter(function (s) { return transicaoValida(modalidade, de, s); });
  }

  // Resumo do painel a partir de pedidos reais (sem inventar nada).
  function resumoPedidos(pedidos, dia, fuso) {
    var doDia = (pedidos || []).filter(function (p) { return diaNoFuso(new Date(p.criado_em), fuso) === dia; });
    var validos = doDia.filter(function (p) { return p.status !== 'CANCELADO'; });
    var porStatus = {};
    doDia.forEach(function (p) { porStatus[p.status] = (porStatus[p.status] || 0) + 1; });
    var vendas = validos.reduce(function (s, p) { return s + centavos(p.total); }, 0) / 100;
    return {
      pedidos: validos.length, novos: (pedidos || []).filter(function (p) { return p.status === 'RECEBIDO'; }).length,
      por_status: porStatus, vendas: vendas, ticket_medio: validos.length ? Math.round(vendas / validos.length * 100) / 100 : 0
    };
  }

  function relatorioPedidos(pedidos, inicio, fim, fuso) {
    var dentro = (pedidos || []).filter(function (p) { var d = diaNoFuso(new Date(p.criado_em), fuso); return d >= inicio && d <= fim; });
    var validos = dentro.filter(function (p) { return p.status !== 'CANCELADO'; });
    var dias = {}, prods = {};
    validos.forEach(function (p) {
      var d = diaNoFuso(new Date(p.criado_em), fuso);
      dias[d] = dias[d] || { dia: d, pedidos: 0, vendas: 0 };
      dias[d].pedidos++; dias[d].vendas = (centavos(dias[d].vendas) + centavos(p.total)) / 100;
      (p.itens || []).forEach(function (i) {
        prods[i.nome] = prods[i.nome] || { nome: i.nome, quantidade: 0, valor: 0 };
        prods[i.nome].quantidade += i.quantidade; prods[i.nome].valor = (centavos(prods[i.nome].valor) + centavos(i.total)) / 100;
      });
    });
    return {
      por_dia: Object.keys(dias).sort().map(function (k) { return dias[k]; }),
      pedidos: validos.length, cancelados: dentro.length - validos.length,
      vendas: validos.reduce(function (s, p) { return s + centavos(p.total); }, 0) / 100,
      mais_pedidos: Object.keys(prods).map(function (k) { return prods[k]; }).sort(function (a, b) { return b.quantidade - a.quantidade; }).slice(0, 10)
    };
  }

  // Endereço que só funciona neste computador ou nesta rede (para avisar no QR Code).
  function enderecoLocal(url) {
    try {
      var h = new URL(url).hostname;
      if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /\.localhost$/.test(h)) return 'computador';
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return 'rede';
      return null;
    } catch (e) { return 'invalido'; }
  }

  // ------------------------------------------------------------ prazo de cada pedido (contagem regressiva)

  // Verde com folga; amarelo nos últimos 10 min; vermelho quando passa do prazo.
  function prazoInfo(prazoIso, agoraMs) {
    if (!prazoIso) return null;
    var falta = new Date(prazoIso).getTime() - (agoraMs === undefined ? Date.now() : agoraMs);
    if (falta >= 0) {
      var seg = Math.floor(falta / 1000);
      var texto = Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2);
      return { texto: texto, classe: falta <= 10 * 60000 ? 'alerta' : 'ok', atrasado: false };
    }
    return { texto: 'ATRASADO há ' + Math.max(1, Math.floor(-falta / 60000)) + ' min', classe: 'atrasado', atrasado: true };
  }

  function horaCurta(iso, fuso) {
    try { return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso || FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
    catch (e) { return ''; }
  }

  // Link para abrir o endereço no Google Maps (só o endereço; sem rastreamento).
  function linkMapa(endereco) {
    if (!endereco) return '';
    var t = [endereco.rua, endereco.numero].filter(Boolean).join(', ') + (endereco.bairro ? ' - ' + endereco.bairro : '');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t);
  }

  // Mesmo endereço no Waze (do CONIS), já pedindo a rota.
  function linkWaze(endereco) {
    if (!endereco) return '';
    var t = [endereco.rua, endereco.numero].filter(Boolean).join(', ') + (endereco.bairro ? ' - ' + endereco.bairro : '') + ', Aracaju';
    return 'https://waze.com/ul?q=' + encodeURIComponent(t) + '&navigate=yes';
  }

  // ------------------------------------------------------------ Pix (QR Code estático, padrão BR Code do Banco Central)
  // Gera o "Pix copia e cola" para a chave do restaurante, já com o valor do pedido.
  // Não confirma pagamento: quem confere o recebimento é a equipe ou o entregador.

  function semAcentoMaiusculo(t, max) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, max);
  }
  function campoPix(id, valor) { return id + ('0' + valor.length).slice(-2) + valor; }
  function crc16(t) {
    var crc = 0xFFFF;
    for (var i = 0; i < t.length; i++) {
      crc ^= t.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return ('000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  // Chave telefone vira +55DDDNÚMERO; e-mail/CPF/CNPJ/aleatória ficam como estão.
  function chavePixNormalizada(chave) {
    var c = String(chave || '').trim();
    if (/^\+?[\d\s().-]{10,}$/.test(c) && c.indexOf('@') < 0) {
      var d = c.replace(/\D/g, '');
      if (d.length === 10 || d.length === 11) return '+55' + d;
      if ((d.length === 12 || d.length === 13) && d.slice(0, 2) === '55') return '+' + d;
    }
    return c;
  }
  function pixCopiaECola(o) {
    var conta = campoPix('00', 'br.gov.bcb.pix') + campoPix('01', chavePixNormalizada(o.chave));
    var txid = semAcentoMaiusculo(o.txid || '***', 25).replace(/ /g, '') || '***';
    var t = campoPix('00', '01') + campoPix('26', conta) + campoPix('52', '0000') + campoPix('53', '986') +
      (o.valor > 0 ? campoPix('54', Number(o.valor).toFixed(2)) : '') + campoPix('58', 'BR') +
      campoPix('59', semAcentoMaiusculo(o.nome, 25) || 'RECEBEDOR') + campoPix('60', semAcentoMaiusculo(o.cidade, 15) || 'BRASIL') +
      campoPix('62', campoPix('05', txid)) + '6304';
    return t + crc16(t);
  }

  // ------------------------------------------------------------ contas da equipe (usuário + senha, sem e-mail)
  // Mesmo domínio interno da função aterrisse-contas (supabase/functions/aterrisse-contas/regras.js).
  var DOMINIO_CONTAS = 'aterrisse.invalid';

  function normalizarUsuario(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '').trim();
  }
  // O que a pessoa digita na entrada: usuário (vira o e-mail interno) ou, para contas antigas, o próprio e-mail.
  function emailEntrada(texto) {
    var t = String(texto || '').trim();
    return t.indexOf('@') >= 0 ? t.toLowerCase() : normalizarUsuario(t) + '@' + DOMINIO_CONTAS;
  }
  function usuarioVisivel(email) {
    var e = String(email || '');
    return e.toLowerCase().slice(-(DOMINIO_CONTAS.length + 1)) === '@' + DOMINIO_CONTAS ? e.slice(0, e.length - DOMINIO_CONTAS.length - 1) : e;
  }

  function escaparHtml(t) {
    return String(t === null || t === undefined ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  return {
    FUSO: FUSO, WHATSAPP_PADRAO: WHATSAPP_PADRAO, DESTAQUES_PADRAO: DESTAQUES_PADRAO,
    STATUS_NOMES: STATUS_NOMES, MODALIDADE_NOMES: MODALIDADE_NOMES,
    reais: reais, dataHora: dataHora, diaNoFuso: diaNoFuso, minutosNoFuso: minutosNoFuso, paraMinutos: paraMinutos,
    dentroDoIntervalo: dentroDoIntervalo, destaqueAtual: destaqueAtual, conferirHorarios: conferirHorarios,
    acharProduto: acharProduto, opcoesEscolhidas: opcoesEscolhidas, precoUnitario: precoUnitario,
    validarEscolha: validarEscolha, totaisSacola: totaisSacola, chaveItem: chaveItem,
    soDigitos: soDigitos, normalizarTelefone: normalizarTelefone, validarCheckout: validarCheckout, validarTroco: validarTroco,
    linkWhatsApp: linkWhatsApp, textoResumoPedido: textoResumoPedido,
    transicaoValida: transicaoValida, proximosStatus: proximosStatus,
    resumoPedidos: resumoPedidos, relatorioPedidos: relatorioPedidos, enderecoLocal: enderecoLocal, escaparHtml: escaparHtml,
    prazoInfo: prazoInfo, horaCurta: horaCurta, linkMapa: linkMapa, linkWaze: linkWaze,
    pixCopiaECola: pixCopiaECola, chavePixNormalizada: chavePixNormalizada, crc16: crc16,
    DOMINIO_CONTAS: DOMINIO_CONTAS, normalizarUsuario: normalizarUsuario, emailEntrada: emailEntrada, usuarioVisivel: usuarioVisivel
  };
});
