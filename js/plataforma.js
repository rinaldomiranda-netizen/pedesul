/* Pede Sul — lista de lojas da plataforma (modo demonstração: guardada só neste navegador).
   Cada loja tem os seus próprios dados (cardápio, pedidos, caixa, mesas) separados das outras.
   Aqui ficam só os dados da plataforma: nome, código, ramo, cor, se aparece na vitrine, se está liberada e os recursos do plano.
   Quem muda isto é a área do desenvolvedor RMD (rmd.html). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.PedeSulPlataforma = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CHAVE = 'pedesul_plataforma_v1';

  // Recursos que cada loja pode ter (o plano liga ou desliga cada um).
  var RECURSOS = [
    ['entrega', 'Entrega'], ['retirada', 'Retirada no balcão'], ['local', 'Consumo na loja'],
    ['cozinha', 'Tela da cozinha'], ['entregadores', 'Entregadores'], ['oferta', 'Oferta automática ao entregador'],
    ['caixa', 'Caixa (abrir, fechar, vender no balcão)'], ['mesas', 'Mesas e garçom'], ['clientes', 'Cadastro de clientes'],
    ['post', 'Post do dia e cardápio do dia'], ['qrcode', 'QR Code'], ['relatorios', 'Relatórios']
  ];
  function todosLigados() { var r = {}; RECURSOS.forEach(function (x) { r[x[0]] = true; }); return r; }

  function lojasIniciais() {
    var agora = new Date().toISOString();
    return [
      { slug: 'aterrisse', nome: 'Aterrisse Restaurante', segmento: 'Quentinha e lanches', icone: '🍛', cor: '#0e7c86',
        vitrine: true, liberada: true, motivo: '', plano: 'completo', modo: 'demo', recursos: todosLigados(), criada_em: agora },
      { slug: 'conis-burger', nome: 'Conis Burger', segmento: 'Hambúrguer artesanal', icone: '🍔', cor: '#f2552c',
        vitrine: true, liberada: true, motivo: '', plano: 'completo', modo: 'demo', recursos: todosLigados(), criada_em: agora },
      { slug: 'ohane', nome: 'Ohane Delicatessen', segmento: 'Doces, salgados e cafés', icone: '🥐', cor: '#8a5cc2',
        vitrine: true, liberada: true, motivo: '', plano: 'completo', modo: 'demo', recursos: todosLigados(), criada_em: agora }
    ];
  }

  function armazem() { return typeof localStorage !== 'undefined' ? localStorage : null; }
  function ler() {
    var a = armazem(), d = null;
    try { d = a ? JSON.parse(a.getItem(CHAVE)) : null; } catch (e) { d = null; }
    if (!d || !Array.isArray(d.lojas)) { d = { lojas: lojasIniciais() }; gravar(d); }
    d.lojas.forEach(function (l) { l.recursos = Object.assign(todosLigados(), l.recursos || {}); });
    return d;
  }
  function gravar(d) { var a = armazem(); try { if (a) a.setItem(CHAVE, JSON.stringify(d)); } catch (e) { /* sem armazenamento */ } }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  function listar() { return copia(ler().lojas); }
  function obter(slug) { return copia(ler().lojas.filter(function (l) { return l.slug === slug; })[0] || null); }

  // Só as lojas liberadas que escolheram aparecer na vitrine (as "individuais" ficam de fora).
  function daVitrine() { return listar().filter(function (l) { return l.vitrine && l.liberada; }); }

  function slugDe(nome) {
    return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }

  var CAMPOS = ['nome', 'segmento', 'icone', 'cor', 'vitrine', 'liberada', 'motivo', 'plano', 'modo', 'recursos'];
  function salvar(slug, campos) {
    var d = ler(), l = d.lojas.filter(function (x) { return x.slug === slug; })[0];
    if (!l) throw new Error('Loja não encontrada.');
    CAMPOS.forEach(function (c) { if (campos[c] !== undefined) l[c] = campos[c]; });
    l.atualizado_em = new Date().toISOString();
    gravar(d);
    return copia(l);
  }

  function criar(dados) {
    var d = ler();
    var nome = String(dados.nome || '').trim();
    if (nome.length < 2) throw new Error('Informe o nome da loja.');
    var slug = slugDe(dados.slug || nome);
    if (slug.length < 2) throw new Error('Código da loja inválido.');
    if (d.lojas.some(function (l) { return l.slug === slug; })) throw new Error('Já existe uma loja com o código "' + slug + '".');
    var l = { slug: slug, nome: nome, segmento: String(dados.segmento || '').trim(), icone: dados.icone || '🍽️', cor: dados.cor || '#f2552c',
      vitrine: dados.vitrine !== false, liberada: true, motivo: '', plano: dados.plano || 'completo', modo: 'demo',
      recursos: Object.assign(todosLigados(), dados.recursos || {}), criada_em: new Date().toISOString() };
    d.lojas.push(l);
    gravar(d);
    return copia(l);
  }

  // ---- propagandas da faixa da vitrine (modo demonstração: guardadas neste navegador)
  var CHAVE_ANUNCIOS = 'pedesul_anuncios_v1';
  var TIPOS_ANUNCIO = { loja: 'Loja do Pede Sul', promocao: 'Promoção', destaque: 'Destaque', patrocinador: 'Patrocinador' };
  function anunciosIniciais() {
    return [
      { id: 'an-1', tipo: 'destaque', titulo: 'Pede Sul chegou!', texto: 'O sabor da Zona Sul na sua porta.', ordem: 0, ativo: true },
      { id: 'an-2', tipo: 'promocao', titulo: 'Combo Conis em dobro', texto: 'Na terça, o segundo combo sai pela metade.', loja: 'conis-burger', ordem: 1, ativo: true },
      { id: 'an-3', tipo: 'loja', titulo: 'Quentinha do Aterrisse', texto: 'Almoço caseiro todo dia na Zona Sul.', loja: 'aterrisse', ordem: 2, ativo: true },
      { id: 'an-4', tipo: 'patrocinador', titulo: 'Seu anúncio aqui', texto: 'Anuncie para quem pede comida na Zona Sul.', anunciante: 'RMD Delivery', link: 'https://wa.me/5579988653766', cor: '#0f2a3d', ordem: 3, ativo: true }
    ];
  }
  function anuncios() {
    var a = armazem(), d = null;
    try { d = a ? JSON.parse(a.getItem(CHAVE_ANUNCIOS)) : null; } catch (e) { d = null; }
    if (!Array.isArray(d)) { d = anunciosIniciais(); try { if (a) a.setItem(CHAVE_ANUNCIOS, JSON.stringify(d)); } catch (e) { /* sem armazenamento */ } }
    return copia(d).sort(function (x, y) { return (x.ordem || 0) - (y.ordem || 0); });
  }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  // As que estão no ar hoje: ligadas, dentro das datas, e a loja liberada (propaganda de loja só se ela estiver na vitrine).
  function anunciosNoAr() {
    var h = hoje();
    return anuncios().filter(function (x) {
      if (x.ativo === false || (x.inicio && x.inicio > h) || (x.fim && x.fim < h)) return false;
      if (!x.loja) return true;
      var l = obter(x.loja);
      if (!l || !l.liberada || (x.tipo === 'loja' && !l.vitrine)) return false;
      if (!x.cor) x.cor = l.cor;
      return true;
    });
  }
  function conferirAnuncio(x) {
    if (!TIPOS_ANUNCIO[x.tipo]) throw new Error('Escolha o tipo da propaganda.');
    if (String(x.titulo || '').trim().length < 2) throw new Error('Informe o título.');
    if (x.tipo === 'patrocinador' && String(x.anunciante || '').trim().length < 2) throw new Error('Informe o nome do patrocinador.');
    if (x.link && !/^https:\/\//.test(x.link)) throw new Error('O link deve começar com https://');
    if (x.tipo !== 'destaque' && !x.loja && !x.link) throw new Error('Escolha a loja ou informe o link do patrocinador.');
    if (x.inicio && x.fim && x.fim < x.inicio) throw new Error('A data final é antes da inicial.');
  }
  function salvarAnuncio(x) {
    conferirAnuncio(x);
    var lista = anuncios(), i = lista.map(function (y) { return y.id; }).indexOf(x.id);
    if (!x.id || i < 0) { x.id = 'an-' + Date.now().toString(36); lista.push(x); } else lista[i] = x;
    try { armazem().setItem(CHAVE_ANUNCIOS, JSON.stringify(lista)); } catch (e) { /* sem armazenamento */ }
    return x.id;
  }
  function apagarAnuncio(id) {
    var lista = anuncios().filter(function (y) { return y.id !== id; });
    try { armazem().setItem(CHAVE_ANUNCIOS, JSON.stringify(lista)); } catch (e) { /* sem armazenamento */ }
  }

  return { TIPOS_ANUNCIO: TIPOS_ANUNCIO, anuncios: anuncios, anunciosNoAr: anunciosNoAr, salvarAnuncio: salvarAnuncio, apagarAnuncio: apagarAnuncio, conferirAnuncio: conferirAnuncio,
    RECURSOS: RECURSOS, listar: listar, obter: obter, daVitrine: daVitrine, salvar: salvar, criar: criar, slugDe: slugDe, todosLigados: todosLigados };
});
