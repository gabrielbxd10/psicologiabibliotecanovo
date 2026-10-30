/* Rastreamento da página de vendas.
 * - O pixel da UTMify (6ac5b7d973e2bd007d1d6544) é quem carrega o Meta Pixel da conta (973045345819425) e envia
 *   PageView / InitiateCheckout (navegador + servidor, com deduplicação). Por isso esta página NÃO inicializa o
 *   Meta Pixel por conta própria: duas inicializações do mesmo ID geram "Duplicate Pixel ID" e quebram a contagem.
 * - O IC é detectado pela própria UTMify no clique de um link de checkout (GGCheckout, caminho /checkout/); o botão de compra só atualiza o link com
 *   as UTMs/xcod/sck e deixa a navegação acontecer normalmente.
 * - Guarda as UTMs/IDs de clique do anúncio por 7 dias, para atribuir a venda mesmo se a pessoa voltar depois.
 * - Eventos de engajamento (rolagem, tempo, seções, cliques) vão pelo fbq que a UTMify carregou.
 * Para desligar num teste local: window.__NO_TRACK = true antes deste script, ou abrir pelo arquivo (file://). */
(function () {
	'use strict';
	var PIXEL_UTMIFY = '6ac5b7d973e2bd007d1d6544';
	var SEM_RASTREIO = !!window.__NO_TRACK || location.protocol === 'file:';

	var PARAMS = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'utm_id', 'src', 'sck', 'xcod', 'fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'tbclid', 'click_id', 'CampaignID', 'adSETID', 'CreativeID', 'pixel_id', 'cid'];
	var CHAVE = 'biblioteca_attribution_v1';
	var SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
	var agora = Date.now();

	// ---------- atribuição: UTMs da URL atual, ou as guardadas da última visita vinda de anúncio ----------
	var guardados = {};
	try {
		var salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
		if (salvo && salvo.expires > agora) guardados = salvo.params || {};
	} catch (e) {}
	var url = new URLSearchParams(location.search);
	if (PARAMS.some(function (p) { return url.get(p); })) {
		guardados = {};
		PARAMS.forEach(function (p) { var v = url.get(p); if (v) guardados[p] = v; });
		try { localStorage.setItem(CHAVE, JSON.stringify({expires: agora + SETE_DIAS, params: guardados})); } catch (e) {}
	}

	window.BibliotecaTracking = {
		// URL do checkout com UTMs + xcod/sck (formato UTMify: partes unidas por "hQwK21wXxR")
		checkoutUrl: function (base) {
			var destino = new URL(base);
			var p = new URLSearchParams(guardados);
			PARAMS.forEach(function (k) { var v = url.get(k); if (v) p.set(k, v); });
			if (window.utmParams && typeof window.utmParams.forEach === 'function') {
				window.utmParams.forEach(function (v, k) { if (PARAMS.indexOf(k) > -1 && v) p.set(k, v); });
			}
			PARAMS.forEach(function (k) { var v = p.get(k); if (v) destino.searchParams.set(k, v); });
			if (!destino.searchParams.get('sck')) {
				var partes = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'].map(function (k) { return p.get(k) || ''; });
				if (partes.some(Boolean)) {
					var sck = partes.join('hQwK21wXxR').slice(0, 255);
					destino.searchParams.set('sck', sck);
					if (!destino.searchParams.get('xcod')) destino.searchParams.set('xcod', sck);
				}
			}
			return destino.toString();
		}
	};

	// InitiateCheckout: o pixel da UTMify (6ae2944c…) está com a detecção automática desligada e uma única regra de texto
	// "comprar,buy,levar,quiero,si" — ela é comparada como frase inteira (não separa nas vírgulas), então nenhum botão casava
	// e o IC nunca disparava. Cada botão de compra recebe essa frase invisível (fora da tela e escondida do leitor de tela),
	// e a própria UTMify reconhece o clique e envia o IC (navegador + servidor). Se a regra for corrigida no painel, continua valendo.
	var REGRA_IC = 'comprar,buy,levar,quiero,si';
	var marcarBotoesDeCompra = function () {
		document.querySelectorAll('a[data-buy]').forEach(function (a) {
			if (a.querySelector('.utm-ic')) return;
			var s = document.createElement('span');
			s.className = 'utm-ic';
			s.setAttribute('aria-hidden', 'true');
			s.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
			s.textContent = REGRA_IC;
			a.appendChild(s);
		});
	};
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marcarBotoesDeCompra); else marcarBotoesDeCompra();

	if (SEM_RASTREIO) return;

	var addScript = function (src, attrs) {
		var s = document.createElement('script');
		s.src = src; s.async = true; s.defer = true;
		(attrs || []).forEach(function (a) { s.setAttribute(a[0], a[1]); });
		(document.head || document.documentElement).appendChild(s);
	};

	// ---------- UTMify: UTMs nos links + pixel (que traz o Meta Pixel da conta) ----------
	// Carregados logo depois que a página termina de carregar (não disputam banda com o conteúdo do topo).
	// O PageView continua sendo enviado; só sai alguns instantes depois.
	// Quem visitou antes ficou com o "lead" da UTMify preso ao pixel antigo (que agora responde erro): descarta para recriar no novo.
	try {
		var lead = JSON.parse(localStorage.getItem('lead') || 'null');
		if (lead && lead.pixelId && lead.pixelId !== PIXEL_UTMIFY) localStorage.removeItem('lead');
	} catch (e) {}
	var carregarRastreio = function () {
		addScript('https://cdn.utmify.com.br/scripts/utms/latest.js', [['data-utmify-prevent-subids', '']]);
		window.pixelId = PIXEL_UTMIFY;
		addScript('https://cdn.utmify.com.br/scripts/pixel/pixel.js');
	};
	if (document.readyState === 'complete') carregarRastreio(); else addEventListener('load', carregarRastreio);

	// ---------- eventos de engajamento (custom), cada um no máximo 1x quando "unico" ----------
	// Só usam o fbq quando a UTMify já o carregou; antes disso o evento é ignorado (nunca inicializamos o pixel aqui).
	var enviados = {};
	var evento = function (nome, dados, unico) {
		if (typeof window.fbq !== 'function') return;
		if (unico) { if (enviados[nome]) return; enviados[nome] = 1; }
		try { window.fbq('trackCustom', nome, dados || {}); } catch (e) {}
	};
	window.trackCustom = evento;

	document.addEventListener('DOMContentLoaded', function () {
		// rolagem
		addEventListener('scroll', function () {
			var total = document.documentElement.scrollHeight - innerHeight;
			if (total <= 0) return;
			var pct = scrollY / total * 100;
			[25, 50, 75, 90].forEach(function (m) { if (pct >= m) evento('Scroll' + m, {percent: m}, true); });
		}, {passive: true});

		// tempo na página (só conta com a aba visível)
		var seg = 0;
		setInterval(function () {
			if (document.visibilityState !== 'visible') return;
			seg++;
			if ([15, 30, 60, 120, 180].indexOf(seg) > -1) evento('Tiempo' + seg + 's', {seconds: seg}, true);
		}, 1000);

		// seções vistas
		var secoes = {'#dores': 'VerDolores', '#amostra': 'VerMuestras', '#modules': 'VerModulos', '#metodo': 'VerMetodo', '#bonos': 'VerBonos', '#testimonios': 'VerTestimonios', '#oferta': 'VerOferta', '#garantia': 'VerGarantia', '#faq': 'VerFAQ', '.final': 'VerCierre'};
		if ('IntersectionObserver' in window) {
			var obs = new IntersectionObserver(function (es) {
				es.forEach(function (e) { if (e.isIntersecting) { evento(e.target.__ev, {}, true); obs.unobserve(e.target); } });
			}, {threshold: 0, rootMargin: '-35% 0px -35% 0px'});
			Object.keys(secoes).forEach(function (sel) { var el = document.querySelector(sel); if (el) { el.__ev = secoes[sel]; obs.observe(el); } });
		}

		// cliques
		document.addEventListener('click', function (e) {
			var alvo = e.target;
			var botao = alvo.closest('a.btn');
			if (botao && (botao.getAttribute('href') || '').charAt(0) === '#') {
				var sec = botao.closest('section,header');
				evento('ClicBoton', {texto: botao.textContent.trim().slice(0, 60), destino: botao.getAttribute('href'), seccion: sec ? sec.id || sec.className : ''});
			}
			var pag = alvo.closest('.page');
			if (pag) evento('AmpliarMuestra', {muestra: (pag.querySelector('img') || {}).alt || ''});
			if (alvo.closest('.testi')) evento('AmpliarTestimonio', {});
			if (alvo.closest('.car-btn')) evento('UsarFlechasCarrusel', {}, true);
			var faq = alvo.closest('.faq summary');
			if (faq) evento('AbrirPregunta', {pregunta: faq.textContent.trim()});
		}, true);

		// deslizar carrosséis
		document.querySelectorAll('#amostras .track,#track2').forEach(function (el) {
			var ja = false;
			el.addEventListener('scroll', function () {
				if (ja) return; ja = true;
				evento(el.id === 'track2' ? 'DeslizarTestimonios' : 'DeslizarMuestras', {});
			}, {passive: true});
		});
	});
})();
