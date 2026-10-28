/* Pede Sul — acesso aos dados (copiado do Aterrisse e ampliado para várias lojas).
   Dois jeitos, com as mesmas funções:
   - BackendSupabase: o banco com várias lojas (supabase/001_pedesul.sql), com login de verdade por loja.
     Testado neste computador com o servidor de teste (tests/local); ainda NÃO está na nuvem.
   - BackendDemo: MODO DEMONSTRAÇÃO, guarda tudo só neste navegador (localStorage), uma gaveta por loja.
     Usa as mesmas regras do servidor, mas NÃO é o servidor: nada sai deste aparelho.
   Do CONIS vieram: caixa (abrir, fechar, vender no balcão), mesas e garçom, cadastro de clientes pelo telefone,
   oferta da entrega ao entregador (aceitar / recusar / passa ao próximo) e ocorrências de entrega. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./dados-demo.js'), require('./plataforma.js'));
  else raiz.AterrisseBackend = fabrica(raiz.AterrisseNucleo, raiz.AterrisseDadosDemo, raiz.PedeSulPlataforma);
})(typeof self !== 'undefined' ? self : this, function (N, DadosDemo, Plataforma) {
  'use strict';

  function Erro(mensagem, codigo) {
    var e = new Error(mensagem);
    e.codigo = codigo || 'ERRO';
    return e;
  }

  function guardar(armazem, chave, valor) {
    try { if (valor === null) armazem.removeItem(chave); else armazem.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento */ }
  }
  function ler(armazem, chave) {
    try { var t = armazem.getItem(chave); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }

  // ================================================================ Supabase (banco com várias lojas)

  var CAMPOS_PRODUTO = ['categoria_id', 'nome', 'descricao', 'preco', 'icone', 'imagem_url', 'imagem_ilustrativa', 'disponivel',
    'ativo', 'destaque', 'demonstracao', 'ingredientes_removiveis', 'permite_observacao', 'ordem'];
  var CAMPOS_CATEGORIA = ['slug', 'nome', 'descricao', 'icone', 'ordem', 'ativa'];
  var CAMPOS_LOJA = ['nome', 'logo_url', 'whatsapp', 'aberto', 'aviso', 'horario_funcionamento', 'aceita_entrega', 'aceita_retirada',
    'aceita_local', 'taxa_entrega', 'pedido_minimo', 'mesa_modo', 'previsao_retirada_min', 'previsao_entrega_min', 'previsao_local_min', 'pix_chave', 'pix_nome', 'pix_cidade',
    'pagamentos', 'url_publica', 'cor', 'mesas_qtd'];
  var DOMINIO_CONTAS = 'pedesul.invalid';

  function escolher(obj, campos) {
    var r = {};
    campos.forEach(function (c) { if (obj[c] !== undefined) r[c] = obj[c]; });
    return r;
  }

  // Tudo passa por funções do banco (supabase/001_pedesul.sql): o navegador não lê nem grava tabela nenhuma.
  // Cada chamada leva o código da loja da página; o banco confere que a conta logada é daquela loja.
  // A conta é por loja: o usuário "joao" do Conis vira joao@conis-burger.pedesul.invalid (a pessoa nunca vê esse e-mail).
  function BackendSupabase(cfg, armazem) {
    this.modo = 'supabase';
    this.vitrine = false;
    this.loja = cfg.LOJA || 'aterrisse';
    this.url = String(cfg.PEDESUL_URL || cfg.SUPABASE_URL || '').replace(/\/$/, '');
    this.chave = cfg.PEDESUL_CHAVE || cfg.SUPABASE_CHAVE_PUBLICA;
    this.armazem = armazem || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.chaveSessao = 'pedesul_conta_' + this.loja;
  }

  BackendSupabase.prototype._sessao = function () { return this.armazem ? ler(this.armazem, this.chaveSessao) : null; };

  BackendSupabase.prototype._token = async function () {
    var s = this._sessao();
    if (!s) return null;
    if (s.expira_em - Date.now() < 60000) {
      try { s = this._salvarSessao(await this._auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token })); }
      catch (e) { guardar(this.armazem, this.chaveSessao, null); return null; }
    }
    return s.access_token;
  };

  BackendSupabase.prototype._salvarSessao = function (r) {
    var email = r.user && r.user.email;
    var s = { access_token: r.access_token, refresh_token: r.refresh_token, expira_em: Date.now() + (r.expires_in || 3600) * 1000,
      email: email, usuario: usuarioDoEmail(email), user_id: r.user && r.user.id };
    guardar(this.armazem, this.chaveSessao, s);
    return s;
  };

  function usuarioDoEmail(email) {
    var e = String(email || ''), i = e.indexOf('@');
    return i > 0 && /\.pedesul\.invalid$/.test(e) ? e.slice(0, i) : e;
  }
  // O que a pessoa digita: usuário (vira o e-mail interno DESTA loja) ou um e-mail (conta da RMD, por exemplo).
  BackendSupabase.prototype._emailDe = function (usuario) {
    var t = String(usuario || '').trim();
    return t.indexOf('@') >= 0 ? t.toLowerCase() : N.normalizarUsuario(t) + '@' + this.loja + '.' + DOMINIO_CONTAS;
  };

  BackendSupabase.prototype._auth = async function (caminho, corpo, token) {
    var resp;
    try {
      resp = await fetch(this.url + '/auth/v1/' + caminho, {
        method: 'POST', headers: { apikey: this.chave, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || this.chave) },
        body: JSON.stringify(corpo || {})
      });
    } catch (e) { throw Erro('Sem conexão com o servidor. Verifique a internet.', 'REDE'); }
    var j = await resp.json().catch(function () { return {}; });
    if (!resp.ok) {
      var msg = j.error_description || j.msg || j.message || 'Falha na entrada.';
      if (/invalid login|invalid_grant|credentials/i.test(msg)) msg = 'Usuário ou senha incorretos.';
      throw Erro(msg, 'AUTH');
    }
    return j;
  };

  BackendSupabase.prototype._rpc = async function (nome, args) {
    var token = (await this._token()) || this.chave;
    var resp;
    try {
      resp = await fetch(this.url + '/rest/v1/rpc/' + nome, {
        method: 'POST', headers: { apikey: this.chave, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {})
      });
    } catch (e) { throw Erro('Sem conexão com o servidor. Verifique a internet e tente de novo.', 'REDE'); }
    if (resp.status === 204) return null;
    var j = await resp.json().catch(function () { return null; });
    if (!resp.ok) {
      j = j || {};
      if (resp.status === 401 && /JWT|expired/i.test(j.message || '')) guardar(this.armazem, this.chaveSessao, null);
      if (resp.status >= 500 && nome !== 'pedesul_registrar_erro') this.registrarErro('servidor', 'Erro ' + resp.status + ' em ' + nome, j.message || '').catch(function () {});
      var codigo = j.message || 'ERRO';
      var msg = j.hint || (/permission denied|row-level|JWT/i.test(j.message || '') ? 'Sem permissão para isso. Entre de novo.' : j.message) || 'Erro no servidor.';
      throw Erro(msg, /permission denied/i.test(codigo) ? 'SEM_PERMISSAO' : codigo);
    }
    return j;
  };
  BackendSupabase.prototype._daLoja = function (nome, args) {
    var a = args || {};
    a.p_loja = this.loja;
    return this._rpc(nome, a);
  };

  // ---- público
  BackendSupabase.prototype.cardapio = function () { return this._daLoja('pedesul_cardapio'); };
  BackendSupabase.prototype.criarPedido = function (dados) { return this._daLoja('pedesul_criar_pedido', { dados: dados }); };
  BackendSupabase.prototype.acompanhar = function (numero, codigo) { return this._daLoja('pedesul_acompanhar', { p_numero: Number(numero), p_codigo: String(codigo) }); };
  BackendSupabase.prototype.lojasDaVitrine = function () { return this._rpc('pedesul_vitrine'); };
  BackendSupabase.prototype.anuncios = function () { return this._rpc('pedesul_anuncios'); };
  BackendSupabase.prototype.produtosDaVitrine = function () { return this._rpc('pedesul_vitrine_produtos'); };
  BackendSupabase.prototype.recomecarVitrine = function () { return Promise.resolve(); };

  // ---- conta (usuário + senha; quem cria os acessos é o dono da loja ou a RMD)
  BackendSupabase.prototype.entrar = async function (usuario, senha) {
    return this._salvarSessao(await this._auth('token?grant_type=password', { email: this._emailDe(usuario), password: senha }));
  };
  BackendSupabase.prototype.criarConta = async function () { throw Erro('O acesso é criado pelo dono da loja (Painel → Equipe).', 'SEM_CADASTRO'); };
  BackendSupabase.prototype.sair = async function () {
    var s = this._sessao();
    guardar(this.armazem, this.chaveSessao, null);
    if (s) { try { await this._auth('logout', {}, s.access_token); } catch (e) { /* já saiu neste aparelho */ } }
  };
  BackendSupabase.prototype.sessao = function () { return this._sessao(); };
  // trocarSenhaPendente: a loja já vende de verdade e a pessoa ainda está com a senha provisória (ex.: 1234)
  BackendSupabase.prototype.papel = async function () {
    var r = await this._daLoja('pedesul_eu');
    this.trocarSenhaPendente = !!(r && r.trocar_senha);
    return r ? r.papel : null;
  };
  BackendSupabase.prototype.criarMinhaSenha = function (senha) { return this._funcao('pedesul-contas', { acao: 'minha_senha', loja: this.loja, senha: senha }); };

  // ---- pedidos
  BackendSupabase.prototype.listarPedidos = function (dias) { return this._daLoja('pedesul_pedidos', { p_dias: dias || 2 }); };
  BackendSupabase.prototype.mudarStatus = function (id, para, motivo) { return this._daLoja('pedesul_mudar_status', { p_pedido: id, p_para: para, p_motivo: motivo || null }); };
  BackendSupabase.prototype.atribuirEntregador = function (id, entregador) { return this._daLoja('pedesul_atribuir_entregador', { p_pedido: id, p_entregador: entregador || null }); };
  BackendSupabase.prototype.confirmarPagamento = function (id, forma) { return this._daLoja('pedesul_confirmar_pagamento', { p_pedido: id, p_forma: forma || null }); };
  BackendSupabase.prototype.filaCozinha = function () { return this._daLoja('pedesul_fila_cozinha'); };
  BackendSupabase.prototype.relatorio = function (inicio, fim) { return this._daLoja('pedesul_relatorio', { p_inicio: inicio, p_fim: fim }); };
  BackendSupabase.prototype.registrarOcorrencia = function (id, tipo, texto) { return this._daLoja('pedesul_registrar_ocorrencia', { p_pedido: id, p_tipo: tipo, p_texto: texto || null }); };
  BackendSupabase.prototype.resolverOcorrencia = function (id, indice) { return this._daLoja('pedesul_resolver_ocorrencia', { p_pedido: id, p_indice: indice }); };
  BackendSupabase.prototype.oferecerEntrega = function (id) { return this._daLoja('pedesul_oferecer_entrega', { p_pedido: id }); };

  // ---- cardápio e loja
  BackendSupabase.prototype.cardapioCompleto = function () { return this._daLoja('pedesul_cardapio_completo'); };
  BackendSupabase.prototype.salvarLoja = function (loja) { return this._daLoja('pedesul_salvar_loja', { d: escolher(loja, CAMPOS_LOJA) }); };
  BackendSupabase.prototype.salvarDestaques = function (lista) { return this._daLoja('pedesul_salvar_destaques', { lista: lista }); };
  BackendSupabase.prototype.salvarCategoria = function (c) { var d = escolher(c, CAMPOS_CATEGORIA); d.id = c.id || null; return this._daLoja('pedesul_salvar_categoria', { c: d }); };
  BackendSupabase.prototype.apagarCategoria = function (id) { return this._daLoja('pedesul_apagar_categoria', { p_id: id }); };
  BackendSupabase.prototype.salvarProduto = function (p) { var d = escolher(p, CAMPOS_PRODUTO); d.id = p.id || null; d.grupos = p.grupos || []; return this._daLoja('pedesul_salvar_produto', { p: d }); };
  BackendSupabase.prototype.alterarProduto = function (id, campos) { return this._daLoja('pedesul_alterar_produto', { p_id: id, campos: campos }); };
  BackendSupabase.prototype.alterarOpcao = function (id, disponivel) { return this._daLoja('pedesul_alterar_opcao', { p_id: id, p_disponivel: !!disponivel }); };
  BackendSupabase.prototype.apagarProduto = function (id) { return this._daLoja('pedesul_apagar_produto', { p_id: id }); };

  // ---- equipe e entregadores
  BackendSupabase.prototype.listarEquipe = function () { return this._daLoja('pedesul_equipe_listar'); };
  BackendSupabase.prototype.adicionarEquipe = async function () { throw Erro('Use "Criar acesso" (usuário e senha).', 'USE_CRIAR_ACESSO'); };
  BackendSupabase.prototype.alterarEquipe = function (userId, campos) { return this._daLoja('pedesul_equipe_alterar', { p_user: userId, campos: escolher(campos, ['nome', 'papel', 'ativo']) }); };
  BackendSupabase.prototype.listarEntregadores = async function () {
    return (await this._daLoja('pedesul_entregadores_listar')).map(function (e) { e.user_id = e.tem_login ? 'login' : null; return e; });
  };
  BackendSupabase.prototype.salvarEntregador = function (e) { return this._daLoja('pedesul_salvar_entregador', { d: escolher(e, ['id', 'nome', 'telefone', 'ativo']) }); };

  // contas da equipe: criadas no servidor (função pedesul-contas, com a chave de serviço que o navegador nunca vê)
  BackendSupabase.prototype._funcao = async function (nome, corpo) {
    var token = await this._token();
    if (!token) throw Erro('Entre de novo.', 'SEM_LOGIN');
    var resp;
    try {
      resp = await fetch(this.url + '/functions/v1/' + nome, {
        method: 'POST', headers: { apikey: this.chave, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
      });
    } catch (e) { throw Erro('Sem conexão com o servidor. Verifique a internet e tente de novo.', 'REDE'); }
    var j = await resp.json().catch(function () { return {}; });
    if (!resp.ok) throw Erro(j.mensagem || j.message || 'Erro no servidor.', j.codigo || 'ERRO');
    return j;
  };
  BackendSupabase.prototype.criarAcesso = function (d) {
    return this._funcao('pedesul-contas', { acao: 'criar', loja: d.loja || this.loja, nome: d.nome, usuario: d.usuario, senha: d.senha, papel: d.papel });
  };
  BackendSupabase.prototype.trocarSenha = function (userId, senha, loja) {
    return this._funcao('pedesul-contas', { acao: 'senha', loja: loja || this.loja, user_id: userId, senha: senha });
  };

  // ---- tela do entregador: só as entregas e ofertas da própria conta (o banco ignora qualquer outro entregador)
  BackendSupabase.prototype.entregadorEu = function () { return this._daLoja('pedesul_entregador_eu'); };
  BackendSupabase.prototype.entregadoresDaLoja = async function () { return [await this.entregadorEu()]; };
  BackendSupabase.prototype.definirOnline = function (_eu, online) { return this._daLoja('pedesul_definir_online', { p_online: !!online }); };
  BackendSupabase.prototype.ofertasPara = function () { return this._daLoja('pedesul_minhas_ofertas'); };
  BackendSupabase.prototype.responderOferta = function (id, _eu, aceitar) { return this._daLoja('pedesul_responder_oferta', { p_pedido: id, p_aceitar: !!aceitar }); };
  BackendSupabase.prototype.minhasEntregas = function () { return this._daLoja('pedesul_minhas_entregas'); };
  BackendSupabase.prototype.entregadorStatus = function (id, _eu, para) { return this._daLoja('pedesul_entregador_status', { p_pedido: id, p_para: para }); };
  BackendSupabase.prototype.entregadorPagamento = function (id, _eu, forma) { return this._daLoja('pedesul_entregador_pagamento', { p_pedido: id, p_forma: forma }); };
  BackendSupabase.prototype.entregadorOcorrencia = function (id, _eu, tipo, texto) { return this._daLoja('pedesul_entregador_ocorrencia', { p_pedido: id, p_tipo: tipo, p_texto: texto || null }); };

  // ---- do CONIS: balcão, mesas, caixa e clientes
  BackendSupabase.prototype.venderBalcao = function (dados) { return this._daLoja('pedesul_vender_balcao', { dados: dados }); };
  BackendSupabase.prototype.mesas = function () { return this._daLoja('pedesul_mesas'); };
  BackendSupabase.prototype.lancarMesa = function (mesa, itens, garcom, obs) { return this._daLoja('pedesul_lancar_mesa', { p_mesa: Number(mesa), p_itens: itens, p_garcom: garcom || null, p_observacoes: obs || null }); };
  BackendSupabase.prototype.fecharMesa = function (mesa, forma) { return this._daLoja('pedesul_fechar_mesa', { p_mesa: Number(mesa), p_forma: forma || 'dinheiro' }); };
  BackendSupabase.prototype.caixa = function () { return this._daLoja('pedesul_caixa'); };
  BackendSupabase.prototype.abrirCaixa = function (valor) { return this._daLoja('pedesul_abrir_caixa', { p_valor: Number(valor) }); };
  BackendSupabase.prototype.movimentoCaixa = function (tipo, valor, motivo) { return this._daLoja('pedesul_movimento_caixa', { p_tipo: tipo, p_valor: Number(valor), p_motivo: motivo }); };
  BackendSupabase.prototype.fecharCaixa = function (contado) { return this._daLoja('pedesul_fechar_caixa', { p_contado: Number(contado) }); };
  BackendSupabase.prototype.clientes = function () { return this._daLoja('pedesul_clientes'); };

  // ---- erros técnicos e área do desenvolvedor RMD (sem vendas nem clientes)
  BackendSupabase.prototype.registrarErro = function (pagina, mensagem, detalhe) {
    return this._rpc('pedesul_registrar_erro', { p_loja: this.loja === 'rmd' ? null : this.loja, p_pagina: pagina, p_mensagem: mensagem, p_detalhe: detalhe || null });
  };
  BackendSupabase.prototype.souRmd = function () { return this._rpc('pedesul_sou_rmd'); };
  BackendSupabase.prototype.rmdLojas = function () { return this._rpc('pedesul_rmd_lojas'); };
  BackendSupabase.prototype.rmdSalvarLoja = function (slug, campos) { return this._rpc('pedesul_rmd_salvar_loja', { p_slug: slug, d: campos }); };
  BackendSupabase.prototype.rmdCriarLoja = function (d) { return this._rpc('pedesul_rmd_criar_loja', { d: d }); };
  BackendSupabase.prototype.rmdEquipe = function (slug) { return this._rpc('pedesul_rmd_equipe', { p_slug: slug }); };
  BackendSupabase.prototype.rmdAnuncios = function () { return this._rpc('pedesul_rmd_anuncios'); };
  BackendSupabase.prototype.rmdSalvarAnuncio = function (d) { return this._rpc('pedesul_rmd_salvar_anuncio', { d: d }); };
  BackendSupabase.prototype.rmdApagarAnuncio = function (id) { return this._rpc('pedesul_rmd_apagar_anuncio', { p_id: id }); };
  BackendSupabase.prototype.rmdErros = function (todos) { return this._rpc('pedesul_rmd_erros', { p_todos: !!todos }); };
  BackendSupabase.prototype.rmdErroResolvido = function (id, resolvido) { return this._rpc('pedesul_rmd_erro_resolvido', { p_id: id, p_resolvido: resolvido }); };

  // ================================================================ Demonstração (só no navegador)

  // Uma gaveta por loja: pedesul_loja_<código> (ou pedesul_vitrine_<código> na demonstração para o cliente).
  // opcoes.vitrine = demonstração para apresentar ao cliente: guarda separada, entra sem senha
  // e já vem com pedidos de exemplo (prazos, entregadores, status variados). Nada vai ao servidor.
  function BackendDemo(armazem, sessaoArmazem, opcoes) {
    opcoes = opcoes || {};
    this.modo = 'demo';
    this.vitrine = !!opcoes.vitrine;
    this.loja = opcoes.loja || 'aterrisse';
    this.chave = (this.vitrine ? 'pedesul_vitrine_' : 'pedesul_loja_') + this.loja;
    this.chaveSessao = 'pedesul_sessao_' + this.loja;
    this.armazem = armazem || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.sessaoArmazem = sessaoArmazem || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  }

  // Dados da loja na plataforma (liberada, recursos do plano, vitrine). Sem a plataforma (testes), tudo ligado.
  BackendDemo.prototype._naPlataforma = function () {
    var l = Plataforma && Plataforma.obter ? Plataforma.obter(this.loja) : null;
    return l || { slug: this.loja, nome: null, liberada: true, vitrine: true, modo: 'demo', recursos: Plataforma && Plataforma.todosLigados ? Plataforma.todosLigados() : {} };
  };

  // Função fora do plano da loja: recusa aqui também (não basta esconder o botão).
  var NOMES_RECURSO = { caixa: 'Caixa', mesas: 'Mesas e garçom', clientes: 'Cadastro de clientes', entregadores: 'Entregadores', oferta: 'Oferta automática ao entregador', cozinha: 'Tela da cozinha', relatorios: 'Relatórios' };
  BackendDemo.prototype._exigirRecurso = function (nome) {
    if ((this._naPlataforma().recursos || {})[nome] === false) throw Erro('O plano desta loja não tem: ' + (NOMES_RECURSO[nome] || nome) + '. Fale com a RMD.', 'RECURSO_DESLIGADO');
  };
  BackendDemo.prototype._exigirLiberada = function () {
    if (this._naPlataforma().liberada === false) throw Erro('Esta loja está suspensa. Fale com a RMD.', 'LOJA_SUSPENSA');
  };

  BackendDemo.prototype._estado = function () {
    var e = this.armazem ? ler(this.armazem, this.chave) : null;
    if (!e || !e.produtos) {
      var pl = this._naPlataforma();
      e = DadosDemo.criar(this.loja, pl.nome);
      e.pedidos = []; e.entregadores = []; e.proximoNumero = 1; e.senhaHash = null; e.auditoria = [];
      e.caixa = { aberto: false, movimentos: [], fechamentos: [] };
      if (this.vitrine) semearVitrine(e, Date.now(), this.loja);
      this._gravar(e);
    }
    if (!e.caixa) e.caixa = { aberto: false, movimentos: [], fechamentos: [] };
    if (!e.loja.mesas_qtd) e.loja.mesas_qtd = 10;
    return e;
  };
  BackendDemo.prototype._gravar = function (e) { if (this.armazem) guardar(this.armazem, this.chave, e); };
  BackendDemo.prototype._exigirLogin = function () {
    if (this.vitrine) return;
    if (!(this.sessaoArmazem && ler(this.sessaoArmazem, this.chaveSessao))) throw Erro('Entre no painel primeiro.', 'SEM_PERMISSAO');
  };
  // Recomeça a vitrine com pedidos de exemplo novos (prazos contando a partir de agora).
  BackendDemo.prototype.recomecarVitrine = function () { if (this.armazem) guardar(this.armazem, this.chave, null); return this._estado(); };

  // ---- pedidos de exemplo da vitrine
  function itemAmostra(e, nomeProduto, qtd, extras) {
    var p = typeof nomeProduto === 'number' ? e.produtos[nomeProduto % e.produtos.length] : e.produtos.filter(function (x) { return x.nome === nomeProduto; })[0];
    var ads = [];
    (p.grupos || []).forEach(function (g) {
      if (g.minimo > 0) ads.push({ grupo: g.nome, nome: g.opcoes[0].nome, preco: g.opcoes[0].preco });
      (extras || []).forEach(function (nome) {
        g.opcoes.forEach(function (o) { if (o.nome === nome) ads.push({ grupo: g.nome, nome: o.nome, preco: o.preco }); });
      });
    });
    var unit = Math.round((p.preco + ads.reduce(function (s, a) { return s + a.preco; }, 0)) * 100) / 100;
    return { produto_id: p.id, nome: p.nome, preco_unitario: unit, quantidade: qtd, adicionais: ads, removidos: [], observacao: null, total: unit * qtd };
  }

  function semearVitrine(e, agora, loja) {
    var min = function (m) { return new Date(agora + m * 60000).toISOString(); };
    e.entregadores = [
      { id: 'ent-carlos', nome: 'Carlos Moto', telefone: '79999990001', ativo: true, online: true },
      { id: 'ent-bruno', nome: 'Bruno Silva', telefone: '79999990002', ativo: true, online: true }
    ];
    var ORDEM = ['RECEBIDO', 'ACEITO', 'EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'];
    var ORDEM_LOJA = ['RECEBIDO', 'ACEITO', 'EM_PREPARACAO', 'PRONTO', 'CONCLUIDO'];
    function pedido(numero, criadoMin, prazoMin, modalidade, status, nome, itens, extra) {
      extra = extra || {};
      var sub = itens.reduce(function (s, i) { return s + i.total; }, 0);
      var seq = modalidade === 'entrega' ? ORDEM : ORDEM_LOJA;
      var ate = status === 'CANCELADO' ? 1 : seq.indexOf(status) + 1;
      var hist = seq.slice(0, ate).map(function (s, k) { return { de: k ? seq[k - 1] : null, para: s, em: min(criadoMin + k * 4) }; });
      if (status === 'CANCELADO') hist.push({ de: 'RECEBIDO', para: 'CANCELADO', motivo: 'Cliente desistiu', em: min(criadoMin + 3) });
      var final = ['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(status) >= 0;
      var p = {
        id: 'amostra-' + numero, numero: numero, acompanhamento: 'amostra-' + numero, nome: nome, telefone: extra.telefone || null,
        modalidade: modalidade, endereco: extra.endereco || null, mesa: extra.mesa || null, observacoes: extra.observacoes || null,
        pagamento: extra.pagamento || 'pix', troco_para: extra.troco_para || null, subtotal: sub, taxa_entrega: 0, total: sub,
        status: status, entregador_id: extra.entregador_id || null, pagamento_status: final && status !== 'CANCELADO' ? 'CONFIRMADO' : (status === 'CANCELADO' ? 'CANCELADO' : 'PENDENTE'),
        criado_em: min(criadoMin), atualizado_em: min(criadoMin), itens: itens, historico: hist, teste: true,
        prazo_em: min(criadoMin + prazoMin), finalizado_em: final ? min(criadoMin + prazoMin + (extra.atrasou ? 9 : -6)) : null,
        no_prazo: final && status !== 'CANCELADO' ? !extra.atrasou : null
      };
      e.pedidos.push(p);
    }
    var end = function (rua, numero, bairro, ref) { return { rua: rua, numero: numero, bairro: bairro, complemento: '', referencia: ref || '' }; };
    if (loja && loja !== 'aterrisse') {
      if (!e.produtos.length) return;
      pedido(41, -150, 40, 'entrega', 'ENTREGUE', 'Marcos Paulo', [itemAmostra(e, 0, 2)], { telefone: '79988880041', endereco: end('Av. Santos Dumont', '500', 'Atalaia'), entregador_id: 'ent-bruno' });
      pedido(42, -30, 40, 'entrega', 'PRONTO', 'Pedro Lima', [itemAmostra(e, 1, 1)], { telefone: '79988880042', endereco: end('Rua Niceu Dantas', '210', 'Coroa do Meio', 'Portão cinza'), pagamento: 'dinheiro', troco_para: 100 });
      pedido(43, -18, 40, 'entrega', 'EM_PREPARACAO', 'Ana Souza', [itemAmostra(e, 2, 1), itemAmostra(e, 3, 1)], { telefone: '79988880043', endereco: end('Rua Ananias Azevedo', '77', 'Farolândia'), entregador_id: 'ent-carlos' });
      pedido(44, -9, 25, 'local', 'EM_PREPARACAO', 'Rita', [itemAmostra(e, 0, 1)], { mesa: '3' });
      pedido(45, -2, 40, 'entrega', 'RECEBIDO', 'Mariana Alves', [itemAmostra(e, 1, 2)], { telefone: '79988880045', endereco: end('Av. Beira Mar', '3000', 'Jardins', 'Prédio azul, apto 302') });
      e.proximoNumero = 46;
      return;
    }
    pedido(98, -180, 30, 'retirada', 'CONCLUIDO', 'Fernanda Rocha', [itemAmostra(e, 'Quentinha G', 1, ['Tropeiro', 'Arroz branco'])], { telefone: '79988880098' });
    pedido(99, -150, 30, 'entrega', 'ENTREGUE', 'Marcos Paulo', [itemAmostra(e, 'X-Salada', 2)], { telefone: '79988880099', endereco: end('Rua Laranjeiras', '45', 'Centro'), entregador_id: 'ent-bruno', atrasou: true });
    pedido(100, -120, 30, 'retirada', 'CANCELADO', 'Carla Dias', [itemAmostra(e, 'Cachorro-quente', 1)], { telefone: '79988880100' });
    pedido(101, -33, 30, 'entrega', 'PRONTO', 'Pedro Lima', [itemAmostra(e, 'Cuscuz com carne do sol e queijo coalho', 1)],
      { telefone: '79988880101', endereco: end('Av. Augusto Franco', '2100', 'Siqueira Campos', 'Ao lado da farmácia'), entregador_id: 'ent-carlos', pagamento: 'dinheiro', troco_para: 50 });
    pedido(102, -24, 30, 'entrega', 'EM_PREPARACAO', 'Ana Souza', [itemAmostra(e, 'Quentinha P', 1, ['Caldo / tradicional', 'Farofa']), itemAmostra(e, 'Refrigerante em lata', 1)],
      { telefone: '79988880102', endereco: end('Rua Itabaiana', '120', 'Centro', 'Portão azul'), entregador_id: 'ent-carlos' });
    pedido(103, -20, 30, 'entrega', 'SAIU_PARA_ENTREGA', 'Lucas Andrade', [itemAmostra(e, 'X-Bacon', 1), itemAmostra(e, 'Batata frita', 1)],
      { telefone: '79988880103', endereco: end('Rua Siriri', '33', 'São José'), entregador_id: 'ent-bruno', pagamento: 'cartao' });
    pedido(104, -12, 30, 'retirada', 'ACEITO', 'João Pedro', [itemAmostra(e, 'X-Burger Aterrisse', 2)], { telefone: '79988880104', observacoes: 'Um sem cebola, por favor' });
    pedido(105, -8, 30, 'local', 'EM_PREPARACAO', 'Rita', [itemAmostra(e, 'Tapioca recheada', 1), itemAmostra(e, 'Caldinho da noite', 1)], { mesa: '4' });
    pedido(106, -2, 30, 'entrega', 'RECEBIDO', 'Mariana Alves', [itemAmostra(e, 'Quentinha G', 2, ['Tropeiro', 'Macarrão', 'Verde'])],
      { telefone: '79988880106', endereco: end('Rua Pacatuba', '78', 'Centro', 'Prédio verde, apto 201') });
    e.proximoNumero = 107;
  }
  BackendDemo.prototype._auditar = function (e, acao) {
    e.auditoria = (e.auditoria || []).concat([{ em: new Date().toISOString(), acao: acao }]).slice(-200);
  };

  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function novoId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  BackendDemo.prototype.cardapio = async function () {
    var e = this._estado();
    var cats = e.categorias.filter(function (c) { return c.ativa !== false; }).sort(function (a, b) { return a.ordem - b.ordem; });
    var ativas = cats.map(function (c) { return c.id; });
    var loja = copia(e.loja);
    loja.pagamentos = loja.pagamentos.filter(function (p) { return p.ativo !== false; });
    var pl = this._naPlataforma();
    loja.slug = this.loja; loja.liberada = pl.liberada !== false; loja.recursos = pl.recursos || {}; loja.modo = pl.modo || 'demo';
    loja.cor = loja.cor || pl.cor || null; loja.na_vitrine = !!pl.vitrine; loja.segmento = pl.segmento || '';
    // recurso desligado no plano = modalidade desligada para o cliente (o pedido também é recusado)
    if (loja.recursos.entrega === false) loja.aceita_entrega = false;
    if (loja.recursos.retirada === false) loja.aceita_retirada = false;
    if (loja.recursos.local === false) loja.aceita_local = false;
    return {
      loja: loja,
      destaques: copia(e.destaques.filter(function (d) { return d.ativo !== false; })),
      categorias: copia(cats),
      produtos: copia(e.produtos.filter(function (p) { return p.ativo !== false && ativas.indexOf(p.categoria_id) >= 0; })
        .sort(function (a, b) { return a.ordem - b.ordem; }))
    };
  };

  // Mesmas regras de aterrisse_criar_pedido (servidor).
  BackendDemo.prototype.criarPedido = async function (dados) {
    var e = this._estado();
    var repetido = dados.chave_envio && e.pedidos.filter(function (x) { return x.chave_envio === dados.chave_envio; })[0];
    if (repetido) {
      return { numero: repetido.numero, acompanhamento: repetido.acompanhamento, status: repetido.status, subtotal: repetido.subtotal,
        taxa_entrega: repetido.taxa_entrega, total: repetido.total, criado_em: repetido.criado_em, itens: repetido.itens, prazo_em: repetido.prazo_em, repetido: true };
    }
    var c = await this.cardapio();
    if (c.loja.liberada === false) throw Erro('Esta loja está temporariamente indisponível.', 'LOJA_SUSPENSA');
    if (!e.loja.aberto) throw Erro('O restaurante não está recebendo pedidos agora.', 'LOJA_FECHADA');
    var erros = N.validarCheckout(dados, c.loja);
    var primeiro = Object.keys(erros)[0];
    if (primeiro) throw Erro(erros[primeiro], 'VALIDACAO');
    if (!dados.itens || !dados.itens.length) throw Erro('Adicione pelo menos um item.', 'SACOLA_VAZIA');
    if (dados.itens.length > 30) throw Erro('No máximo 30 itens por pedido.', 'ITENS_DEMAIS');
    var linhas = [], sub = 0;
    dados.itens.forEach(function (it) {
      var p = N.acharProduto(c, it.produto_id);
      var er = N.validarEscolha(p, it);
      if (er.length) throw Erro(er[0], p && p.disponivel === false ? 'PRODUTO_ESGOTADO' : 'ITEM_INVALIDO');
      var unit = N.precoUnitario(p, it.adicionais);
      sub += Math.round(unit * 100) * it.quantidade;
      linhas.push({
        produto_id: p.id, nome: p.nome, preco_unitario: unit, quantidade: it.quantidade,
        adicionais: N.opcoesEscolhidas(p, it.adicionais).map(function (o) { return { grupo: o.grupo, nome: o.nome, preco: o.preco }; }),
        removidos: it.removidos || [], observacao: String(it.observacao || '').trim() || null, total: Math.round(unit * 100) * it.quantidade / 100
      });
    });
    sub = sub / 100;
    if (sub < Number(e.loja.pedido_minimo || 0)) throw Erro('Pedido mínimo de ' + N.reais(e.loja.pedido_minimo) + '.', 'PEDIDO_MINIMO');
    var taxa = dados.modalidade === 'entrega' ? Number(e.loja.taxa_entrega || 0) : 0;
    var total = Math.round((sub + taxa) * 100) / 100;
    var troco = null;
    if (dados.pagamento === 'dinheiro' && dados.troco_para !== null && dados.troco_para !== undefined && dados.troco_para !== '') {
      troco = Number(dados.troco_para);
      if (!(troco >= total)) throw Erro('O valor para troco deve ser maior ou igual ao total.', 'TROCO_INVALIDO');
    }
    var tel = N.soDigitos(dados.telefone) || null;
    var agora = new Date().toISOString();
    var minutos = { entrega: e.loja.previsao_entrega_min, retirada: e.loja.previsao_retirada_min, local: e.loja.previsao_local_min }[dados.modalidade];
    var prazo = minutos > 0 ? new Date(Date.now() + minutos * 60000).toISOString() : null;
    var pedido = {
      id: novoId(), numero: e.proximoNumero++, acompanhamento: novoId(), nome: String(dados.nome).trim(), telefone: tel,
      modalidade: dados.modalidade,
      endereco: dados.modalidade === 'entrega' ? {
        rua: String(dados.endereco.rua).trim(), numero: String(dados.endereco.numero).trim(), bairro: String(dados.endereco.bairro).trim(),
        complemento: String(dados.endereco.complemento || '').trim(), referencia: String(dados.endereco.referencia || '').trim()
      } : null,
      mesa: dados.modalidade === 'local' && e.loja.mesa_modo !== 'desligado' ? (String(dados.mesa || '').trim() || null) : null,
      observacoes: String(dados.observacoes || '').trim() || null, pagamento: dados.pagamento, troco_para: troco,
      subtotal: sub, taxa_entrega: taxa, total: total, status: 'RECEBIDO', entregador_id: null, pagamento_status: 'PENDENTE',
      criado_em: agora, atualizado_em: agora, itens: linhas, historico: [{ de: null, para: 'RECEBIDO', em: agora }],
      prazo_em: prazo, finalizado_em: null, no_prazo: null, chave_envio: dados.chave_envio || null
    };
    e.pedidos.push(pedido);
    this._gravar(e);
    return { numero: pedido.numero, acompanhamento: pedido.acompanhamento, status: pedido.status, subtotal: sub, taxa_entrega: taxa, total: total, criado_em: agora, itens: linhas, prazo_em: prazo };
  };

  BackendDemo.prototype.acompanhar = async function (numero, codigo) {
    var p = this._estado().pedidos.filter(function (x) { return x.numero === Number(numero) && x.acompanhamento === codigo; })[0];
    if (!p) return null;
    var ent = (this._estado().entregadores || []).filter(function (x) { return x.id === p.entregador_id; })[0];
    return { numero: p.numero, status: p.status, modalidade: p.modalidade, total: p.total, criado_em: p.criado_em, prazo_em: p.prazo_em || null,
      entregador: ent && ['SAIU_PARA_ENTREGA', 'ENTREGUE'].indexOf(p.status) >= 0 ? ent.nome.split(' ')[0] : null,
      historico: p.historico.map(function (h) { return { status: h.para, em: h.em }; }) };
  };

  // Conta do painel no modo demonstração: senha criada pelo próprio usuário, guardada (hash) só neste navegador.
  async function hashSenha(senha) {
    if (typeof crypto === 'undefined' || !crypto.subtle) throw Erro('Abra o painel por http://localhost ou https para usar a senha.', 'INSEGURO');
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('aterrisse-demo:' + senha));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  BackendDemo.prototype.temSenhaDemo = function () { return !!this._estado().senhaHash; };
  BackendDemo.prototype.criarConta = async function (_email, senha) {
    var e = this._estado();
    if (e.senhaHash) throw Erro('A senha deste navegador já foi criada.', 'JA_EXISTE');
    if (String(senha || '').length < 6) throw Erro('A senha precisa ter pelo menos 6 caracteres.', 'SENHA_CURTA');
    e.senhaHash = await hashSenha(senha);
    this._gravar(e);
    return this.entrar(null, senha);
  };
  BackendDemo.prototype.entrar = async function (_email, senha) {
    var e = this._estado();
    if (!e.senhaHash) throw Erro('Crie a senha do modo demonstração primeiro.', 'SEM_SENHA');
    if ((await hashSenha(senha)) !== e.senhaHash) throw Erro('Senha incorreta.', 'AUTH');
    var s = { email: 'demonstração', user_id: 'demo' };
    guardar(this.sessaoArmazem, this.chaveSessao, s);
    return s;
  };
  BackendDemo.prototype.sair = async function () { guardar(this.sessaoArmazem, this.chaveSessao, null); };
  BackendDemo.prototype.sessao = function () {
    if (this.vitrine) return { email: 'demonstração', user_id: 'demo' };
    return this.sessaoArmazem ? ler(this.sessaoArmazem, this.chaveSessao) : null;
  };
  BackendDemo.prototype.papel = async function () { return this.sessao() ? 'admin' : null; };

  BackendDemo.prototype.listarPedidos = async function () { this._exigirLogin(); return copia(this._estado().pedidos).reverse(); };
  BackendDemo.prototype.mudarStatus = async function (id, para, motivo) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p) throw Erro('Pedido não encontrado.', 'PEDIDO_INEXISTENTE');
    if (!N.transicaoValida(p.modalidade, p.status, para)) throw Erro('Não é possível passar de ' + p.status + ' para ' + para + '.', 'TRANSICAO_INVALIDA');
    if (para === 'CANCELADO' && String(motivo || '').trim().length < 3) throw Erro('Informe o motivo do cancelamento.', 'MOTIVO_OBRIGATORIO');
    var agora = new Date().toISOString();
    p.historico.push({ de: p.status, para: para, motivo: motivo || null, em: agora });
    p.status = para; p.atualizado_em = agora;
    if (['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(para) >= 0) p.finalizado_em = agora;
    p.no_prazo = para === 'CANCELADO' ? null : (['ENTREGUE', 'CONCLUIDO'].indexOf(para) >= 0 && p.prazo_em ? Date.now() <= new Date(p.prazo_em).getTime() : p.no_prazo);
    if (para === 'CANCELADO' && p.pagamento_status === 'PENDENTE') p.pagamento_status = 'CANCELADO';
    if (para === 'CANCELADO') p.oferta = null;
    if (para === 'PRONTO' && p.modalidade === 'entrega' && !p.entregador_id && (this._naPlataforma().recursos || {}).oferta !== false) ofertar(e, p);
    this._gravar(e);
    return { id: id, status: para };
  };
  BackendDemo.prototype.atribuirEntregador = async function (id, entregador) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p || p.modalidade !== 'entrega' || ['ENTREGUE', 'CANCELADO'].indexOf(p.status) >= 0) throw Erro('Só pedidos de entrega em andamento.', 'PEDIDO_INVALIDO');
    p.entregador_id = entregador || null;
    if (p.entregador_id) p.oferta = null;
    this._gravar(e);
  };
  BackendDemo.prototype.confirmarPagamento = async function (id, forma) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p || p.pagamento_status !== 'PENDENTE') throw Erro('Não há pagamento pendente neste pedido.', 'PAGAMENTO_INVALIDO');
    p.pagamento_status = 'CONFIRMADO';
    p.pago_como = forma || p.pagamento;
    p.pago_em = new Date().toISOString();
    this._gravar(e);
  };
  BackendDemo.prototype.filaCozinha = async function () {
    this._exigirLogin();
    var ents = this._estado().entregadores || [];
    return this._estado().pedidos.filter(function (p) { return p.status === 'ACEITO' || p.status === 'EM_PREPARACAO'; }).map(function (p) {
      var ent = ents.filter(function (x) { return x.id === p.entregador_id; })[0];
      return { id: p.id, numero: p.numero, status: p.status, modalidade: p.modalidade, mesa: p.mesa, primeiro_nome: p.nome.split(' ')[0],
        observacoes: p.observacoes, criado_em: p.criado_em, itens: p.itens, prazo_em: p.prazo_em || null, entregador: ent ? ent.nome : null };
    });
  };
  // Modo demonstração: o celular escolhe "quem sou eu" na lista de entregadores (na vitrine, o primeiro: Carlos Moto).
  BackendDemo.prototype.minhasEntregas = async function (entregadorId) {
    var e = this._estado();
    var ent = (e.entregadores || []).filter(function (x) { return x.id === entregadorId; })[0] || (this.vitrine ? (e.entregadores || [])[0] : null);
    if (!ent) return [];
    return copia(e.pedidos.filter(function (p) {
      return p.entregador_id === ent.id && ['ACEITO', 'EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA'].indexOf(p.status) >= 0;
    })).sort(function (a, b) { return String(a.prazo_em).localeCompare(String(b.prazo_em)); });
  };
  BackendDemo.prototype.relatorio = async function (inicio, fim) { this._exigirLogin(); this._exigirRecurso('relatorios'); return N.relatorioPedidos(this._estado().pedidos, inicio, fim); };

  BackendDemo.prototype.cardapioCompleto = async function () {
    this._exigirLogin();
    var e = this._estado();
    return copia({ loja: e.loja, destaques: e.destaques, categorias: e.categorias, produtos: e.produtos });
  };
  BackendDemo.prototype.salvarLoja = async function (loja) {
    this._exigirLogin(); var e = this._estado();
    CAMPOS_LOJA.forEach(function (c) { if (loja[c] !== undefined) e.loja[c] = loja[c]; });
    this._auditar(e, 'loja'); this._gravar(e);
    // nome e cor também valem na vitrine da plataforma
    if (Plataforma && Plataforma.obter && Plataforma.obter(this.loja)) Plataforma.salvar(this.loja, { nome: e.loja.nome, cor: e.loja.cor || undefined });
  };
  BackendDemo.prototype.salvarDestaques = async function (lista) {
    this._exigirLogin(); var e = this._estado();
    e.destaques = copia(lista); this._auditar(e, 'horarios'); this._gravar(e);
  };
  BackendDemo.prototype.salvarCategoria = async function (c) {
    this._exigirLogin(); var e = this._estado();
    var atual = e.categorias.filter(function (x) { return x.id === c.id; })[0];
    if (atual) CAMPOS_CATEGORIA.forEach(function (k) { if (c[k] !== undefined) atual[k] = c[k]; });
    else { var n = escolher(c, CAMPOS_CATEGORIA); n.id = novoId(); e.categorias.push(n); }
    this._auditar(e, 'categoria'); this._gravar(e);
  };
  BackendDemo.prototype.apagarCategoria = async function (id) {
    this._exigirLogin(); var e = this._estado();
    if (e.produtos.some(function (p) { return p.categoria_id === id; })) throw Erro('A categoria ainda tem produtos. Mova ou apague os produtos antes.', 'EM_USO');
    e.categorias = e.categorias.filter(function (c) { return c.id !== id; }); this._gravar(e);
  };
  BackendDemo.prototype.alterarProduto = async function (id, campos) {
    this._exigirLogin(); var e = this._estado();
    var p = e.produtos.filter(function (x) { return x.id === id; })[0];
    if (!p) throw Erro('Produto não encontrado.', 'NAO_ENCONTRADO');
    CAMPOS_PRODUTO.forEach(function (k) { if (campos[k] !== undefined) p[k] = campos[k]; });
    this._auditar(e, 'produto'); this._gravar(e);
  };
  BackendDemo.prototype.alterarOpcao = async function (id, disponivel) {
    this._exigirLogin(); var e = this._estado();
    e.produtos.forEach(function (p) { (p.grupos || []).forEach(function (g) { (g.opcoes || []).forEach(function (o) { if (o.id === id) o.disponivel = !!disponivel; }); }); });
    this._auditar(e, 'produto'); this._gravar(e);
  };
  BackendDemo.prototype.apagarProduto = async function (id) {
    this._exigirLogin(); var e = this._estado();
    e.produtos = e.produtos.filter(function (p) { return p.id !== id; }); this._gravar(e);
  };
  BackendDemo.prototype.salvarProduto = async function (p) {
    this._exigirLogin(); var e = this._estado();
    var n = copia(p);
    if (!n.id || String(n.id).indexOf('novo') === 0) n.id = novoId();
    (n.grupos || []).forEach(function (g) {
      if (!g.id || String(g.id).indexOf('novo') === 0) g.id = novoId();
      (g.opcoes || []).forEach(function (o) { if (!o.id || String(o.id).indexOf('novo') === 0) o.id = novoId(); });
    });
    var i = e.produtos.map(function (x) { return x.id; }).indexOf(n.id);
    if (i >= 0) e.produtos[i] = n; else e.produtos.push(n);
    this._auditar(e, 'produto'); this._gravar(e);
    return n.id;
  };
  BackendDemo.prototype.listarEquipe = async function () { return []; };
  BackendDemo.prototype.adicionarEquipe = async function () { throw Erro('No modo demonstração não há equipe: só a senha deste navegador.', 'DEMO'); };
  BackendDemo.prototype.alterarEquipe = BackendDemo.prototype.adicionarEquipe;
  BackendDemo.prototype.listarEntregadores = async function () { this._exigirLogin(); return copia(this._estado().entregadores || []); };
  BackendDemo.prototype.salvarEntregador = async function (en) {
    this._exigirLogin(); var e = this._estado();
    e.entregadores = e.entregadores || [];
    var atual = e.entregadores.filter(function (x) { return x.id === en.id; })[0];
    if (atual) { atual.nome = en.nome; atual.telefone = en.telefone; atual.ativo = en.ativo !== false; }
    else e.entregadores.push({ id: novoId(), nome: en.nome, telefone: en.telefone || null, ativo: true });
    this._gravar(e);
  };
  BackendDemo.prototype.apagarTudoDemo = function () { if (this.armazem) guardar(this.armazem, this.chave, null); };
  BackendDemo.prototype.registrarErro = async function () { /* no modo navegador não há servidor para guardar erros */ };
  BackendDemo.prototype.criarAcesso = async function () { throw Erro('No modo demonstração não há contas da equipe.', 'DEMO'); };
  BackendDemo.prototype.trocarSenha = BackendDemo.prototype.criarAcesso;
  BackendDemo.prototype.souRmd = async function () { return false; };
  ['rmdPainel', 'rmdControle', 'rmdDarAcesso', 'rmdTirarAcesso', 'rmdErros', 'rmdErroResolvido', 'rmdInscricoes', 'rmdInscricaoCancelar'].forEach(function (n) {
    BackendDemo.prototype[n] = async function () { throw Erro('A área do desenvolvedor só funciona com o banco (MODO supabase).', 'DEMO'); };
  });

  // ================================================================ do CONIS: entregadores online e oferta da entrega

  function abertasDo(e, entId) {
    return e.pedidos.filter(function (p) { return p.entregador_id === entId && ['ENTREGUE', 'CANCELADO'].indexOf(p.status) < 0; }).length;
  }
  // Oferece a entrega ao entregador online e ativo com menos entregas abertas, que ainda não recusou.
  function ofertar(e, p) {
    var recusados = (p.oferta && p.oferta.recusados) || [];
    var livres = (e.entregadores || []).filter(function (x) { return x.ativo !== false && x.online && recusados.indexOf(x.id) < 0; })
      .sort(function (a, b) { return abertasDo(e, a.id) - abertasDo(e, b.id); });
    var alvo = livres[0];
    p.oferta = { entregador_id: alvo ? alvo.id : null, em: new Date().toISOString(), recusados: recusados, sem_ninguem: !alvo };
    return alvo || null;
  }

  // Lista curta (nome e se está online) para a tela do entregador escolher "quem sou eu" no modo demonstração.
  BackendDemo.prototype.entregadoresDaLoja = async function () {
    return (this._estado().entregadores || []).map(function (x) { return { id: x.id, nome: x.nome, ativo: x.ativo !== false, online: !!x.online }; });
  };
  // O entregador só mexe nas entregas que são dele: sair, entregar e marcar o pagamento recebido.
  BackendDemo.prototype._entregaDo = function (e, pedidoId, entregadorId) {
    var p = e.pedidos.filter(function (x) { return x.id === pedidoId; })[0];
    if (!p || !entregadorId || p.entregador_id !== entregadorId) throw Erro('Esta entrega não é sua.', 'SEM_PERMISSAO');
    return p;
  };
  BackendDemo.prototype.entregadorStatus = async function (pedidoId, entregadorId, para) {
    this._exigirRecurso('entregadores');
    var e = this._estado(), p = this._entregaDo(e, pedidoId, entregadorId);
    if (['SAIU_PARA_ENTREGA', 'ENTREGUE'].indexOf(para) < 0 || !N.transicaoValida('entrega', p.status, para)) throw Erro('Não é possível passar de ' + N.STATUS_NOMES[p.status] + ' para ' + N.STATUS_NOMES[para] + '.', 'TRANSICAO_INVALIDA');
    var agora = new Date().toISOString();
    p.historico.push({ de: p.status, para: para, em: agora, por: 'entregador' });
    p.status = para; p.atualizado_em = agora;
    if (para === 'ENTREGUE') { p.finalizado_em = agora; p.no_prazo = p.prazo_em ? Date.now() <= new Date(p.prazo_em).getTime() : null; }
    this._gravar(e);
  };
  BackendDemo.prototype.entregadorPagamento = async function (pedidoId, entregadorId, forma) {
    this._exigirRecurso('entregadores');
    var e = this._estado(), p = this._entregaDo(e, pedidoId, entregadorId);
    if (p.pagamento_status !== 'PENDENTE') throw Erro('Não há pagamento pendente nesta entrega.', 'PAGAMENTO_INVALIDO');
    if (p.status !== 'SAIU_PARA_ENTREGA') throw Erro('Confirme o pagamento depois de sair para a entrega.', 'PAGAMENTO_INVALIDO');
    if (['dinheiro', 'cartao', 'pix'].indexOf(forma) < 0) throw Erro('Forma de pagamento inválida.', 'VALIDACAO');
    p.pagamento_status = 'CONFIRMADO'; p.pago_como = forma; p.pago_em = new Date().toISOString(); p.pago_por = 'entregador';
    this._gravar(e);
  };
  BackendDemo.prototype.entregadorOcorrencia = async function (pedidoId, entregadorId, tipo, texto) {
    this._entregaDo(this._estado(), pedidoId, entregadorId);
    return this.registrarOcorrencia(pedidoId, tipo, texto);
  };
  BackendDemo.prototype.definirOnline = async function (entregadorId, online) {
    this._exigirRecurso('entregadores');
    var e = this._estado();
    var ent = (e.entregadores || []).filter(function (x) { return x.id === entregadorId; })[0];
    if (!ent) throw Erro('Entregador não encontrado.', 'NAO_ENCONTRADO');
    ent.online = !!online; ent.online_desde = online ? new Date().toISOString() : null;
    if (!online) e.pedidos.forEach(function (p) { if (p.oferta && p.oferta.entregador_id === entregadorId) ofertar(e, p); });
    this._gravar(e);
  };
  BackendDemo.prototype.oferecerEntrega = async function (pedidoId) {
    this._exigirLogin();
    this._exigirRecurso('oferta');
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === pedidoId; })[0];
    if (!p || p.modalidade !== 'entrega' || p.entregador_id || ['ENTREGUE', 'CANCELADO', 'SAIU_PARA_ENTREGA'].indexOf(p.status) >= 0) throw Erro('Só entregas em andamento e sem entregador.', 'PEDIDO_INVALIDO');
    if (p.oferta && p.oferta.sem_ninguem) p.oferta.recusados = []; // ninguém aceitou: começa a roda de novo
    var alvo = ofertar(e, p);
    this._gravar(e);
    return alvo ? alvo.nome : null;
  };
  BackendDemo.prototype.ofertasPara = async function (entregadorId) {
    if ((this._naPlataforma().recursos || {}).entregadores === false) return [];
    var e = this._estado();
    return copia(e.pedidos.filter(function (p) { return p.oferta && p.oferta.entregador_id === entregadorId && !p.entregador_id && ['ENTREGUE', 'CANCELADO'].indexOf(p.status) < 0; }));
  };
  BackendDemo.prototype.responderOferta = async function (pedidoId, entregadorId, aceitar) {
    this._exigirRecurso('entregadores');
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === pedidoId; })[0];
    if (!p || !p.oferta || p.oferta.entregador_id !== entregadorId || p.entregador_id) throw Erro('Esta oferta não está mais com você.', 'OFERTA_EXPIRADA');
    if (aceitar) { p.entregador_id = entregadorId; p.oferta = null; }
    else { p.oferta.recusados = (p.oferta.recusados || []).concat([entregadorId]); ofertar(e, p); }
    this._gravar(e);
    return aceitar;
  };

  // ================================================================ do CONIS: ocorrências de entrega

  var OCORRENCIAS = {
    ENTREGUE_SEM_PAGAMENTO: 'Entregue e pagamento não confirmado', CLIENTE_RECUSOU_PAGAR: 'Cliente recusou o pagamento',
    PAGO_E_RECUSOU_RECEBER: 'Pagamento consta recebido, mas cliente recusou receber', CLIENTE_AUSENTE: 'Cliente não estava no endereço',
    ENDERECO_NAO_ACHADO: 'Endereço não encontrado', OUTRA: 'Outra ocorrência'
  };
  BackendDemo.prototype.registrarOcorrencia = async function (pedidoId, tipo, texto) {
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === pedidoId; })[0];
    if (!p) throw Erro('Pedido não encontrado.', 'PEDIDO_INEXISTENTE');
    if (!OCORRENCIAS[tipo]) throw Erro('Escolha o tipo da ocorrência.', 'VALIDACAO');
    if (tipo === 'OUTRA' && String(texto || '').trim().length < 3) throw Erro('Descreva a ocorrência.', 'VALIDACAO');
    p.ocorrencias = (p.ocorrencias || []).concat([{ tipo: tipo, nome: OCORRENCIAS[tipo], texto: String(texto || '').trim().slice(0, 300) || null, em: new Date().toISOString(), resolvida: false }]);
    this._gravar(e);
  };
  BackendDemo.prototype.resolverOcorrencia = async function (pedidoId, indice) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === pedidoId; })[0];
    if (!p || !p.ocorrencias || !p.ocorrencias[indice]) throw Erro('Ocorrência não encontrada.', 'NAO_ENCONTRADO');
    p.ocorrencias[indice].resolvida = true; p.ocorrencias[indice].resolvida_em = new Date().toISOString();
    this._gravar(e);
  };

  // ================================================================ do CONIS: venda no balcão e mesas (garçom)

  // Monta os itens com o preço do cardápio (o mesmo cálculo do pedido do cliente).
  function linhasDe(c, itens) {
    if (!itens || !itens.length) throw Erro('Adicione pelo menos um item.', 'SACOLA_VAZIA');
    var linhas = [], sub = 0;
    itens.forEach(function (it) {
      var p = N.acharProduto(c, it.produto_id);
      var er = N.validarEscolha(p, it);
      if (er.length) throw Erro(er[0], 'ITEM_INVALIDO');
      var unit = N.precoUnitario(p, it.adicionais);
      sub += Math.round(unit * 100) * it.quantidade;
      linhas.push({ produto_id: p.id, nome: p.nome, preco_unitario: unit, quantidade: it.quantidade,
        adicionais: N.opcoesEscolhidas(p, it.adicionais).map(function (o) { return { grupo: o.grupo, nome: o.nome, preco: o.preco }; }),
        removidos: it.removidos || [], observacao: String(it.observacao || '').trim() || null, total: Math.round(unit * 100) * it.quantidade / 100 });
    });
    return { linhas: linhas, subtotal: sub / 100 };
  }
  // Pedido feito pela equipe (balcão ou garçom): já entra aceito e vai direto para a cozinha.
  BackendDemo.prototype._pedidoDaEquipe = async function (dados, origem) {
    var e = this._estado(), c = await this.cardapio();
    var m = linhasDe(c, dados.itens);
    var agora = new Date().toISOString();
    var minutos = dados.modalidade === 'local' ? e.loja.previsao_local_min : e.loja.previsao_retirada_min;
    var p = {
      id: novoId(), numero: e.proximoNumero++, acompanhamento: novoId(), nome: String(dados.nome || '').trim() || (dados.mesa ? 'Mesa ' + dados.mesa : 'Balcão'),
      telefone: N.soDigitos(dados.telefone) || null, modalidade: dados.modalidade, endereco: null, mesa: dados.mesa ? String(dados.mesa) : null,
      observacoes: String(dados.observacoes || '').trim() || null, pagamento: dados.pagamento || 'dinheiro', troco_para: null,
      subtotal: m.subtotal, taxa_entrega: 0, total: m.subtotal, status: 'ACEITO', entregador_id: null, pagamento_status: 'PENDENTE',
      criado_em: agora, atualizado_em: agora, itens: m.linhas, historico: [{ de: null, para: 'RECEBIDO', em: agora }, { de: 'RECEBIDO', para: 'ACEITO', em: agora }],
      prazo_em: minutos > 0 ? new Date(Date.now() + minutos * 60000).toISOString() : null, finalizado_em: null, no_prazo: null,
      origem: origem, garcom: dados.garcom || null
    };
    if (dados.pago) { p.pagamento_status = 'CONFIRMADO'; p.pago_como = p.pagamento; p.pago_em = agora; }
    e.pedidos.push(p);
    this._gravar(e);
    return copia(p);
  };

  BackendDemo.prototype.venderBalcao = async function (dados) {
    this._exigirLogin();
    this._exigirLiberada(); this._exigirRecurso('caixa');
    if (!this._estado().caixa.aberto) throw Erro('Abra o caixa antes de vender no balcão.', 'CAIXA_FECHADO');
    return this._pedidoDaEquipe({ itens: dados.itens, nome: dados.nome, telefone: dados.telefone, modalidade: 'retirada', pagamento: dados.pagamento, pago: dados.pago !== false, observacoes: dados.observacoes }, 'balcao');
  };

  function contaFechada(p) { return p.conta_fechada || p.status === 'CANCELADO'; }
  BackendDemo.prototype.mesas = async function () {
    this._exigirLogin();
    this._exigirRecurso('mesas');
    var e = this._estado(), qtd = Number(e.loja.mesas_qtd) || 0, r = [];
    for (var n = 1; n <= qtd; n++) {
      var dela = e.pedidos.filter(function (p) { return p.modalidade === 'local' && String(p.mesa) === String(n) && !contaFechada(p); });
      r.push({ numero: n, ocupada: dela.length > 0, pedidos: copia(dela), total: dela.reduce(function (s, p) { return s + Math.round(p.total * 100); }, 0) / 100,
        desde: dela.length ? dela.map(function (p) { return p.criado_em; }).sort()[0] : null,
        pronta_para_fechar: dela.length > 0 && dela.every(function (p) { return ['PRONTO', 'CONCLUIDO'].indexOf(p.status) >= 0; }) });
    }
    return r;
  };
  BackendDemo.prototype.lancarMesa = async function (mesa, itens, garcom, observacoes) {
    this._exigirLogin();
    this._exigirLiberada(); this._exigirRecurso('mesas');
    var qtd = Number(this._estado().loja.mesas_qtd) || 0;
    if (!(Number(mesa) >= 1 && Number(mesa) <= qtd)) throw Erro('Mesa inválida.', 'MESA_INVALIDA');
    return this._pedidoDaEquipe({ itens: itens, mesa: String(mesa), modalidade: 'local', pagamento: 'dinheiro', pago: false, garcom: garcom, observacoes: observacoes }, 'garcom');
  };
  // Fecha a conta: só quando tudo da mesa já saiu da cozinha. Marca recebido e libera a mesa.
  BackendDemo.prototype.fecharMesa = async function (mesa, forma) {
    this._exigirLogin();
    this._exigirRecurso('mesas');
    var e = this._estado(), agora = new Date().toISOString();
    var dela = e.pedidos.filter(function (p) { return p.modalidade === 'local' && String(p.mesa) === String(mesa) && !contaFechada(p); });
    if (!dela.length) throw Erro('Esta mesa não tem conta aberta.', 'MESA_LIVRE');
    if (dela.some(function (p) { return ['PRONTO', 'CONCLUIDO'].indexOf(p.status) < 0; })) throw Erro('Ainda há pedido desta mesa na cozinha. Espere ficar pronto.', 'MESA_EM_PREPARO');
    var total = 0;
    dela.forEach(function (p) {
      if (p.status === 'PRONTO') { p.historico.push({ de: 'PRONTO', para: 'CONCLUIDO', em: agora }); p.status = 'CONCLUIDO'; p.finalizado_em = agora;
        p.no_prazo = p.prazo_em ? Date.now() <= new Date(p.prazo_em).getTime() : null; }
      if (p.pagamento_status === 'PENDENTE') { p.pagamento_status = 'CONFIRMADO'; p.pago_como = forma || 'dinheiro'; p.pago_em = agora; }
      p.conta_fechada = true; total += Math.round(p.total * 100);
    });
    this._gravar(e);
    return { mesa: String(mesa), total: total / 100, pedidos: dela.length };
  };

  // ================================================================ do CONIS: caixa (abrir, sangria/suprimento, fechar)

  function resumoCaixa(e) {
    var cx = e.caixa;
    if (!cx.aberto) return { aberto: false, fechamentos: copia((cx.fechamentos || []).slice(-10).reverse()) };
    var desde = cx.aberto_em;
    var pagos = e.pedidos.filter(function (p) { return p.pagamento_status === 'CONFIRMADO' && p.pago_em && p.pago_em >= desde; });
    var porForma = {};
    pagos.forEach(function (p) { var f = p.pago_como || p.pagamento; porForma[f] = (porForma[f] || 0) + Math.round(p.total * 100); });
    Object.keys(porForma).forEach(function (k) { porForma[k] = porForma[k] / 100; });
    var mov = cx.movimentos || [];
    var soma = function (tipo) { return mov.filter(function (m) { return m.tipo === tipo; }).reduce(function (s, m) { return s + Math.round(m.valor * 100); }, 0) / 100; };
    var dinheiro = Math.round((Number(cx.valor_inicial || 0) + (porForma.dinheiro || 0) + soma('suprimento') - soma('sangria')) * 100) / 100;
    var aReceber = e.pedidos.filter(function (p) { return p.pagamento_status === 'PENDENTE' && p.criado_em >= desde && p.status !== 'CANCELADO'; });
    return { aberto: true, aberto_em: desde, aberto_por: cx.aberto_por || null, valor_inicial: Number(cx.valor_inicial || 0), por_forma: porForma,
      vendas: pagos.reduce(function (s, p) { return s + Math.round(p.total * 100); }, 0) / 100, pedidos_pagos: pagos.length,
      suprimentos: soma('suprimento'), sangrias: soma('sangria'), dinheiro_esperado: dinheiro, movimentos: copia(mov),
      a_receber: aReceber.reduce(function (s, p) { return s + Math.round(p.total * 100); }, 0) / 100, pedidos_a_receber: aReceber.length,
      fechamentos: copia((cx.fechamentos || []).slice(-10).reverse()) };
  }
  BackendDemo.prototype.caixa = async function () { this._exigirLogin(); this._exigirRecurso('caixa'); return resumoCaixa(this._estado()); };
  BackendDemo.prototype.abrirCaixa = async function (valorInicial, quem) {
    this._exigirLogin();
    this._exigirRecurso('caixa');
    var e = this._estado();
    if (e.caixa.aberto) throw Erro('O caixa já está aberto.', 'CAIXA_ABERTO');
    var v = Number(valorInicial);
    if (!(v >= 0 && v <= 100000)) throw Erro('Valor inicial inválido.', 'VALIDACAO');
    e.caixa.aberto = true; e.caixa.aberto_em = new Date().toISOString(); e.caixa.valor_inicial = Math.round(v * 100) / 100; e.caixa.aberto_por = quem || null; e.caixa.movimentos = [];
    this._auditar(e, 'caixa aberto'); this._gravar(e);
    return resumoCaixa(e);
  };
  BackendDemo.prototype.movimentoCaixa = async function (tipo, valor, motivo) {
    this._exigirLogin();
    this._exigirRecurso('caixa');
    var e = this._estado();
    if (!e.caixa.aberto) throw Erro('Abra o caixa primeiro.', 'CAIXA_FECHADO');
    if (['sangria', 'suprimento'].indexOf(tipo) < 0) throw Erro('Tipo inválido.', 'VALIDACAO');
    var v = Number(valor);
    if (!(v > 0 && v <= 100000)) throw Erro('Valor inválido.', 'VALIDACAO');
    if (String(motivo || '').trim().length < 3) throw Erro('Informe o motivo.', 'VALIDACAO');
    e.caixa.movimentos.push({ tipo: tipo, valor: Math.round(v * 100) / 100, motivo: String(motivo).trim().slice(0, 120), em: new Date().toISOString() });
    this._gravar(e);
    return resumoCaixa(e);
  };
  BackendDemo.prototype.fecharCaixa = async function (contado) {
    this._exigirLogin();
    this._exigirRecurso('caixa');
    var e = this._estado();
    if (!e.caixa.aberto) throw Erro('O caixa já está fechado.', 'CAIXA_FECHADO');
    var r = resumoCaixa(e), c = Number(contado);
    if (!(c >= 0)) throw Erro('Informe quanto tem de dinheiro na gaveta.', 'VALIDACAO');
    var f = { aberto_em: r.aberto_em, fechado_em: new Date().toISOString(), valor_inicial: r.valor_inicial, vendas: r.vendas, por_forma: r.por_forma,
      suprimentos: r.suprimentos, sangrias: r.sangrias, dinheiro_esperado: r.dinheiro_esperado, dinheiro_contado: Math.round(c * 100) / 100,
      diferenca: Math.round((c - r.dinheiro_esperado) * 100) / 100 };
    e.caixa.fechamentos = (e.caixa.fechamentos || []).concat([f]).slice(-60);
    e.caixa.aberto = false; e.caixa.movimentos = [];
    this._auditar(e, 'caixa fechado'); this._gravar(e);
    return f;
  };

  // ================================================================ do CONIS: clientes (só a equipe vê; o cliente não consegue buscar ninguém)

  BackendDemo.prototype.clientes = async function () {
    this._exigirLogin();
    this._exigirRecurso('clientes');
    var porTel = {};
    this._estado().pedidos.slice().sort(function (a, b) { return String(a.criado_em).localeCompare(String(b.criado_em)); }).forEach(function (p) {
      if (!p.telefone) return;
      var c = porTel[p.telefone] = porTel[p.telefone] || { telefone: p.telefone, pedidos: 0, total: 0, primeiro_em: p.criado_em };
      c.nome = p.nome; c.ultimo_em = p.criado_em; if (p.endereco) c.endereco = p.endereco;
      if (p.status !== 'CANCELADO') { c.pedidos++; c.total = Math.round((c.total + p.total) * 100) / 100; }
    });
    return Object.keys(porTel).map(function (k) { return porTel[k]; }).sort(function (a, b) { return String(b.ultimo_em).localeCompare(String(a.ultimo_em)); });
  };

  function criar(cfg) {
    cfg = cfg || {};
    // ?demo=1 (demonstração para mostrar ao cliente) continua só no aparelho, sem login, mesmo com o banco ligado
    if (cfg.MODO === 'supabase' && !cfg.VITRINE && (cfg.PEDESUL_URL || cfg.SUPABASE_URL)) return new BackendSupabase(cfg);
    return new BackendDemo(undefined, undefined, { vitrine: !!cfg.VITRINE, loja: cfg.LOJA });
  }

  return { criar: criar, BackendSupabase: BackendSupabase, BackendDemo: BackendDemo, Erro: Erro, OCORRENCIAS: OCORRENCIAS };
});
