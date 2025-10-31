'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require ui';
'require form';

var callgetAwgInstances = rpc.declare({
	object: 'luci.amneziawg',
	method: 'getAwgInstances'
});

function timestampToStr(timestamp) {
	if (timestamp < 1)
		return _('Never', 'No AmneziaWG peer handshake yet');

	var seconds = (Date.now() / 1000) - timestamp;
	var ago;

	if (seconds < 60)
		ago = _('%ds ago').format(Math.floor(seconds));
	else if (seconds < 3600)
		ago = _('%dm ago').format(Math.floor(seconds / 60));
	else if (seconds < 86401)
		ago = _('%dh ago').format(Math.floor(seconds / 3600));
	else
		ago = _('over a day ago');

	return (new Date(timestamp * 1000)).toUTCString() + ' (' + ago + ')';
}

function handleInterfaceDetails(iface) {
	ui.showModal(_('Instance Details'), [
		ui.itemlist(E([]), [
			_('Name'), iface.name,
			_('Public Key'), E('code', [ iface.public_key ]),
			_('Listen Port'), iface.listen_port,
			_('Firewall Mark'), iface.fwmark != 'off' ? iface.fwmark : E('em', _('none'))
		]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.hideModal
			}, [ _('Dismiss') ])
		])
	]);
}

function handlePeerDetails(peer) {
	ui.showModal(_('Peer Details'), [
		ui.itemlist(E([]), [
			_('Description'), peer.name,
			_('Public Key'), E('code', [ peer.public_key ]),
			_('Endpoint'), peer.endpoint,
			_('Allowed IPs'), (Array.isArray(peer.allowed_ips) && peer.allowed_ips.length) ? peer.allowed_ips.join(', ') : E('em', _('none')),
			_('Received Data'), '%1024mB'.format(peer.transfer_rx),
			_('Transmitted Data'), '%1024mB'.format(peer.transfer_tx),
			_('Latest Handshake'), timestampToStr(+peer.latest_handshake),
			_('Keep-Alive'), (peer.persistent_keepalive != 'off') ? _('every %ds', 'AmneziaWG keep alive interval').format(+peer.persistent_keepalive) : E('em', _('none')),
		]),
		E('div', { 'class': 'right' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': ui.hideModal
			}, [ _('Dismiss') ])
		])
	]);
}

function renderPeerTable(instanceName, peers) {
	var t = new L.ui.Table(
		[
			_('Peer'),
			_('Endpoint'),
			_('Data Received'),
			_('Data Transmitted'),
			_('Latest Handshake')
		],
		{
			id: 'peers-' + instanceName
		},
		E('em', [
			_('No peers connected')
		])
	);

	t.update(peers.map(function(peer) {
		return [
			[
				peer.name || '',
				E('div', {
					'style': 'cursor:pointer',
					'click': ui.createHandlerFn(this, handlePeerDetails, peer)
				}, [
					E('p', [
						peer.name ? E('span', [ peer.name ]) : E('em', [ _('Untitled peer') ])
					]),
					E('span', {
						'class': 'ifacebadge hide-sm',
						'data-tooltip': _('Public key: %h', 'Tooltip displaying full AmneziaWG peer public key').format(peer.public_key)
					}, [
						E('code', [ peer.public_key.replace(/^(.{5}).+(.{6})$/, '$1…$2') ])
					])
				])
			],
			peer.endpoint,
			[ +peer.transfer_rx, '%1024mB'.format(+peer.transfer_rx) ],
			[ +peer.transfer_tx, '%1024mB'.format(+peer.transfer_tx) ],
			[ +peer.latest_handshake, timestampToStr(+peer.latest_handshake) ]
		];
	}));

	return t.render();
}

function renderStatusTab(ifaces) {
	var res = [];

	for (var instanceName in ifaces) {
		res.push(
			E('h3', [ _('Instance "%h"', 'AmneziaWG instance heading').format(instanceName) ]),
			E('p', {
				'style': 'cursor:pointer',
				'click': ui.createHandlerFn(this, handleInterfaceDetails, ifaces[instanceName])
			}, [
				E('span', { 'class': 'ifacebadge' }, [
					E('img', { 'src': L.resource('icons', 'amneziawg.svg') }),
					'\xa0',
					instanceName
				]),
				E('span', { 'style': 'opacity:.8' }, [
					' · ',
					_('Port %d', 'AmneziaWG listen port').format(ifaces[instanceName].listen_port),
					' · ',
					E('code', { 'click': '' }, [ ifaces[instanceName].public_key ])
				])
			]),
			renderPeerTable(instanceName, ifaces[instanceName].peers)
		);
	}

	if (res.length == 0)
		res.push(E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
			E('em', [ _('No AmneziaWG interfaces configured.') ])
		]));

	return E('div', { 'id': 'status-tab' }, res);
}

var diagnosticTests = [
	{ id: 'US.CF-01', provider: '🇺🇸 Cloudflare', times: 1, url: 'https://cdn.cookielaw.org/scripttemplates/202501.2.0/otBannerSdk.js' },
	{ id: 'US.CF-02', provider: '🇺🇸 Cloudflare', times: 1, url: 'https://genshin.jmp.blue/characters/all#' },
	{ id: 'US.CF-03', provider: '🇺🇸 Cloudflare', times: 1, url: 'https://api.frankfurter.dev/v1/2000-01-01..2002-12-31' },
	{ id: 'US.DO-01', provider: '🇺🇸 DigitalOcean', times: 2, url: 'https://genderize.io/' },
	{ id: 'DE.HE-01', provider: '🇩🇪 Hetzner', times: 1, url: 'https://j.dejure.org/jcg/doctrine/doctrine_banner.webp' },
	{ id: 'FI.HE-01', provider: '🇫🇮 Hetzner', times: 1, url: 'https://tcp1620-01.dubybot.live/1MB.bin' },
	{ id: 'FI.HE-02', provider: '🇫🇮 Hetzner', times: 1, url: 'https://tcp1620-02.dubybot.live/1MB.bin' },
	{ id: 'FI.HE-03', provider: '🇫🇮 Hetzner', times: 1, url: 'https://tcp1620-05.dubybot.live/1MB.bin' },
	{ id: 'FI.HE-04', provider: '🇫🇮 Hetzner', times: 1, url: 'https://tcp1620-06.dubybot.live/1MB.bin' },
	{ id: 'FR.OVH-01', provider: '🇫🇷 OVH', times: 1, url: 'https://eu.api.ovh.com/console/rapidoc-min.js' },
	{ id: 'FR.OVH-02', provider: '🇫🇷 OVH', times: 1, url: 'https://ovh.sfx.ovh/10M.bin' },
	{ id: 'SE.OR-01', provider: '🇸🇪 Oracle', times: 1, url: 'https://oracle.sfx.ovh/10M.bin' },
	{ id: 'DE.AWS-01', provider: '🇩🇪 AWS', times: 1, url: 'https://tms.delta.com/delta/dl_anderson/Bootstrap.js' },
	{ id: 'US.AWS-01', provider: '🇺🇸 AWS', times: 1, url: 'https://corp.kaltura.com/wp-content/cache/min/1/wp-content/themes/airfleet/dist/styles/theme.css' },
	{ id: 'US.GC-01', provider: '🇺🇸 Google Cloud', times: 1, url: 'https://api.usercentrics.eu/gvl/v3/en.json' },
	{ id: 'US.FST-01', provider: '🇺🇸 Fastly', times: 1, url: 'https://openoffice.apache.org/images/blog/rejected.png' },
	{ id: 'US.FST-02', provider: '🇺🇸 Fastly', times: 1, url: 'https://www.juniper.net/etc.clientlibs/juniper/clientlibs/clientlib-site/resources/fonts/lato/Lato-Regular.woff2' },
	{ id: 'PL.AKM-01', provider: '🇵🇱 Akamai', times: 1, url: 'https://www.lg.com/lg5-common-gp/library/jquery.min.js' },
	{ id: 'PL.AKM-02', provider: '🇵🇱 Akamai', times: 1, url: 'https://media-assets.stryker.com/is/image/stryker/gateway_1?$max_width_1410$' },
	{ id: 'US.CDN77-01', provider: '🇺🇸 CDN77', times: 1, url: 'https://vivaldigroup.com/wp-content/themes/vivaldi/assets/styles/main.css' }
];

var testingInProgress = false;
var testResults = {};
var httpCodes = {};
var OK_THRESHOLD_BYTES = 64 * 1024; // 64KB
var TIMEOUT_MS = 5000;

function getUniqueUrl(url) {
	return url.includes('?') ? url + '&t=' + Math.random() : url + '?t=' + Math.random();
}

function timeElapsed(t0) {
	return (performance.now() - t0).toFixed(1) + ' ms';
}

function checkDpi(test, resultElement, onComplete) {
	var t0 = performance.now();
	var testId = test.id;
	
	resultElement.innerHTML = '<span style="color: #0066cc;">⏳ Checking...</span>';
	
	var timeoutId = setTimeout(function() {
		var statusCode = httpCodes[testId];
		var reason = statusCode ? 'READ' : 'CONN';
		var duration = timeElapsed(t0);
		testResults[testId] = { status: 'detected', duration: duration, reason: reason };
		resultElement.innerHTML = '<span style="color: #cc0000;">❌ Detected' + (statusCode ? '❗' : '*❗') + '</span>';
		if (onComplete) onComplete();
	}, TIMEOUT_MS);
	
	fetch(getUniqueUrl(test.url), {
		method: 'GET',
		credentials: 'omit',
		cache: 'no-store',
		redirect: 'manual',
		keepalive: true
	}).then(function(response) {
		httpCodes[testId] = response.status;
		
		if (!response.body) {
			clearTimeout(timeoutId);
			var duration = timeElapsed(t0);
			testResults[testId] = { status: 'warning', duration: duration };
			resultElement.innerHTML = '<span style="color: #ff6600;">⚠ No stream</span>';
			if (onComplete) onComplete();
			return;
		}
		
		var reader = response.body.getReader();
		var received = 0;
		var ok = false;
		
		function readChunk() {
			reader.read().then(function(result) {
				if (result.done) {
					clearTimeout(timeoutId);
					var duration = timeElapsed(t0);
					if (!ok) {
						testResults[testId] = { status: 'warning', duration: duration };
						resultElement.innerHTML = '<span style="color: #ff6600;">⚠ Possibly detected</span>';
					}
					if (onComplete) onComplete();
					return;
				}
				
				received += result.value.byteLength;
				
				if (!ok && received >= OK_THRESHOLD_BYTES) {
					clearTimeout(timeoutId);
					reader.cancel();
					ok = true;
					var duration = timeElapsed(t0);
					testResults[testId] = { status: 'success', duration: duration };
					resultElement.innerHTML = '<span style="color: #00cc00;">✅ Not detected</span>';
					if (onComplete) onComplete();
					return;
				}
				
				readChunk();
			}).catch(function(error) {
				clearTimeout(timeoutId);
				var duration = timeElapsed(t0);
				testResults[testId] = { status: 'error', duration: duration };
				resultElement.innerHTML = '<span style="color: #cc0000;">❌ Detected</span>';
				if (onComplete) onComplete();
			});
		}
		
		readChunk();
		
	}).catch(function(error) {
		clearTimeout(timeoutId);
		var statusCode = httpCodes[testId];
		var duration = timeElapsed(t0);
		
		if (error.name === 'AbortError') {
			var reason = statusCode ? 'READ' : 'CONN';
			testResults[testId] = { status: 'detected', duration: duration, reason: reason };
			resultElement.innerHTML = '<span style="color: #cc0000;">❌ Detected' + (statusCode ? '❗' : '*❗') + '</span>';
		} else {
			testResults[testId] = { status: 'error', duration: duration };
			resultElement.innerHTML = '<span style="color: #ff6600;">⚠ Failed</span>';
		}
		if (onComplete) onComplete();
	});
}

function runAllTests() {
	if (testingInProgress) return;
	
	testingInProgress = true;
	testResults = {};
	httpCodes = {};
	
	var statusElement = document.getElementById('test-status');
	if (statusElement) {
		statusElement.innerHTML = '<span style="color: #0066cc; font-weight: bold;">⏳ Checking...</span>';
	}
	
	var resultElements = document.querySelectorAll('.diagnostic-result');
	var completedTests = 0;
	var totalTests = 0;
	
	// Подсчет общего количества тестов с учетом times
	diagnosticTests.forEach(function(test) {
		totalTests += test.times || 1;
	});
	
	var testIndex = 0;
	diagnosticTests.forEach(function(test) {
		for (var i = 0; i < (test.times || 1); i++) {
			var currentTestId = (test.times > 1) ? test.id + '@' + i : test.id;
			var currentTest = {
				id: currentTestId,
				provider: test.provider,
				url: test.url
			};
			var resultElement = resultElements[testIndex];
			
			setTimeout(function(t, el) {
				checkDpi(t, el, function() {
					completedTests++;
					if (completedTests === totalTests) {
						testingInProgress = false;
						if (statusElement) {
							var successCount = 0;
							for (var key in testResults) {
								if (testResults[key].status === 'success') {
									successCount++;
								}
							}
							statusElement.innerHTML = '<span style="color: #00cc00; font-weight: bold;">✅ Ready ⚡ (' + successCount + '/' + totalTests + ' passed)</span>';
						}
					}
				});
			}, testIndex * 300, currentTest, resultElement);
			
			testIndex++;
		}
	});
}

function renderDiagnosticsTab() {
	var testRows = [];
	
	diagnosticTests.forEach(function(test) {
		for (var i = 0; i < (test.times || 1); i++) {
			var testId = (test.times > 1) ? test.id + '@' + i : test.id;
			testRows.push(E('tr', [
				E('td', [ 
					E('strong', [ testId ])
				]),
				E('td', [ test.provider ]),
				E('td', { 'class': 'diagnostic-result' }, [ 
					E('span', { 'style': 'color: #999;' }, [ '—' ]) 
				])
			]));
		}
	});

	return E('div', { 'id': 'diagnostics-tab' }, [
		E('div', { 'class': 'cbi-section' }, [
			E('div', { 'style': 'margin-bottom: 1.5em; padding: 15px; background: #f8f8f8; border-radius: 6px;' }, [
				E('div', { 'style': 'display: flex; justify-content: space-between; align-items: center;' }, [
					E('div', [
						E('strong', { 'style': 'font-size: 16px;' }, [ _('Start Status: ') ]),
						E('span', { 'id': 'test-status', 'style': 'font-size: 16px;' }, [
							E('span', { 'style': 'color: #00cc00; font-weight: bold;' }, [ '✅ Ready ⚡' ])
						])
					]),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'style': 'padding: 10px 20px;',
						'click': runAllTests
					}, [ _('🔍 Start Testing') ])
				])
			]),
			E('h3', [ _('DPI Detection Results') ]),
			E('p', { 'style': 'margin-bottom: 1em;' }, [ 
				_('Testing connectivity to various servers to detect Deep Packet Inspection (DPI) blocking.') 
			]),
			E('div', { 'class': 'cbi-section-node' }, [
				E('table', { 'class': 'table', 'style': 'width: 100%;' }, [
					E('thead', [
						E('tr', [
							E('th', { 'style': 'width: 15%;' }, [ '#' ]),
							E('th', { 'style': 'width: 35%;' }, [ _('Provider') ]),
							E('th', { 'style': 'width: 50%;' }, [ _('DPI [tcp 16-20] Status') ])
						])
					]),
					E('tbody', testRows)
				])
			])
		]),
		E('div', { 'class': 'cbi-section', 'style': 'margin-top: 2em;' }, [
			E('h3', [ _('💡 Recommendations') ]),
			E('div', { 'class': 'cbi-section-node' }, [
				E('ul', { 'style': 'line-height: 1.8;' }, [
					E('li', [ _('✅ Not detected - Connection is working normally') ]),
					E('li', [ _('❌ Detected - DPI blocking detected, use AmneziaWG obfuscation') ]),
					E('li', [ _('⚠ Timeout - Server may be unreachable or blocked') ]),
					E('li', [ _('Configure AmneziaWG parameters: Jc, Jmin, Jmax, S1, S2, H1-H4 for better obfuscation') ])
				])
			])
		])
	]);
}

return view.extend({
	render: function() {
		var container = E('div', { 'class': 'cbi-map' }, [
			E('h2', [ _('AmneziaWG Диагностика и Статус') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Диагностика подключения и просмотр активных AmneziaWG соединений')
			])
		]);

		var tabContainer = E('div', { 'class': 'cbi-tabmenu' }, [
			E('ul', [
				E('li', { 
					'class': 'cbi-tab',
					'data-tab': 'diagnostics',
					'click': function(ev) {
						switchTab('diagnostics');
					}
				}, [
					E('a', { 'href': '#' }, [ _('Диагностика') ])
				]),
				E('li', { 
					'class': 'cbi-tab',
					'data-tab': 'status',
					'click': function(ev) {
						switchTab('status');
					}
				}, [
					E('a', { 'href': '#' }, [ _('Активные подключения') ])
				])
			])
		]);

		var contentContainer = E('div', { 'id': 'tab-content' });

		container.appendChild(tabContainer);
		container.appendChild(contentContainer);

		function switchTab(tabName) {
			// Обновляем активную вкладку
			var tabs = tabContainer.querySelectorAll('.cbi-tab');
			tabs.forEach(function(tab) {
				if (tab.getAttribute('data-tab') === tabName) {
					tab.classList.add('cbi-tab-active');
				} else {
					tab.classList.remove('cbi-tab-active');
				}
			});

			// Обновляем содержимое
			if (tabName === 'diagnostics') {
				dom.content(contentContainer, renderDiagnosticsTab());
			} else if (tabName === 'status') {
				// Загружаем данные статуса
				callgetAwgInstances().then(function(ifaces) {
					dom.content(contentContainer, renderStatusTab(ifaces));
				});
			}
		}

		// Показываем вкладку диагностики по умолчанию
		setTimeout(function() {
			switchTab('diagnostics');
		}, 100);

		// Запускаем опрос для вкладки статуса
		poll.add(function() {
			var activeTab = tabContainer.querySelector('.cbi-tab-active');
			if (activeTab && activeTab.getAttribute('data-tab') === 'status') {
				return callgetAwgInstances().then(function(ifaces) {
					var statusTab = document.getElementById('status-tab');
					if (statusTab) {
						dom.content(contentContainer, renderStatusTab(ifaces));
					}
				});
			}
			return Promise.resolve();
		}, 5);

		return container;
	},

	handleReset: null,
	handleSaveApply: null,
	handleSave: null
});
