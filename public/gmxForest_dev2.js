var gmxForest = (function (exports) {
	'use strict';

	function noop() {}

	function assign(tar, src) {
		for (var k in src) { tar[k] = src[k]; }
		return tar;
	}

	function assignTrue(tar, src) {
		for (var k in src) { tar[k] = 1; }
		return tar;
	}

	function callAfter(fn, i) {
		if (i === 0) { fn(); }
		return function () {
			if (!--i) { fn(); }
		};
	}

	function run(fn) {
		fn();
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detachNode(node) {
		node.parentNode.removeChild(node);
	}

	function destroyEach(iterations, detach) {
		for (var i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) { iterations[i].d(detach); }
		}
	}

	function createElement(name) {
		return document.createElement(name);
	}

	function createText(data) {
		return document.createTextNode(data);
	}

	function createComment() {
		return document.createComment('');
	}

	function addListener(node, event, handler, options) {
		node.addEventListener(event, handler, options);
	}

	function removeListener(node, event, handler, options) {
		node.removeEventListener(event, handler, options);
	}

	function setAttribute(node, attribute, value) {
		if (value == null) { node.removeAttribute(attribute); }
		else { node.setAttribute(attribute, value); }
	}

	function setData(text, data) {
		text.data = '' + data;
	}

	function setStyle(node, key, value) {
		node.style.setProperty(key, value);
	}

	function blankObject() {
		return Object.create(null);
	}

	function destroy(detach) {
		this.destroy = noop;
		this.fire('destroy');
		this.set = noop;

		this._fragment.d(detach !== false);
		this._fragment = null;
		this._state = {};
	}

	function _differs(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function fire(eventName, data) {
		var handlers =
			eventName in this._handlers && this._handlers[eventName].slice();
		if (!handlers) { return; }

		for (var i = 0; i < handlers.length; i += 1) {
			var handler = handlers[i];

			if (!handler.__calling) {
				try {
					handler.__calling = true;
					handler.call(this, data);
				} finally {
					handler.__calling = false;
				}
			}
		}
	}

	function flush(component) {
		component._lock = true;
		callAll(component._beforecreate);
		callAll(component._oncreate);
		callAll(component._aftercreate);
		component._lock = false;
	}

	function get() {
		return this._state;
	}

	function init(component, options) {
		component._handlers = blankObject();
		component._slots = blankObject();
		component._bind = options._bind;
		component._staged = {};

		component.options = options;
		component.root = options.root || component;
		component.store = options.store || component.root.store;

		if (!options.root) {
			component._beforecreate = [];
			component._oncreate = [];
			component._aftercreate = [];
		}
	}

	function on(eventName, handler) {
		var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
		handlers.push(handler);

		return {
			cancel: function() {
				var index = handlers.indexOf(handler);
				if (~index) { handlers.splice(index, 1); }
			}
		};
	}

	function set(newState) {
		this._set(assign({}, newState));
		if (this.root._lock) { return; }
		flush(this.root);
	}

	function _set(newState) {
		var oldState = this._state,
			changed = {},
			dirty = false;

		newState = assign(this._staged, newState);
		this._staged = {};

		for (var key in newState) {
			if (this._differs(newState[key], oldState[key])) { changed[key] = dirty = true; }
		}
		if (!dirty) { return; }

		this._state = assign(assign({}, oldState), newState);
		this._recompute(changed, this._state);
		if (this._bind) { this._bind(changed, this._state); }

		if (this._fragment) {
			this.fire("state", { changed: changed, current: this._state, previous: oldState });
			this._fragment.p(changed, this._state);
			this.fire("update", { changed: changed, current: this._state, previous: oldState });
		}
	}

	function _stage(newState) {
		assign(this._staged, newState);
	}

	function callAll(fns) {
		while (fns && fns.length) { fns.shift()(); }
	}

	function _mount(target, anchor) {
		this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
	}

	var proto = {
		destroy: destroy,
		get: get,
		fire: fire,
		on: on,
		set: set,
		_recompute: noop,
		_set: _set,
		_stage: _stage,
		_mount: _mount,
		_differs: _differs
	};

	var serverBase = window.serverBase || '//maps.kosmosnimki.ru/',
			fields = {
				report_t:	{ Name: 'report_t', ColumnSimpleType: 'String', title: 'Тип отчета', save: true, onValue: {
					'ИЛ':	{ show: ['form_rub', 'type_rub'], hide: ['reforest_t'], title: 'об использовании лесов' },
					'ВЛ':	{ hide: ['form_rub', 'type_rub'], show: ['reforest_t'], title: 'о воспроизводстве лесов' }
				}},
				company:		{ Name: 'company', ColumnSimpleType: 'String', save: true, title: 'Наименование организации'},
				region:			{ Name: 'region', ColumnSimpleType: 'String', save: true, title: 'Субъект Российской Федерации'},
				forestr:		{ Name: 'forestr', ColumnSimpleType: 'String', save: true, title: 'Лесничество'},
				subforest:		{ Name: 'subforest', ColumnSimpleType: 'String', save: true, title: 'Участковое Лесничество'},
				dacha:			{ Name: 'dacha', ColumnSimpleType: 'String', title: 'Дача'},
				kvartal:		{ Name: 'kvartal', ColumnSimpleType: 'Integer', title: 'Квартал'},
				vydel:			{ Name: 'vydel', ColumnSimpleType: 'String', title: 'Выделы'},
				delyanka:		{ Name: 'delyanka', ColumnSimpleType: 'String', title: 'Делянка'},
				form_rub:		{ Name: 'form_rub', ColumnSimpleType: 'String', save: true, title: 'Форма рубки'},
				type_rub:		{ Name: 'type_rub', ColumnSimpleType: 'String', title: 'Тип рубки'},
				reforest_t:		{ Name: 'reforest_t', ColumnSimpleType: 'String', title: 'Тип лесовосстановления'},
				year:			{ Name: 'year', ColumnSimpleType: 'String', save: true, title: 'Год'},
				area:			{ Name: 'area', ColumnSimpleType: 'Float', title: 'Площадь'},
				FRSTAT:			{ Name: 'FRSTAT', ColumnSimpleType: 'Integer', title: 'Признак отчета'},
				snap:			{ Name: 'snap', ColumnSimpleType: 'String', title: 'Привязочный ход'}
			};
	// fields = {
	// report_t:	{ Name: 'report_type', ColumnSimpleType: 'String', title: 'Тип отчета', onValue: { reportType
	// 'об использовании лесов':	{ show: ['form_rub', 'type_rub'], hide: ['reforest_type'], value: 'ИЛ' },
	// 'о воспроизводстве лесов':	{ hide: ['form_rub', 'type_rub'], show: ['reforest_type'], value: 'ВЛ' }
	// }},
	// company:	{ Name: 'company', ColumnSimpleType: 'String', title: 'Наименование организации'},
	// region:	{ Name: 'region', ColumnSimpleType: 'String', title: 'Субъект Российской Федерации'},
	// forest:	{ Name: 'forestry', ColumnSimpleType: 'String', title: 'Лесничество'}, fprestry
	// subforest:	{ Name: 'subforestry', ColumnSimpleType: 'String', title: 'Участковое Лесничество'}, subforestry
	// dacha:	{ Name: 'dacha', ColumnSimpleType: 'String', title: 'Дача'},
	// kvartal:	{ Name: 'kvartal', ColumnSimpleType: 'Integer', title: 'Квартал'},
	// vydel:	{ Name: 'vydel', ColumnSimpleType: 'String', title: 'Выделы'},
	// delyanka:	{ Name: 'delyanka', ColumnSimpleType: 'String', title: 'Делянка'},
	// form_rub:	{ Name: 'form_rub', ColumnSimpleType: 'String', title: 'Форма рубки'}, fellingForm
	// type_rub:	{ Name: 'type_rub', ColumnSimpleType: 'String', title: 'Тип рубки'}, fellingType
	// reforest_t:	{ Name: 'reforest_type', ColumnSimpleType: 'String', title: 'Тип лесовосстановления'}, reforestType
	// year:	{ Name: 'year', ColumnSimpleType: 'String', title: 'Год'},
	// area:	{ Name: 'area', ColumnSimpleType: 'Float', title: 'Площадь'},
	// FRSTAT:	{ Name: 'FRSTAT', ColumnSimpleType: 'Integer', title: 'Признак отчета'},
	// snap:	{ Name: 'snap', ColumnSimpleType: 'String', title: 'Привязочный ход'}
	// };
			// fields = {
				// report_type:	{ Name: 'report_type', ColumnSimpleType: 'String', title: 'Тип отчета', onValue: {
					// 'об использовании лесов':	{ show: ['form_rub', 'type_rub'], hide: ['reforest_type'], value: 'ИЛ' },
					// 'о воспроизводстве лесов':	{ hide: ['form_rub', 'type_rub'], show: ['reforest_type'], value: 'ВЛ' }
				// }},
				// company:		{ Name: 'company', ColumnSimpleType: 'String', title: 'Наименование организации'},
				// region:			{ Name: 'region', ColumnSimpleType: 'String', title: 'Субъект Российской Федерации'},
				// forestry:		{ Name: 'forestry', ColumnSimpleType: 'String', title: 'Лесничество'},
				// subforestry:	{ Name: 'subforestry', ColumnSimpleType: 'String', title: 'Участковое Лесничество'},
				// dacha:			{ Name: 'dacha', ColumnSimpleType: 'String', title: 'Дача'},
				// kvartal:		{ Name: 'kvartal', ColumnSimpleType: 'Integer', title: 'Квартал'},
				// vydel:			{ Name: 'vydel', ColumnSimpleType: 'String', title: 'Выделы'},
				// delyanka:		{ Name: 'delyanka', ColumnSimpleType: 'String', title: 'Делянка'},
				// form_rub:		{ Name: 'form_rub', ColumnSimpleType: 'String', title: 'Форма рубки'},
				// type_rub:		{ Name: 'type_rub', ColumnSimpleType: 'String', title: 'Тип рубки'},
				// reforest_type:	{ Name: 'reforest_type', ColumnSimpleType: 'String', title: 'Тип лесовосстановления'},
				// year:			{ Name: 'year', ColumnSimpleType: 'String', title: 'Год'},
				// area:			{ Name: 'area', ColumnSimpleType: 'Float', title: 'Площадь'},
				// FRSTAT:			{ Name: 'FRSTAT', ColumnSimpleType: 'Integer', title: 'Признак отчета'},
				// snap:			{ Name: 'snap', ColumnSimpleType: 'String', title: 'Привязочный ход'}
			// };

	var fieldsConf = fields;

	/*jslint plusplus:true */
	function Geomag(model) {
		var wmm,
			maxord = 12,
			a = 6378.137,		// WGS 1984 Equatorial axis (km)
			b = 6356.7523142,	// WGS 1984 Polar axis (km)
			re = 6371.2,
			a2 = a * a,
			b2 = b * b,
			c2 = a2 - b2,
			a4 = a2 * a2,
			b4 = b2 * b2,
			c4 = a4 - b4,
			z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			unnormalizedWMM;

		function parseCof(cof) {
			wmm = (function (cof) {
				var modelLines = cof.split('\n'), wmm = [], i, vals, epoch, model, modelDate;
				for (i in modelLines) {
					if (modelLines.hasOwnProperty(i)) {
						vals = modelLines[i].replace(/^\s+|\s+$/g, "").split(/\s+/);
						if (vals.length === 3) {
							epoch = parseFloat(vals[0]);
							model = vals[1];
							modelDate = vals[2];
						} else if (vals.length === 6) {
							wmm.push({
								n: parseInt(vals[0], 10),
								m: parseInt(vals[1], 10),
								gnm: parseFloat(vals[2]),
								hnm: parseFloat(vals[3]),
								dgnm: parseFloat(vals[4]),
								dhnm: parseFloat(vals[5])
							});
						}
					}
				}

				return {epoch: epoch, model: model, modelDate: modelDate, wmm: wmm};
			}(cof));
		}

		function unnormalize(wmm) {
			var i, j, m, n, D2, flnmj,
				c = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				cd = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				k = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				snorm = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice()],
				model = wmm.wmm;
			for (i in model) {
				if (model.hasOwnProperty(i)) {
					if (model[i].m <= model[i].n) {
						c[model[i].m][model[i].n] = model[i].gnm;
						cd[model[i].m][model[i].n] = model[i].dgnm;
						if (model[i].m !== 0) {
							c[model[i].n][model[i].m - 1] = model[i].hnm;
							cd[model[i].n][model[i].m - 1] = model[i].dhnm;
						}
					}
				}
			}
			/* CONVERT SCHMIDT NORMALIZED GAUSS COEFFICIENTS TO UNNORMALIZED */
			snorm[0][0] = 1;

			for (n = 1; n <= maxord; n++) {
				snorm[0][n] = snorm[0][n - 1] * (2 * n - 1) / n;
				j = 2;

				for (m = 0, D2 = (n - m + 1); D2 > 0; D2--, m++) {
					k[m][n] = (((n - 1) * (n - 1)) - (m * m)) /
						((2 * n - 1) * (2 * n - 3));
					if (m > 0) {
						flnmj = ((n - m + 1) * j) / (n + m);
						snorm[m][n] = snorm[m - 1][n] * Math.sqrt(flnmj);
						j = 1;
						c[n][m - 1] = snorm[m][n] * c[n][m - 1];
						cd[n][m - 1] = snorm[m][n] * cd[n][m - 1];
					}
					c[m][n] = snorm[m][n] * c[m][n];
					cd[m][n] = snorm[m][n] * cd[m][n];
				}
			}
			k[1][1] = 0.0;

			unnormalizedWMM = {epoch: wmm.epoch, k: k, c: c, cd: cd};
		}

		this.setCof = function (cof) {
			parseCof(cof);
			unnormalize(wmm);
		};
		this.getWmm = function () {
			return wmm;
		};
		this.setUnnorm = function (val) {
			unnormalizedWMM = val;
		};
		this.getUnnorm = function () {
			return unnormalizedWMM;
		};
		this.getEpoch = function () {
			return unnormalizedWMM.epoch;
		};
		this.setEllipsoid = function (e) {
			a = e.a;
			b = e.b;
			re = 6371.2;
			a2 = a * a;
			b2 = b * b;
			c2 = a2 - b2;
			a4 = a2 * a2;
			b4 = b2 * b2;
			c4 = a4 - b4;
		};
		this.getEllipsoid = function () {
			return {a: a, b: b};
		};
		this.calculate = function (glat, glon, h, date) {
			if (unnormalizedWMM === undefined) {
				throw new Error("A World Magnetic Model has not been set.")
			}
			if (glat === undefined || glon === undefined) {
				throw new Error("Latitude and longitude are required arguments.");
			}
			function rad2deg(rad) {
				return rad * (180 / Math.PI);
			}
			function deg2rad(deg) {
				return deg * (Math.PI / 180);
			}
			function decimalDate(date) {
				date = date || new Date();
				var year = date.getFullYear(),
					daysInYear = 365 +
						(((year % 400 === 0) || (year % 4 === 0 && (year % 100 > 0))) ? 1 : 0),
					msInYear = daysInYear * 24 * 60 * 60 * 1000;

				return date.getFullYear() + (date.valueOf() - (new Date(year, 0)).valueOf()) / msInYear;
			}

			var epoch = unnormalizedWMM.epoch,
				k = unnormalizedWMM.k,
				c = unnormalizedWMM.c,
				cd = unnormalizedWMM.cd,
				alt = (h / 3280.8399) || 0, // convert h (in feet) to kilometers (default, 0 km)
				dt = decimalDate(date) - epoch,
				rlat = deg2rad(glat),
				rlon = deg2rad(glon),
				srlon = Math.sin(rlon),
				srlat = Math.sin(rlat),
				crlon = Math.cos(rlon),
				crlat = Math.cos(rlat),
				srlat2 = srlat * srlat,
				crlat2 = crlat * crlat,
				q,
				q1,
				q2,
				ct,
				st,
				r2,
				r,
				d,
				ca,
				sa,
				aor,
				ar,
				br = 0.0,
				bt = 0.0,
				bp = 0.0,
				bpp = 0.0,
				par,
				temp1,
				temp2,
				parp,
				D4,
				m,
				n,
				fn = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
				fm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
				z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				tc = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				sp = z.slice(),
				cp = z.slice(),
				pp = z.slice(),
				p = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				dp = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				bx,
				by,
				bz,
				bh,
				ti,
				dec,
				dip,
				gv;
			sp[0] = 0.0;
			sp[1] = srlon;
			cp[1] = crlon;
			tc[0][0] = 0;
			cp[0] = 1.0;
			pp[0] = 1.0;
			p[0][0] = 1;

			/* CONVERT FROM GEODETIC COORDS. TO SPHERICAL COORDS. */
			q = Math.sqrt(a2 - c2 * srlat2);
			q1 = alt * q;
			q2 = ((q1 + a2) / (q1 + b2)) * ((q1 + a2) / (q1 + b2));
			ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
			st = Math.sqrt(1.0 - (ct * ct));
			r2 = (alt * alt) + 2.0 * q1 + (a4 - c4 * srlat2) / (q * q);
			r = Math.sqrt(r2);
			d = Math.sqrt(a2 * crlat2 + b2 * srlat2);
			ca = (alt + d) / r;
			sa = c2 * crlat * srlat / (r * d);

			for (m = 2; m <= maxord; m++) {
				sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
				cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
			}

			aor = re / r;
			ar = aor * aor;

			for (n = 1; n <= maxord; n++) {
				ar = ar * aor;
				for (m = 0, D4 = (n + m + 1); D4 > 0; D4--, m++) {

			/*
					COMPUTE UNNORMALIZED ASSOCIATED LEGENDRE POLYNOMIALS
					AND DERIVATIVES VIA RECURSION RELATIONS
			*/
					if (n === m) {
						p[m][n] = st * p[m - 1][n - 1];
						dp[m][n] = st * dp[m - 1][n - 1] + ct *
							p[m - 1][n - 1];
					} else if (n === 1 && m === 0) {
						p[m][n] = ct * p[m][n - 1];
						dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1];
					} else if (n > 1 && n !== m) {
						if (m > n - 2) { p[m][n - 2] = 0; }
						if (m > n - 2) { dp[m][n - 2] = 0.0; }
						p[m][n] = ct * p[m][n - 1] - k[m][n] * p[m][n - 2];
						dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1] -
							k[m][n] * dp[m][n - 2];
					}

			/*
					TIME ADJUST THE GAUSS COEFFICIENTS
			*/

					tc[m][n] = c[m][n] + dt * cd[m][n];
					if (m !== 0) {
						tc[n][m - 1] = c[n][m - 1] + dt * cd[n][m - 1];
					}

			/*
					ACCUMULATE TERMS OF THE SPHERICAL HARMONIC EXPANSIONS
			*/
					par = ar * p[m][n];
					if (m === 0) {
						temp1 = tc[m][n] * cp[m];
						temp2 = tc[m][n] * sp[m];
					} else {
						temp1 = tc[m][n] * cp[m] + tc[n][m - 1] * sp[m];
						temp2 = tc[m][n] * sp[m] - tc[n][m - 1] * cp[m];
					}
					bt = bt - ar * temp1 * dp[m][n];
					bp += (fm[m] * temp2 * par);
					br += (fn[n] * temp1 * par);
			/*
						SPECIAL CASE:  NORTH/SOUTH GEOGRAPHIC POLES
			*/
					if (st === 0.0 && m === 1) {
						if (n === 1) {
							pp[n] = pp[n - 1];
						} else {
							pp[n] = ct * pp[n - 1] - k[m][n] * pp[n - 2];
						}
						parp = ar * pp[n];
						bpp += (fm[m] * temp2 * parp);
					}
				}
			}

			bp = (st === 0.0 ? bpp : bp / st);
			/*
				ROTATE MAGNETIC VECTOR COMPONENTS FROM SPHERICAL TO
				GEODETIC COORDINATES
			*/
			bx = -bt * ca - br * sa;
			by = bp;
			bz = bt * sa - br * ca;

			/*
				COMPUTE DECLINATION (DEC), INCLINATION (DIP) AND
				TOTAL INTENSITY (TI)
			*/
			bh = Math.sqrt((bx * bx) + (by * by));
			ti = Math.sqrt((bh * bh) + (bz * bz));
			dec = rad2deg(Math.atan2(by, bx));
			dip = rad2deg(Math.atan2(bz, bh));

			/*
				COMPUTE MAGNETIC GRID VARIATION IF THE CURRENT
				GEODETIC POSITION IS IN THE ARCTIC OR ANTARCTIC
				(I.E. GLAT > +55 DEGREES OR GLAT < -55 DEGREES)
				OTHERWISE, SET MAGNETIC GRID VARIATION TO -999.0
			*/

			if (Math.abs(glat) >= 55.0) {
				if (glat > 0.0 && glon >= 0.0) {
					gv = dec - glon;
				} else if (glat > 0.0 && glon < 0.0) {
					gv = dec + Math.abs(glon);
				} else if (glat < 0.0 && glon >= 0.0) {
					gv = dec + glon;
				} else if (glat < 0.0 && glon < 0.0) {
					gv = dec - Math.abs(glon);
				}
				if (gv > 180.0) {
					gv -= 360.0;
				} else if (gv < -180.0) { gv += 360.0; }
			}

			return {dec: dec, dip: dip, ti: ti, bh: bh, bx: bx, by: by, bz: bz, lat: glat, lon: glon, gv: gv};
		};
		this.calc = this.calculate;
		this.mag = this.calculate;

		if (model !== undefined) { // initialize
			if (typeof model === 'string') { // WMM.COF file
				parseCof(model);
				unnormalize(wmm);
			} else if (typeof model === 'object') { // unnorm obj
				this.setUnnorm(model);
			} else {
				throw new Error("Invalid argument type");
			}
		}
	}

	var cof = "\n    2010.0            WMM-2010        11/20/2009\n  1  0  -29496.6       0.0       11.6        0.0\n  1  1   -1586.3    4944.4       16.5      -25.9\n  2  0   -2396.6       0.0      -12.1        0.0\n  2  1    3026.1   -2707.7       -4.4      -22.5\n  2  2    1668.6    -576.1        1.9      -11.8\n  3  0    1340.1       0.0        0.4        0.0\n  3  1   -2326.2    -160.2       -4.1        7.3\n  3  2    1231.9     251.9       -2.9       -3.9\n  3  3     634.0    -536.6       -7.7       -2.6\n  4  0     912.6       0.0       -1.8        0.0\n  4  1     808.9     286.4        2.3        1.1\n  4  2     166.7    -211.2       -8.7        2.7\n  4  3    -357.1     164.3        4.6        3.9\n  4  4      89.4    -309.1       -2.1       -0.8\n  5  0    -230.9       0.0       -1.0        0.0\n  5  1     357.2      44.6        0.6        0.4\n  5  2     200.3     188.9       -1.8        1.8\n  5  3    -141.1    -118.2       -1.0        1.2\n  5  4    -163.0       0.0        0.9        4.0\n  5  5      -7.8     100.9        1.0       -0.6\n  6  0      72.8       0.0       -0.2        0.0\n  6  1      68.6     -20.8       -0.2       -0.2\n  6  2      76.0      44.1       -0.1       -2.1\n  6  3    -141.4      61.5        2.0       -0.4\n  6  4     -22.8     -66.3       -1.7       -0.6\n  6  5      13.2       3.1       -0.3        0.5\n  6  6     -77.9      55.0        1.7        0.9\n  7  0      80.5       0.0        0.1        0.0\n  7  1     -75.1     -57.9       -0.1        0.7\n  7  2      -4.7     -21.1       -0.6        0.3\n  7  3      45.3       6.5        1.3       -0.1\n  7  4      13.9      24.9        0.4       -0.1\n  7  5      10.4       7.0        0.3       -0.8\n  7  6       1.7     -27.7       -0.7       -0.3\n  7  7       4.9      -3.3        0.6        0.3\n  8  0      24.4       0.0       -0.1        0.0\n  8  1       8.1      11.0        0.1       -0.1\n  8  2     -14.5     -20.0       -0.6        0.2\n  8  3      -5.6      11.9        0.2        0.4\n  8  4     -19.3     -17.4       -0.2        0.4\n  8  5      11.5      16.7        0.3        0.1\n  8  6      10.9       7.0        0.3       -0.1\n  8  7     -14.1     -10.8       -0.6        0.4\n  8  8      -3.7       1.7        0.2        0.3\n  9  0       5.4       0.0       -0.0        0.0\n  9  1       9.4     -20.5       -0.1       -0.0\n  9  2       3.4      11.5        0.0       -0.2\n  9  3      -5.2      12.8        0.3        0.0\n  9  4       3.1      -7.2       -0.4       -0.1\n  9  5     -12.4      -7.4       -0.3        0.1\n  9  6      -0.7       8.0        0.1       -0.0\n  9  7       8.4       2.1       -0.1       -0.2\n  9  8      -8.5      -6.1       -0.4        0.3\n  9  9     -10.1       7.0       -0.2        0.2\n 10  0      -2.0       0.0        0.0        0.0\n 10  1      -6.3       2.8       -0.0        0.1\n 10  2       0.9      -0.1       -0.1       -0.1\n 10  3      -1.1       4.7        0.2        0.0\n 10  4      -0.2       4.4       -0.0       -0.1\n 10  5       2.5      -7.2       -0.1       -0.1\n 10  6      -0.3      -1.0       -0.2       -0.0\n 10  7       2.2      -3.9        0.0       -0.1\n 10  8       3.1      -2.0       -0.1       -0.2\n 10  9      -1.0      -2.0       -0.2        0.0\n 10 10      -2.8      -8.3       -0.2       -0.1\n 11  0       3.0       0.0        0.0        0.0\n 11  1      -1.5       0.2        0.0       -0.0\n 11  2      -2.1       1.7       -0.0        0.1\n 11  3       1.7      -0.6        0.1        0.0\n 11  4      -0.5      -1.8       -0.0        0.1\n 11  5       0.5       0.9        0.0        0.0\n 11  6      -0.8      -0.4       -0.0        0.1\n 11  7       0.4      -2.5       -0.0        0.0\n 11  8       1.8      -1.3       -0.0       -0.1\n 11  9       0.1      -2.1        0.0       -0.1\n 11 10       0.7      -1.9       -0.1       -0.0\n 11 11       3.8      -1.8       -0.0       -0.1\n 12  0      -2.2       0.0       -0.0        0.0\n 12  1      -0.2      -0.9        0.0       -0.0\n 12  2       0.3       0.3        0.1        0.0\n 12  3       1.0       2.1        0.1       -0.0\n 12  4      -0.6      -2.5       -0.1        0.0\n 12  5       0.9       0.5       -0.0       -0.0\n 12  6      -0.1       0.6        0.0        0.1\n 12  7       0.5      -0.0        0.0        0.0\n 12  8      -0.4       0.1       -0.0        0.0\n 12  9      -0.4       0.3        0.0       -0.0\n 12 10       0.2      -0.9        0.0       -0.0\n 12 11      -0.8      -0.2       -0.1        0.0\n 12 12       0.0       0.9        0.1        0.0\n999999999999999999999999999999999999999999999999\n999999999999999999999999999999999999999999999999\n";
	var geoMag = new Geomag(cof).mag;

	var serverBase$1 = window.serverBase || '//maps.kosmosnimki.ru/';
	var ext = {
		_gtxt: window._gtxt,
		// _mapHelper: window._mapHelper,
		_queryMapLayers: window._queryMapLayers,
		nsGmx: window.nsGmx
	};

	var _getParentByClassName = function (node, name) {
		while(node) {
			if (node.classList && node.classList.contains(name)) {
				return node;
			}
			node = node.parentNode;
		}
		return null;
	};

	var _getFirstChildByClassName = function (node, name) {
		if (node) {
			for (var i = 0, len = node.childNodes.length; i < len; i++) {
				var pn = node.childNodes[i];
				if (pn.classList && pn.classList.contains(name)) {
					return pn;
				}
				pn = _getFirstChildByClassName(pn, name);
				if (pn) {
					return pn;
				}
			}
		}
		return null;
	};

	var _chkHiddenFields = function (key, str, node) {
		var prnt = _getParentByClassName(node, 'edit-obj'),
			pars = fields[key];

		pars.onValue[str].show.forEach(function (it) {
			var pn = _getFirstChildByClassName(prnt, 'field-name-' + it);
			if (pn && pn.classList) { pn.classList.remove('hidden'); }
		});
		pars.onValue[str].hide.forEach(function (it) {
			var pn = _getFirstChildByClassName(prnt, 'field-name-' + it);
			if (pn && pn.classList) { pn.classList.add('hidden'); }
		});
	};

	var _getFieldsTitle = function (params) {
		var fields$$1 = params.fields || [],
			dFields = params.dFields || {},
			hashCols = params.hashCols || {},
			kvKey = hashCols['Квартал'] ? 'Квартал' : (hashCols.kv ? 'kv' : 'kvartal'),
			skipKeys = fields$$1.reduce(function (a, v) { a[v.name] = true; return a; }, {});

		Object.keys(hashCols).map(function (fk) {
			if (fk !== 'geomixergeojson' && fk !== 'gmx_id' && !(fk in skipKeys)) {
				var keyHash = fields[fk],
					title = keyHash ? keyHash.title : '',
					out = { name: fk };

				if (title) {
					out.title = title;
				}
				if (dFields[fk]) {
					out.value = dFields[fk];
				}
				if (params.del) {
					out.hide = true;
				} else if (fk === 'FRSTAT') {
					out = {name: fk, hide: true, value: 0};
				} else if (fk === 'snap') {
					out = {name: fk, hide: true, value: params.snap || ''};
				} else if (fk === 'report_t') {
					fields$$1.push({ name: fk, hide: true });

					delete out.name;

					out.isRequired = true;
					out.view = {
						getUI: function(editDialog) {
							var select = L.DomUtil.create('select', 'gmxForest-selectItem selectStyle');
	                        var opt = L.DomUtil.create('option', '', select);
	                        opt.setAttribute('id', 0);
	                        opt.text = 'об использовании лесов';
							if (out.value === opt.text) {
								//opt.setAttribute('checked', true);
								select.options.selectedIndex = 0;
							}

							opt = L.DomUtil.create('option', '', select);
	                        opt.setAttribute('id', 1);
	                        opt.text = 'о воспроизводстве лесов';
							if (out.value === opt.text) {
								// opt.checked = true;
								select.options.selectedIndex = 1;
							}

							if (out.value) {
								setTimeout(function() {editDialog.set(fk, out.value);}, 0);
							}
							select.onchange = function() {
								var str = select.options[select.options.selectedIndex].text;
								// console.log('ssssssssss', str, editDialog);
								editDialog.set(fk, str);
								_chkHiddenFields(fk, str, select);
							};
							// setTimeout(_chkHiddenFields(fk, select.options[select.options.selectedIndex].text, select), 1200);
							return select;
						}
					};

				} else if (fk === kvKey && params.kvartal) {
					out.value = params.kvartal;
				}
				fields$$1.push(out);
			}
		});
		return fields$$1;
	};

	var editObject = function (layerId, objectId, params) {
		params.fields = _getFieldsTitle(params);

		var editControl = new window.nsGmx.EditObjectControl(layerId, objectId, params);
		editControl.initPromise.then(function(pNode) {
			 // console.log('editObject1', pNode, editControl);
			_chkHiddenFields('report_t', 'ИЛ', pNode);
			if (pNode && params.del) {
				var node = pNode.getElementsByClassName('obj-edit-canvas')[0];
				if (node) { pNode.parentNode.style.height = node.style.height = 'auto'; }
			}

		});
		return editControl;
	};

	var saveLayer = function (properties) {
		var layerProperties = new nsGmx.LayerProperties();
		layerProperties.initFromViewer('Vector', null, properties);

		return layerProperties.save().then(function(response) {
			if (response.Result) {
				var props = response.Result.properties;
				window._layersTree.addLayerToTree(props.name);
				setTimeout(ext._queryMapLayers.saveMap, 1000);
				return props;
			}
		});
	};

	var createLayer = function (flag) {
		var prnt = nsGmx.Utils._div(null, [['attr','id','new' + 'Vector' + 'Layer'], ['css', 'height', '100%']]),
			dialogDiv = nsGmx.Utils.showDialog(flag ? 'Создать слой квартальной сети' : 'Создать группу делянок', prnt, 340, 340, false, false);

		return nsGmx.createLayerEditor(false, 'Vector', prnt, {}, {
			doneCallback: function(res) {
				res.then(function (json) {
					ext._queryMapLayers.saveMap();
				});
				ext.nsGmx.Utils.removeDialog(dialogDiv);
			}
		});

	};

	var editLayer = function (layerId) {
		window._mapHelper.createLayerEditor(layerId, 'Vector', undefined, nsGmx.gmxMap.layersByID[layerId].getGmxProperties());
	};

	/* src\Popup.html generated by Svelte v2.16.1 */

	function latlng(ref) {
		var geoJson = ref.geoJson;

		return geoJson.coordinates[0][0];
	}

	function data() {
		return {
			getReverse: null,
			standart: '',
			ring: [],
			tab: 2
		}
	}
	var methods = {
		toggleTab: function toggleTab(tab) {
			if (tab === 1) {
				this.nextPoint(ev.target, true);
			}
		},
		reverse: function reverse(tab) {
			var ref = this.get();
			var getReverse = ref.getReverse;
			this.set({ring: getReverse()});
			// console.log('ring', ring, geoJson);
		}
	};

	function get_each_context(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		child_ctx.i = i;
		return child_ctx;
	}

	function create_main_fragment(component, ctx) {
		var div13, div0, text0, div12, ul, li0, a0, text1, a0_class_value, text2, li1, a1, text3, a1_class_value, text4, div11, div8, div7, div2, text6, div3, input0, input0_value_value, text7, input1, input1_value_value, text8, div6, div4, text10, div5, button, text12, div8_class_value, text13, div10, div9, div10_class_value, current;

		function click_handler(event) {
			component.set({tab: 2});
		}

		function click_handler_1(event) {
			component.set({tab: 1});
		}

		function click_handler_2(event) {
			component.reverse();
		}

		var if_block = (ctx.ring) && create_if_block(component, ctx);

		return {
			c: function c() {
				div13 = createElement("div");
				div0 = createElement("div");
				text0 = createText("\r\n\t");
				div12 = createElement("div");
				ul = createElement("ul");
				li0 = createElement("li");
				a0 = createElement("a");
				text1 = createText("Информация");
				text2 = createText("\r\n\t\t  ");
				li1 = createElement("li");
				a1 = createElement("a");
				text3 = createText("Контур делянки");
				text4 = createText("\r\n\t   ");
				div11 = createElement("div");
				div8 = createElement("div");
				div7 = createElement("div");
				div2 = createElement("div");
				div2.innerHTML = "<div class=\"pop_ro_title_left svelte-l5keil\">Координаты привязочной точки</div>";
				text6 = createText("\r\n\t\t\t\t");
				div3 = createElement("div");
				input0 = createElement("input");
				text7 = createText("\r\n\t\t\t\t   ");
				input1 = createElement("input");
				text8 = createText("\r\n\t\t\t\t");
				div6 = createElement("div");
				div4 = createElement("div");
				div4.textContent = "Контур делянки";
				text10 = createText("\r\n\t\t\t\t\t");
				div5 = createElement("div");
				button = createElement("button");
				button.textContent = "(Поменять порядок обхода)";
				text12 = createText("\r\n\t");
				if (if_block) { if_block.c(); }
				text13 = createText("\r\n\t\t  ");
				div10 = createElement("div");
				div9 = createElement("div");
				div0.className = "pop_title edit svelte-l5keil";
				a0.className = a0_class_value = "nav-link mi " + (ctx.tab === 2 ? 'active' : '') + " svelte-l5keil";
				a0.href = "#tab2";
				a0.dataset.toggle = "tab";
				setAttribute(a0, "aria-expanded", "false");
				addListener(li0, "click", click_handler);
				li0.className = "nav-item edit svelte-l5keil";
				a1.className = a1_class_value = "nav-link mi " + (ctx.tab === 1 ? 'active' : '') + " svelte-l5keil";
				a1.href = "#tab1";
				a1.dataset.toggle = "tab";
				setAttribute(a1, "aria-expanded", "true");
				addListener(li1, "click", click_handler_1);
				li1.className = "nav-item edit svelte-l5keil";
				ul.className = "nav nav-tabs svelte-l5keil";
				div2.className = "pop_ro_title svelte-l5keil";
				input0.className = "inp_pop_mini svelte-l5keil";
				input0.placeholder = "lat";
				input0.value = input0_value_value = ctx.latlng[1];
				input0.disabled = true;
				input1.className = "inp_pop_mini svelte-l5keil";
				input1.placeholder = "long";
				input1.value = input1_value_value = ctx.latlng[0];
				input1.disabled = true;
				div3.className = "pop_ro pop_ro_radio_input svelte-l5keil";
				div4.className = "pop_ro_title_left svelte-l5keil";
				addListener(button, "click", click_handler_2);
				button.className = "gmx-sidebar-button svelte-l5keil";
				div5.className = "gmx-geometry-select-container svelte-l5keil";
				div6.className = "pop_ro_title svelte-l5keil";
				div7.className = "scrollbar scrolly svelte-l5keil";
				div8.className = div8_class_value = "tab-pane active tab1 " + (ctx.tab === 2 ? 'disabled' : '') + " svelte-l5keil";
				setAttribute(div8, "aria-expanded", "true");
				div9.className = "scrollbar scrolly svelte-l5keil";
				div9.id = "style-4";
				div10.className = div10_class_value = "tab-pane " + (ctx.tab === 1 ? 'disabled' : '') + " tab2" + " svelte-l5keil";
				setAttribute(div10, "aria-expanded", "false");
				div11.className = "tab-content svelte-l5keil";
				div12.className = "tabbable svelte-l5keil";
				div12.id = "tabs-440015";
				div13.className = "main_pop_cont_2 svelte-l5keil";
			},

			m: function m(target, anchor) {
				insert(target, div13, anchor);
				append(div13, div0);
				append(div13, text0);
				append(div13, div12);
				append(div12, ul);
				append(ul, li0);
				append(li0, a0);
				append(a0, text1);
				append(ul, text2);
				append(ul, li1);
				append(li1, a1);
				append(a1, text3);
				append(div12, text4);
				append(div12, div11);
				append(div11, div8);
				append(div8, div7);
				append(div7, div2);
				append(div7, text6);
				append(div7, div3);
				append(div3, input0);
				append(div3, text7);
				append(div3, input1);
				append(div7, text8);
				append(div7, div6);
				append(div6, div4);
				append(div6, text10);
				append(div6, div5);
				append(div5, button);
				append(div7, text12);
				if (if_block) { if_block.m(div7, null); }
				component.refs.tab1 = div8;
				append(div11, text13);
				append(div11, div10);
				append(div10, div9);
				div9.innerHTML = ctx.standart;
				component.refs.tab2 = div10;
				current = true;
			},

			p: function p(changed, ctx) {
				if ((changed.tab) && a0_class_value !== (a0_class_value = "nav-link mi " + (ctx.tab === 2 ? 'active' : '') + " svelte-l5keil")) {
					a0.className = a0_class_value;
				}

				if ((changed.tab) && a1_class_value !== (a1_class_value = "nav-link mi " + (ctx.tab === 1 ? 'active' : '') + " svelte-l5keil")) {
					a1.className = a1_class_value;
				}

				if ((changed.latlng) && input0_value_value !== (input0_value_value = ctx.latlng[1])) {
					input0.value = input0_value_value;
				}

				if ((changed.latlng) && input1_value_value !== (input1_value_value = ctx.latlng[0])) {
					input1.value = input1_value_value;
				}

				if (ctx.ring) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block(component, ctx);
						if_block.c();
						if_block.m(div7, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if ((changed.tab) && div8_class_value !== (div8_class_value = "tab-pane active tab1 " + (ctx.tab === 2 ? 'disabled' : '') + " svelte-l5keil")) {
					div8.className = div8_class_value;
				}

				if (changed.standart) {
					div9.innerHTML = ctx.standart;
				}

				if ((changed.tab) && div10_class_value !== (div10_class_value = "tab-pane " + (ctx.tab === 1 ? 'disabled' : '') + " tab2" + " svelte-l5keil")) {
					div10.className = div10_class_value;
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: run,

			d: function d(detach) {
				if (detach) {
					detachNode(div13);
				}

				removeListener(li0, "click", click_handler);
				removeListener(li1, "click", click_handler_1);
				removeListener(button, "click", click_handler_2);
				if (if_block) { if_block.d(); }
				if (component.refs.tab1 === div8) { component.refs.tab1 = null; }
				if (component.refs.tab2 === div10) { component.refs.tab2 = null; }
			}
		};
	}

	// (57:1) {#if ring}
	function create_if_block(component, ctx) {
		var each_anchor;

		var each_value = ctx.ring;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(component, get_each_context(ctx, each_value, i));
		}

		return {
			c: function c() {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_anchor = createComment();
			},

			m: function m(target, anchor) {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if (changed.Math || changed.ring) {
					each_value = ctx.ring;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_anchor.parentNode, each_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function d(detach) {
				destroyEach(each_blocks, detach);

				if (detach) {
					detachNode(each_anchor);
				}
			}
		};
	}

	// (58:2) {#each ring as it, i}
	function create_each_block(component, ctx) {
		var div1, div0, text0_value = ctx.i + 0, text0, text1, text2_value = ctx.i === ctx.ring.length - 1 ? 0 : ctx.i + 1, text2, text3, input0, input0_value_value, text4, input1, input1_value_value;

		return {
			c: function c() {
				div1 = createElement("div");
				div0 = createElement("div");
				text0 = createText(text0_value);
				text1 = createText("-");
				text2 = createText(text2_value);
				text3 = createText("\r\n\t\t\t");
				input0 = createElement("input");
				text4 = createText("\r\n\t\t\t-\r\n\t\t\t");
				input1 = createElement("input");
				div0.className = "pop_ro_title_left svelte-l5keil";
				input0.name = "ring" + ctx.i + "_a";
				input0.value = input0_value_value = ctx.it[0];
				input0.className = "inp_pop_mini_m svelte-l5keil";
				input0.disabled = true;
				input1.name = "ring" + ctx.i + "_d";
				input1.value = input1_value_value = ctx.Math.round(ctx.it[1]);
				input1.className = "inp_pop_mini_m svelte-l5keil";
				input1.placeholder = "Distance";
				setAttribute(input1, "type", "number");
				input1.min = "0";
				input1.step = "1";
				input1.disabled = true;
				div1.className = "pop_ro ring ring" + ctx.i + " svelte-l5keil";
			},

			m: function m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div0, text0);
				append(div0, text1);
				append(div0, text2);
				append(div1, text3);
				append(div1, input0);
				append(div1, text4);
				append(div1, input1);
			},

			p: function p(changed, ctx) {
				if ((changed.ring) && text2_value !== (text2_value = ctx.i === ctx.ring.length - 1 ? 0 : ctx.i + 1)) {
					setData(text2, text2_value);
				}

				if ((changed.ring) && input0_value_value !== (input0_value_value = ctx.it[0])) {
					input0.value = input0_value_value;
				}

				if ((changed.Math || changed.ring) && input1_value_value !== (input1_value_value = ctx.Math.round(ctx.it[1]))) {
					input1.value = input1_value_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div1);
				}
			}
		};
	}

	function Popup(options) {
		init(this, options);
		this.refs = {};
		this._state = assign(assign({ Math : Math }, data()), options.data);

		this._recompute({ geoJson: 1 }, this._state);
		this._intro = !!options.intro;

		this._fragment = create_main_fragment(this, this._state);

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}

		this._intro = true;
	}

	assign(Popup.prototype, proto);
	assign(Popup.prototype, methods);

	Popup.prototype._recompute = function _recompute(changed, state) {
		if (changed.geoJson) {
			if (this._differs(state.latlng, (state.latlng = latlng(state)))) { changed.latlng = true; }
		}
	};

	var	serverBase$2 = window.serverBase || '//maps.kosmosnimki.ru/',
			serverProxy$1 = serverBase$2 + 'Plugins/ForestReport/proxy';
			// ,
			// fields = {
				// report_type:	{ Name: 'report_type', ColumnSimpleType: 'String', title: 'Тип отчета'},
				// company:		{ Name: 'company', ColumnSimpleType: 'String', title: 'Наименование организации'},
				// region:			{ Name: 'region', ColumnSimpleType: 'String', title: 'Субъект Российской Федерации'},
				// forestry:		{ Name: 'forestry', ColumnSimpleType: 'String', title: 'Лесничество'},
				// subforestry:	{ Name: 'subforestry', ColumnSimpleType: 'String', title: 'Участковое Лесничество'},
				// dacha:			{ Name: 'dacha', ColumnSimpleType: 'String', title: 'Дача'},
				// kvartal:		{ Name: 'kvartal', ColumnSimpleType: 'Integer', title: 'Квартал'},
				// vydel:			{ Name: 'vydel', ColumnSimpleType: 'String', title: 'Выделы'},
				// delyanka:		{ Name: 'delyanka', ColumnSimpleType: 'String', title: 'Делянка'},
				// form_rub:		{ Name: 'form_rub', ColumnSimpleType: 'String', title: 'Форма рубки'},
				// type_rub:		{ Name: 'type_rub', ColumnSimpleType: 'String', title: 'Тип рубки'},
				// reforest_type:	{ Name: 'reforest_type', ColumnSimpleType: 'String', title: 'Тип лесовосстановления'},
				// year:			{ Name: 'year', ColumnSimpleType: 'String', title: 'Год'},
				// area:			{ Name: 'area', ColumnSimpleType: 'Float', title: 'Площадь'},
				// FRSTAT:			{ Name: 'FRSTAT', ColumnSimpleType: 'Integer', title: 'Признак отчета'},
				// snap:			{ Name: 'snap', ColumnSimpleType: 'String', title: 'Привязочный ход'}
			// },
			// cols = Object.keys(fields).map((key) => {
				// return {
					// Name: key,
					// ColumnSimpleType: fields[key].ColumnSimpleType
				// }
			// });

	// console.log('______________', Config.fieldsConf)

	var chkLayer = function (val) {
		var map = nsGmx.leafletMap,
			layer = nsGmx.gmxMap.layersByID[val],
			latLngBounds = L.gmxUtil.getGeometryBounds(layer._gmx.geometry).toLatLngBounds(true);
	console.log('ddddddddd', layer._gmx.geometry);
		map.fitBounds(latLngBounds);
		if (!layer._map) {
			map.addLayer(layer);
		}
	};

	var getAngleDist = function (latlng, latlngs, dec, delta) {
		delta = delta || 1;
		var p = latlng;
		var ring = latlngs.map(function (latlng) {
			var bearing = L.GeometryUtil.bearing(p, latlng),
				distance = L.gmxUtil.distVincenty(p.lng, p.lat, latlng.lng, latlng.lat);

			p = latlng;
			//console.log('dec', dec, bearing)
			if (dec) {
				bearing -= dec;
			}
			bearing = bearing + (bearing < 0 ? 360 : 0);
			bearing = Math.floor(bearing * 100) / 100;
			return [bearing, distance];
			// return [bearing, distance * delta];
		});
		return ring;
	};

	var getFormBody = function(par) {
		return Object.keys(par).map(function (key) {
			return encodeURIComponent(key) + '=' + encodeURIComponent(par[key]);
		}).join('&');
	};

	var modifyVectorObjects = function (layerId, features) {
		// console.log('modifyVectorObjects ____ ', layerId, features);
		var url = serverBase$2 + "VectorLayer/ModifyVectorObjects.ashx";

		L.gmxUtil.loaderStatus(url);
		return fetch(url, {
			method: 'post',
			mode: 'cors',
			credentials: 'include',
			headers: {'Content-type': 'application/x-www-form-urlencoded'},
			body: getFormBody({
				WrapStyle: 'None',
				LayerName : layerId,
				geometry_cs: 'EPSG:4326',
				Objects: JSON.stringify(features)
			})
		})
			.then(function (res) { L.gmxUtil.loaderStatus(url, true); return res.json(); })
			.catch(function (err) { return console.warn(err); });
	};

	var getReq = function (url) {
		L.gmxUtil.loaderStatus(url);
		return fetch(url, {
				mode: 'cors',
				credentials: 'include'
			})
			.then(function (res) { L.gmxUtil.loaderStatus(url, true); return res.json(); })
			.catch(function (err) { return console.warn(err); });
	};

	var getReportsCount = function () {
		return getReq(serverProxy$1 + '?path=/rest/v1/get-current-user-info');
	};

	var loadFeature = function (layerId, id) {
		var url = serverBase$2 + "VectorLayer/Search.ashx?layer=" + layerId + "&query=gmx_id=" + id + "&geometry=true&out_cs=EPSG:4326&WrapStyle=None";
		return getReq(url);
	};

	var loadFeatures = function (id) {
		var url = serverBase$2 + "VectorLayer/Search.ashx?layer=" + id + "&geometry=true&out_cs=EPSG:4326&WrapStyle=None";
		return getReq(url);
	};

	var colsToHash$1 = function (arr) {
		return arr.reduce(function (a, v, i) { a[v] = i; return a; }, {});
	};

	var loadQuadrantValues = function (id) {
		return loadFeatures(id)
			.then(function (json) {
				if (json.Status === 'ok') {
					var res = json.Result,
						cols = res.fields,
						hashCols = colsToHash$1(cols),
						nm = hashCols.kv,
						nmGeo = hashCols.geomixergeojson;
					return res.values.reduce(function (a, v, i) {
						var key = v[nm],
							geo = v[nmGeo],
							bbox = L.gmxUtil.getGeometryBounds(geo),
							p = a[key] || {};
						if (p.bbox) {
							bbox.extendBounds(p.bbox);
						} else {
							v.bbox = bbox;
							p = v;
						}
						a[key] = p;
						return a;
					}, {});
				}
			});
	};

	var selectFeaturesWithDrawing = function (id, geometry) {
		var params = {
			WrapStyle: 'None',
			layer: id,
			columns: '[{"Value":"[gmx_id]"}]',
			page: 0,
			// pagesize: null,
			query: ("STIntersects([gmx_geometry], GeometryFromGeoJson('" + (JSON.stringify(geometry)) + "', 4326))")
		};

		return fetch((serverBase$2 + "VectorLayer/Search.ashx?" + (L.gmxUtil.getFormData(params))), {
			mode: 'cors',
			credentials: 'include',
			headers: {
				'Accept': 'application/json'
			}
		})
		.then(function (res) { return res.json(); })
		.then(function (json) {
			if (json.Status === 'ok' && json.Result) {
				return json.Result.values.reduce(function (a, v) {
					a[v] = true;
					return a;
				}, {});
			}
		})
		.catch(function (err) { return console.warn(err); })
	};

	var getLayersParams = function (gmxMap) {
		var satLayers = [];

		gmxMap.layers.forEach(function (it) {
			if (it.getGmxProperties && it._map) {
				var props = it.getGmxProperties(),
					metaProps = props.MetaProperties || {},
					out = {layerId: props.name, type: 'оптическая'};
				if (props.IsRasterCatalog || props.type === 'Raster') {
					if (props.Temporal) {
						var dt = it.getDateInterval();
						if (dt.beginDate) { out.beginDate = dt.beginDate.getTime()/1000; }
						if (dt.endDate) { out.endDate = dt.endDate.getTime()/1000; }
					}
					if (metaProps.type) {
						out.type = metaProps.type.Value;
					}
					if (metaProps.system) {
						out.system = metaProps.system.Value;
					}
					if (metaProps.resolution) {
						out.resolution = metaProps.resolution.Value;
					}
					satLayers.push(out);
				}
			}
		});
		return satLayers;
	};

	var getLayersIds = function (gmxMap) {
		var layerIds = [], quadrantIds = [], limit = 0;

		gmxMap.layers.forEach(function (it) {
			if (it.getGmxProperties) {
				var props = it.getGmxProperties(),
					metaProps = props.MetaProperties || {};
				if (
					props.type.toLowerCase() === 'vector' &&
					props.GeometryType.toLowerCase() === 'polygon' &&
					!props.IsRasterCatalog &&
					!props.Quicklook
					) {
					var keys = it._gmx.tileAttributeTypes,
						hash = {id: props.name, title: props.title, bounds: it.getBounds(), _layer: it};

					// if (keys.FRSTAT && (keys.kv || keys.kvartal || keys['Квартал'])) {
						// hash.linkKey = keys.kv ? 'kv' : (keys.kvartal ? 'kvartal' : 'Квартал');
					if (keys.FRSTAT && keys.snap) {
						hash.linkKey = 'kvartal';
						layerIds.push(hash);

						it.addPopupHook('forestCont', function (properties, div, node, hooksCount) {
							var standart = div.innerHTML.replace(/<b>FRSTAT:.+?<br>/, '').replace(/<b>snap:.+?<br>/, '');
							// div.innerHTML = '[forestCont]';
							div.innerHTML = '';
							loadFeature(hash.id, properties.gmx_id).then(function (json) {
								if (json.Status === 'ok') {
									var arr = json.Result.values[0],
										geo = arr[arr.length - 1],
										geoJson = L.gmxUtil.geometryToGeoJSON(geo),
										coord = geoJson.coordinates[0][0],
										declination = geoMag$1(coord[1], coord[0], 0).dec || 0,
										latlngs = geoJson.coordinates[0].map(function (it) { return L.latLng(it[1], it[0]); }),
										ring = getAngleDist(latlngs[0], latlngs, declination);
									ring.shift();

									var popup = new Popup({
										target: div,
										data: {
											getReverse: function () { latlngs.reverse(); var arr = getAngleDist(latlngs[0], latlngs, declination); arr.shift(); return arr; },
											ring: ring,
											standart: standart,
											properties: properties,
											// declination: geoMag(coord[1], coord[0], 0).dec || 0,
											geoJson: geoJson
										}
									});
									var gmxPopup = nsGmx.leafletMap._gmxPopups[0],
										bbox = L.gmxUtil.getGeometryBounds(geoJson),
										latlng = L.latLng(bbox.max.y, bbox.min.x + (bbox.max.x - bbox.min.x) / 2);

									gmxPopup.setLatLng(latlng);
								}
							});
						});
					} else if (keys.kv) {
						hash.linkKey = 'kv';
						quadrantIds.push(hash);
					}
				}
			}
		});
		return {layerIds: layerIds, quadrantIds: quadrantIds, limit: limit, cols: []};
	};

	var saveState = function (data, key) {
		key = key || 'gmxForest_';
		window.localStorage.setItem(key, JSON.stringify(data));
	};

	var getState = function (key) {
		key = key || 'gmxForest_';
		return JSON.parse(window.localStorage.getItem(key)) || {};
	};

	var getReportType = function (zn) {
		if (zn.indexOf('использован') > -1) { zn = 'ИЛ'; }
		else if (zn.indexOf('восста') > -1) { zn = 'ВЛ'; }
		var pt = fieldsConf.report_t.onValue[zn] || zn;

		return pt ? pt.value : zn;
	};

	var sendReport = function (flag, numPoints, drawSnap, showGrid, pdf, checked, layerItems, hashCols, params, format, layerID, gmxMap, changedParams, num_points, templ, app) {
		var groupRequest = [],
			features = [],
			satLayers = getLayersParams(gmxMap);

		for (var i = 0, len = layerItems.length; i < len; i++) {
			var it = layerItems[i];
		// layerItems.forEach((it) => {
			var id = it[hashCols.gmx_id];
			if (checked[id]) {
				var data = {featureID: id, num_points: num_points, templ: templ};
				for (var key in params) {
					if (key === 'layerID') {
						data[key] = layerID;
					} else {
						var val = params[key];
						var par = key in changedParams ? changedParams[key] : {};
						data[key] = typeof(par) === 'string' ? par : par.field ? it[hashCols[par.field]] : par.value || val.value;
					}
					var emptyFlag = false;
					if (flag && key !== 'scale' && key !== 'dacha' && key !== 'inn' && data[key] === '') {
						emptyFlag = true;
						var rt = getReportType(data['reportType']);
						if (rt === 'ИЛ' && (key === 'recoveryEventType' || key === 'recoveryEventType')) {
							emptyFlag = false;
						} else if (rt === 'ВЛ' && (
									key === 'fellingType' ||
									key === 'fellingForm' ||
								key === 'form_rub' ||
								key === 'type_rub'
							)
							) {
							emptyFlag = false;
						}
					}
	// console.log('ssssssssss', key, data[key]);
					if (emptyFlag) {
						return null;
					}
				}
				data.satLayers = satLayers;
				groupRequest.push(data);
				features.push({action:'update', id:id, properties:{FRSTAT:2}});
			}
		}
		// });

	var reparseParams = function (arr) {
		var out = arr.map(function (it) {
			var ph = {};
			for (var key in it) {
				switch(key) {
					case 'num_points':
					case 'templ':
						break;
					case 'quadrantLayerId':
						ph.kvartalLayerID = it[key];
						break;
					case 'organizationName':
						ph.company = it[key];
						break;
					case 'sectionForestry':
						ph.subForestry = it[key];
						break;
					case 'quadrant':
						ph.kvartal = Number(it[key]);
						break;
					case 'stratum':
						ph.vydel = it[key];
						break;
					case 'recoveryEventType':
						ph.reforestType = it[key];
						break;
					case 'siteArea':
						ph.area = it[key];
						// ph.area = Number(it[key]);
						break;
					case 'scale':
						ph.scale = Number(it[key]) || 0;
						break;
					case 'site':
						ph.delyanka = String(it[key]);
						break;
					case 'satLayers':
						ph.satLayers = it.satLayers.map(function (pt) {
							var ps = {};
							for (var key in pt) {
								switch(key) {
									case 'resolution':
										ps.resolution = String(pt.resolution) + ' м';
										break;
									case 'layerId':
										ps.layerID = pt.layerId;
										break;

									default:
										ps[key] = pt[key];
										break;
								}
							}
							return ps;
						});
						break;
					default:
						ph[key] = it[key];
						break;
				}
			}
			return ph;
		});
		return out;
	};

	var tt = reparseParams(groupRequest);
	// console.log('groupRequest1', JSON.stringify(tt));

		return fetch(serverProxy$1 + '', {
				method: 'post',
				mode: 'cors',
				credentials: 'include',
				headers: {
					'Accept': 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({groupRequest: tt, numPoints: numPoints, drawSnap: drawSnap, pdf: pdf, showGrid: showGrid, path: '/rest/v1/createfile' })
			})
			.then(function (res) { return res.json(); })
			.then(function (json) {
	// console.log('createfile', json);
				if (json.status === 'active') {
					saveState(changedParams);
					return chkTask(json.id)
						.then(function (json) {
	// console.log('chkTask', json);
							if (json.status === 'completed') {
								var downloadFile = json.message;

								//window.open('http://lesfond.tk/rest/v1/' + downloadFile, '_self');
								window.open(serverProxy$1 + '?path=/rest/v1/getfile&' + downloadFile, '_self');

								modifyVectorObjects(layerID, features).then(function(argv) {
									app.loadFeatures();
								});
								return {report: false};
							} else if (json.status === 'error') {
								return {report: false, error: json.message};
								// return json;
								//reject(json);
							}
						})
						.catch(function (err) { return console.warn(err); });
				}
			})
			.catch(function (err) {
				console.warn(err);
				return {report: false};
			});
	};

	var chkTask = function (id) {
		var UPDATE_INTERVAL = 2000;
		return new Promise(function (resolve, reject) {
			var interval = setInterval(function () {
				fetch(serverProxy$1 + '?path=/rest/v1/checkstatus&id=' + id, {
					// mode: 'cors',
					// credentials: 'include'
				})
					.then(function (res) { return res.json(); })
					.then(function (json) {
	// console.log('chkTask_______', json);
						if (json.status === 'error') {
							clearInterval(interval);
							resolve(json);
						} else if (json.status === 'completed') {
							clearInterval(interval);
							resolve(json);
						}
					})
					.catch(function (err) { return console.warn(err); });
			}, UPDATE_INTERVAL);
		})
		.catch(function (err) { return console.warn(err); });
	};

	var createSiteLayer = function (data, columns) {
		data = data || {};
		var props = {
			Title: data.Title || 'Делянки 1',
			MetaProperties: {
				'report_t':{Value: data.report_t || '', Type: 'String'},
				'kvartal':{Value: data.kvartalLayerID || '', Type: 'String'},
				'forestr':{Value: data.forestr || '', Type: 'String'},
				'region':{Value: data.region ||  '', Type: 'String'},
				'company':{Value: data.company ||  '', Type: 'String'}
			},
			srs: 3857,
			Columns: columns || cols,
			SourceType: 'manual',
			GeometryType: "polygon"
		};
		return saveLayer(props).then(function (json) {
			L.gmx.loadLayer(nsGmx.gmxMap.options.mapName, json.name, nsGmx.gmxMap.options)
			.then(function (res) {
			});
			return json.name;
		});
	};

	var sendVectorFile = function (target, flagNames) {
		// const url = 'http://10.1.2.20:4000/rest/v1/get-contours',
		var url = serverProxy$1 + '?path=/rest/v1/get-contours',
			formData = new FormData();

		for (var i = 0, len = target.files.length; i < len; i++) {
			formData.append('file' + i, target.files[i]);
		}
		
		L.gmxUtil.loaderStatus(url);

		return fetch(url, {
			method: 'POST',
			body: formData,
		})
			.then(function (res) { return res.json(); })
			.then(function (json) {
				L.gmxUtil.loaderStatus(url, true);
				if (json.status === 'ok') {
					var features = json.text.features,
						columns = null;
					if (flagNames) {
						// console.log('ddddd', features[0]);
						columns = Object.keys(features[0].properties).map(function (key) {
							return {
								Name: key,
								ColumnSimpleType: key === 'FRSTAT' ? 'Integer' : 'String'
							};
						});
					}
					return createSiteLayer({
						Title: json.title || ''
					}, columns).then(function (layerID) {
	// console.log('sendImportFile', layerID, features);
						if (features.length) {
							return modifyVectorObjects(layerID, features.map(function (it) {
								it.action = 'insert';
								return it;
							})).then(function (ev) {
	// console.log('modifyVectorObjects', layerID, ev)
								return {layerID: layerID};
								// this._clearDrawingItems();
								// map.gmxDrawing.remove(geo);
								// prnt.regetFeatures();
								// L.gmx.layersVersion.chkVersion(layerID);
							});
						}
					});
				}
	// console.log('sendImportFile', json);
				return json;
			})
			.catch(function (err) {
				console.warn(err);
				return {report: false};
			});
	};

	var sendExcel = function (target) {
		var url = serverProxy$1 + '?path=/rest/v1/create-contours',
		// const url = location.search.indexOf('&test=proxy') !== -1 ? serverProxy + '?path=/rest/v1/create-contours' : 'http://lesfond.tk/rest/v1/create-contours',
			formData = new FormData();

		for (var i = 0, len = target.files.length; i < len; i++) {
			formData.append('file' + i, target.files[i]);
		}
		
		L.gmxUtil.loaderStatus(url);

		return fetch(url, {
			method: 'POST',
			body: formData,
		})
			.then(function (res) { return res.json(); })
			.then(function (json) {
				L.gmxUtil.loaderStatus(url, true);
				if (json.status === 'ok') {
					var features = json.text.features;
					return createSiteLayer({
						Title: json.title || ''
					}).then(function (layerID) {
	// console.log('sendImportFile', layerID, features);
						if (features.length) {
							return modifyVectorObjects(layerID, features.map(function (it) {
								it.action = 'insert';
								return it;
							})).then(function (ev) {
	console.log('modifyVectorObjects', layerID, ev);
								return {layerID: layerID};
								// this._clearDrawingItems();
								// map.gmxDrawing.remove(geo);
								// prnt.regetFeatures();
								// L.gmx.layersVersion.chkVersion(layerID);
							});
						}
					});
				}
	// console.log('sendImportFile', json);
				return json;
			})
			.catch(function (err) {
				console.warn(err);
				return {report: false};
			});
	};

	/*jslint plusplus:true */
	function Geomag$1(model) {
		var wmm,
			maxord = 12,
			a = 6378.137,		// WGS 1984 Equatorial axis (km)
			b = 6356.7523142,	// WGS 1984 Polar axis (km)
			re = 6371.2,
			a2 = a * a,
			b2 = b * b,
			c2 = a2 - b2,
			a4 = a2 * a2,
			b4 = b2 * b2,
			c4 = a4 - b4,
			z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			unnormalizedWMM;

		function parseCof(cof) {
			wmm = (function (cof) {
				var modelLines = cof.split('\n'), wmm = [], i, vals, epoch, model, modelDate;
				for (i in modelLines) {
					if (modelLines.hasOwnProperty(i)) {
						vals = modelLines[i].replace(/^\s+|\s+$/g, "").split(/\s+/);
						if (vals.length === 3) {
							epoch = parseFloat(vals[0]);
							model = vals[1];
							modelDate = vals[2];
						} else if (vals.length === 6) {
							wmm.push({
								n: parseInt(vals[0], 10),
								m: parseInt(vals[1], 10),
								gnm: parseFloat(vals[2]),
								hnm: parseFloat(vals[3]),
								dgnm: parseFloat(vals[4]),
								dhnm: parseFloat(vals[5])
							});
						}
					}
				}

				return {epoch: epoch, model: model, modelDate: modelDate, wmm: wmm};
			}(cof));
		}

		function unnormalize(wmm) {
			var i, j, m, n, D2, flnmj,
				c = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				cd = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				k = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				snorm = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice()],
				model = wmm.wmm;
			for (i in model) {
				if (model.hasOwnProperty(i)) {
					if (model[i].m <= model[i].n) {
						c[model[i].m][model[i].n] = model[i].gnm;
						cd[model[i].m][model[i].n] = model[i].dgnm;
						if (model[i].m !== 0) {
							c[model[i].n][model[i].m - 1] = model[i].hnm;
							cd[model[i].n][model[i].m - 1] = model[i].dhnm;
						}
					}
				}
			}
			/* CONVERT SCHMIDT NORMALIZED GAUSS COEFFICIENTS TO UNNORMALIZED */
			snorm[0][0] = 1;

			for (n = 1; n <= maxord; n++) {
				snorm[0][n] = snorm[0][n - 1] * (2 * n - 1) / n;
				j = 2;

				for (m = 0, D2 = (n - m + 1); D2 > 0; D2--, m++) {
					k[m][n] = (((n - 1) * (n - 1)) - (m * m)) /
						((2 * n - 1) * (2 * n - 3));
					if (m > 0) {
						flnmj = ((n - m + 1) * j) / (n + m);
						snorm[m][n] = snorm[m - 1][n] * Math.sqrt(flnmj);
						j = 1;
						c[n][m - 1] = snorm[m][n] * c[n][m - 1];
						cd[n][m - 1] = snorm[m][n] * cd[n][m - 1];
					}
					c[m][n] = snorm[m][n] * c[m][n];
					cd[m][n] = snorm[m][n] * cd[m][n];
				}
			}
			k[1][1] = 0.0;

			unnormalizedWMM = {epoch: wmm.epoch, k: k, c: c, cd: cd};
		}

		this.setCof = function (cof) {
			parseCof(cof);
			unnormalize(wmm);
		};
		this.getWmm = function () {
			return wmm;
		};
		this.setUnnorm = function (val) {
			unnormalizedWMM = val;
		};
		this.getUnnorm = function () {
			return unnormalizedWMM;
		};
		this.getEpoch = function () {
			return unnormalizedWMM.epoch;
		};
		this.setEllipsoid = function (e) {
			a = e.a;
			b = e.b;
			re = 6371.2;
			a2 = a * a;
			b2 = b * b;
			c2 = a2 - b2;
			a4 = a2 * a2;
			b4 = b2 * b2;
			c4 = a4 - b4;
		};
		this.getEllipsoid = function () {
			return {a: a, b: b};
		};
		this.calculate = function (glat, glon, h, date) {
			if (unnormalizedWMM === undefined) {
				throw new Error("A World Magnetic Model has not been set.")
			}
			if (glat === undefined || glon === undefined) {
				throw new Error("Latitude and longitude are required arguments.");
			}
			function rad2deg(rad) {
				return rad * (180 / Math.PI);
			}
			function deg2rad(deg) {
				return deg * (Math.PI / 180);
			}
			function decimalDate(date) {
				date = date || new Date();
				var year = date.getFullYear(),
					daysInYear = 365 +
						(((year % 400 === 0) || (year % 4 === 0 && (year % 100 > 0))) ? 1 : 0),
					msInYear = daysInYear * 24 * 60 * 60 * 1000;

				return date.getFullYear() + (date.valueOf() - (new Date(year, 0)).valueOf()) / msInYear;
			}

			var epoch = unnormalizedWMM.epoch,
				k = unnormalizedWMM.k,
				c = unnormalizedWMM.c,
				cd = unnormalizedWMM.cd,
				alt = (h / 3280.8399) || 0, // convert h (in feet) to kilometers (default, 0 km)
				dt = decimalDate(date) - epoch,
				rlat = deg2rad(glat),
				rlon = deg2rad(glon),
				srlon = Math.sin(rlon),
				srlat = Math.sin(rlat),
				crlon = Math.cos(rlon),
				crlat = Math.cos(rlat),
				srlat2 = srlat * srlat,
				crlat2 = crlat * crlat,
				q,
				q1,
				q2,
				ct,
				st,
				r2,
				r,
				d,
				ca,
				sa,
				aor,
				ar,
				br = 0.0,
				bt = 0.0,
				bp = 0.0,
				bpp = 0.0,
				par,
				temp1,
				temp2,
				parp,
				D4,
				m,
				n,
				fn = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
				fm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
				z = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				tc = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				sp = z.slice(),
				cp = z.slice(),
				pp = z.slice(),
				p = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				dp = [z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice(), z.slice(), z.slice(), z.slice(), z.slice(), z.slice(),
					z.slice()],
				bx,
				by,
				bz,
				bh,
				ti,
				dec,
				dip,
				gv;
			sp[0] = 0.0;
			sp[1] = srlon;
			cp[1] = crlon;
			tc[0][0] = 0;
			cp[0] = 1.0;
			pp[0] = 1.0;
			p[0][0] = 1;

			/* CONVERT FROM GEODETIC COORDS. TO SPHERICAL COORDS. */
			q = Math.sqrt(a2 - c2 * srlat2);
			q1 = alt * q;
			q2 = ((q1 + a2) / (q1 + b2)) * ((q1 + a2) / (q1 + b2));
			ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
			st = Math.sqrt(1.0 - (ct * ct));
			r2 = (alt * alt) + 2.0 * q1 + (a4 - c4 * srlat2) / (q * q);
			r = Math.sqrt(r2);
			d = Math.sqrt(a2 * crlat2 + b2 * srlat2);
			ca = (alt + d) / r;
			sa = c2 * crlat * srlat / (r * d);

			for (m = 2; m <= maxord; m++) {
				sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
				cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
			}

			aor = re / r;
			ar = aor * aor;

			for (n = 1; n <= maxord; n++) {
				ar = ar * aor;
				for (m = 0, D4 = (n + m + 1); D4 > 0; D4--, m++) {

			/*
					COMPUTE UNNORMALIZED ASSOCIATED LEGENDRE POLYNOMIALS
					AND DERIVATIVES VIA RECURSION RELATIONS
			*/
					if (n === m) {
						p[m][n] = st * p[m - 1][n - 1];
						dp[m][n] = st * dp[m - 1][n - 1] + ct *
							p[m - 1][n - 1];
					} else if (n === 1 && m === 0) {
						p[m][n] = ct * p[m][n - 1];
						dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1];
					} else if (n > 1 && n !== m) {
						if (m > n - 2) { p[m][n - 2] = 0; }
						if (m > n - 2) { dp[m][n - 2] = 0.0; }
						p[m][n] = ct * p[m][n - 1] - k[m][n] * p[m][n - 2];
						dp[m][n] = ct * dp[m][n - 1] - st * p[m][n - 1] -
							k[m][n] * dp[m][n - 2];
					}

			/*
					TIME ADJUST THE GAUSS COEFFICIENTS
			*/

					tc[m][n] = c[m][n] + dt * cd[m][n];
					if (m !== 0) {
						tc[n][m - 1] = c[n][m - 1] + dt * cd[n][m - 1];
					}

			/*
					ACCUMULATE TERMS OF THE SPHERICAL HARMONIC EXPANSIONS
			*/
					par = ar * p[m][n];
					if (m === 0) {
						temp1 = tc[m][n] * cp[m];
						temp2 = tc[m][n] * sp[m];
					} else {
						temp1 = tc[m][n] * cp[m] + tc[n][m - 1] * sp[m];
						temp2 = tc[m][n] * sp[m] - tc[n][m - 1] * cp[m];
					}
					bt = bt - ar * temp1 * dp[m][n];
					bp += (fm[m] * temp2 * par);
					br += (fn[n] * temp1 * par);
			/*
						SPECIAL CASE:  NORTH/SOUTH GEOGRAPHIC POLES
			*/
					if (st === 0.0 && m === 1) {
						if (n === 1) {
							pp[n] = pp[n - 1];
						} else {
							pp[n] = ct * pp[n - 1] - k[m][n] * pp[n - 2];
						}
						parp = ar * pp[n];
						bpp += (fm[m] * temp2 * parp);
					}
				}
			}

			bp = (st === 0.0 ? bpp : bp / st);
			/*
				ROTATE MAGNETIC VECTOR COMPONENTS FROM SPHERICAL TO
				GEODETIC COORDINATES
			*/
			bx = -bt * ca - br * sa;
			by = bp;
			bz = bt * sa - br * ca;

			/*
				COMPUTE DECLINATION (DEC), INCLINATION (DIP) AND
				TOTAL INTENSITY (TI)
			*/
			bh = Math.sqrt((bx * bx) + (by * by));
			ti = Math.sqrt((bh * bh) + (bz * bz));
			dec = rad2deg(Math.atan2(by, bx));
			dip = rad2deg(Math.atan2(bz, bh));

			/*
				COMPUTE MAGNETIC GRID VARIATION IF THE CURRENT
				GEODETIC POSITION IS IN THE ARCTIC OR ANTARCTIC
				(I.E. GLAT > +55 DEGREES OR GLAT < -55 DEGREES)
				OTHERWISE, SET MAGNETIC GRID VARIATION TO -999.0
			*/

			if (Math.abs(glat) >= 55.0) {
				if (glat > 0.0 && glon >= 0.0) {
					gv = dec - glon;
				} else if (glat > 0.0 && glon < 0.0) {
					gv = dec + Math.abs(glon);
				} else if (glat < 0.0 && glon >= 0.0) {
					gv = dec + glon;
				} else if (glat < 0.0 && glon < 0.0) {
					gv = dec - Math.abs(glon);
				}
				if (gv > 180.0) {
					gv -= 360.0;
				} else if (gv < -180.0) { gv += 360.0; }
			}

			return {dec: dec, dip: dip, ti: ti, bh: bh, bx: bx, by: by, bz: bz, lat: glat, lon: glon, gv: gv};
		};
		this.calc = this.calculate;
		this.mag = this.calculate;

		if (model !== undefined) { // initialize
			if (typeof model === 'string') { // WMM.COF file
				parseCof(model);
				unnormalize(wmm);
			} else if (typeof model === 'object') { // unnorm obj
				this.setUnnorm(model);
			} else {
				throw new Error("Invalid argument type");
			}
		}
	}

	var cof$1 = "\n    2010.0            WMM-2010        11/20/2009\n  1  0  -29496.6       0.0       11.6        0.0\n  1  1   -1586.3    4944.4       16.5      -25.9\n  2  0   -2396.6       0.0      -12.1        0.0\n  2  1    3026.1   -2707.7       -4.4      -22.5\n  2  2    1668.6    -576.1        1.9      -11.8\n  3  0    1340.1       0.0        0.4        0.0\n  3  1   -2326.2    -160.2       -4.1        7.3\n  3  2    1231.9     251.9       -2.9       -3.9\n  3  3     634.0    -536.6       -7.7       -2.6\n  4  0     912.6       0.0       -1.8        0.0\n  4  1     808.9     286.4        2.3        1.1\n  4  2     166.7    -211.2       -8.7        2.7\n  4  3    -357.1     164.3        4.6        3.9\n  4  4      89.4    -309.1       -2.1       -0.8\n  5  0    -230.9       0.0       -1.0        0.0\n  5  1     357.2      44.6        0.6        0.4\n  5  2     200.3     188.9       -1.8        1.8\n  5  3    -141.1    -118.2       -1.0        1.2\n  5  4    -163.0       0.0        0.9        4.0\n  5  5      -7.8     100.9        1.0       -0.6\n  6  0      72.8       0.0       -0.2        0.0\n  6  1      68.6     -20.8       -0.2       -0.2\n  6  2      76.0      44.1       -0.1       -2.1\n  6  3    -141.4      61.5        2.0       -0.4\n  6  4     -22.8     -66.3       -1.7       -0.6\n  6  5      13.2       3.1       -0.3        0.5\n  6  6     -77.9      55.0        1.7        0.9\n  7  0      80.5       0.0        0.1        0.0\n  7  1     -75.1     -57.9       -0.1        0.7\n  7  2      -4.7     -21.1       -0.6        0.3\n  7  3      45.3       6.5        1.3       -0.1\n  7  4      13.9      24.9        0.4       -0.1\n  7  5      10.4       7.0        0.3       -0.8\n  7  6       1.7     -27.7       -0.7       -0.3\n  7  7       4.9      -3.3        0.6        0.3\n  8  0      24.4       0.0       -0.1        0.0\n  8  1       8.1      11.0        0.1       -0.1\n  8  2     -14.5     -20.0       -0.6        0.2\n  8  3      -5.6      11.9        0.2        0.4\n  8  4     -19.3     -17.4       -0.2        0.4\n  8  5      11.5      16.7        0.3        0.1\n  8  6      10.9       7.0        0.3       -0.1\n  8  7     -14.1     -10.8       -0.6        0.4\n  8  8      -3.7       1.7        0.2        0.3\n  9  0       5.4       0.0       -0.0        0.0\n  9  1       9.4     -20.5       -0.1       -0.0\n  9  2       3.4      11.5        0.0       -0.2\n  9  3      -5.2      12.8        0.3        0.0\n  9  4       3.1      -7.2       -0.4       -0.1\n  9  5     -12.4      -7.4       -0.3        0.1\n  9  6      -0.7       8.0        0.1       -0.0\n  9  7       8.4       2.1       -0.1       -0.2\n  9  8      -8.5      -6.1       -0.4        0.3\n  9  9     -10.1       7.0       -0.2        0.2\n 10  0      -2.0       0.0        0.0        0.0\n 10  1      -6.3       2.8       -0.0        0.1\n 10  2       0.9      -0.1       -0.1       -0.1\n 10  3      -1.1       4.7        0.2        0.0\n 10  4      -0.2       4.4       -0.0       -0.1\n 10  5       2.5      -7.2       -0.1       -0.1\n 10  6      -0.3      -1.0       -0.2       -0.0\n 10  7       2.2      -3.9        0.0       -0.1\n 10  8       3.1      -2.0       -0.1       -0.2\n 10  9      -1.0      -2.0       -0.2        0.0\n 10 10      -2.8      -8.3       -0.2       -0.1\n 11  0       3.0       0.0        0.0        0.0\n 11  1      -1.5       0.2        0.0       -0.0\n 11  2      -2.1       1.7       -0.0        0.1\n 11  3       1.7      -0.6        0.1        0.0\n 11  4      -0.5      -1.8       -0.0        0.1\n 11  5       0.5       0.9        0.0        0.0\n 11  6      -0.8      -0.4       -0.0        0.1\n 11  7       0.4      -2.5       -0.0        0.0\n 11  8       1.8      -1.3       -0.0       -0.1\n 11  9       0.1      -2.1        0.0       -0.1\n 11 10       0.7      -1.9       -0.1       -0.0\n 11 11       3.8      -1.8       -0.0       -0.1\n 12  0      -2.2       0.0       -0.0        0.0\n 12  1      -0.2      -0.9        0.0       -0.0\n 12  2       0.3       0.3        0.1        0.0\n 12  3       1.0       2.1        0.1       -0.0\n 12  4      -0.6      -2.5       -0.1        0.0\n 12  5       0.9       0.5       -0.0       -0.0\n 12  6      -0.1       0.6        0.0        0.1\n 12  7       0.5      -0.0        0.0        0.0\n 12  8      -0.4       0.1       -0.0        0.0\n 12  9      -0.4       0.3        0.0       -0.0\n 12 10       0.2      -0.9        0.0       -0.0\n 12 11      -0.8      -0.2       -0.1        0.0\n 12 12       0.0       0.9        0.1        0.0\n999999999999999999999999999999999999999999999999\n999999999999999999999999999999999999999999999999\n";
	var geoMag$1 = new Geomag$1(cof$1).mag;

	/* src\CreateSite.html generated by Svelte v2.16.1 */



	function data$1() {
		return {
			quadrantIds: [],
			quadrantLayerId: null,
			reportType: 'об использовании лесов'
		};
	}
	var methods$1 = {
		setNodeField: function setNodeField(node, setFlag) {
	 // console.log('setNodeField', node);
			var val = node.options ? node.options[node.selectedIndex].value : node.value,
				name = node.name;
			// this.setField(name, val);
			if (setFlag) {
				var attr = {};
				attr[name] = val;
				if (name === 'layerID') {
					if (this.refs.layerID.value) {
						this.refs.layerID.classList.remove('error');
					} else {
						this.refs.layerID.classList.add('error');
					}
				}
				this.set(attr);
			}
		},
		cancel: function cancel() {
			var ref = this.get();
			var map = ref.map;
			var gmxPopup = ref.gmxPopup;
			map.removeControl(gmxPopup);
		},
		createKvartal: function createKvartal() {
			createLayer(true);
		},
		create: function create() {
			var ref = this.get();
			var map = ref.map;
			var gmxPopup = ref.gmxPopup;
			var quadrantIds = ref.quadrantIds;
			var prnt = ref.prnt;

			if (!this.refs.layerID.value) {
				this.refs.layerID.classList.add('error');
				return;
			}

			var qSel = this.refs.quadrantLayerId,
				qVal = qSel.options.length ? qSel.options[qSel.selectedIndex || 0].value : '',
				cols = Object.keys(fieldsConf).map (function (k) { return { Name: k, ColumnSimpleType: fieldsConf[k].ColumnSimpleType } });
			var props = {
				Title: this.refs.layerID.value || 'Делянки 1',
				MetaProperties: {
					kvartal: {Value: qVal, Type: 'String'}
				},
				srs: 3857,
				Columns: cols,
				SourceType: 'manual',
				GeometryType: "polygon"
			};
			saveLayer(props)
				.then(function (json) {
					map.removeControl(gmxPopup);
					setTimeout(prnt.regetLayersIds.bind(prnt, json.name), 1500);
			});
		}
	};

	function get_each_context$1(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function create_main_fragment$1(component, ctx) {
		var div0, text1, div13, div12, div8, div3, text5, div4, input, text6, div6, text8, div7, select, text9, span, text10, div11, div9, text12, div10, current;

		function change_handler(event) {
			component.setNodeField(this, true);
		}

		var each_value = ctx.quadrantIds;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(component, get_each_context$1(ctx, each_value, i));
		}

		function change_handler_1(event) {
			component.setNodeField(this, true);
		}

		function click_handler(event) {
			component.createKvartal();
		}

		function click_handler_1(event) {
			component.cancel();
		}

		function click_handler_2(event) {
			component.create();
		}

		return {
			c: function c() {
				div0 = createElement("div");
				div0.textContent = "Создание групп делянок";
				text1 = createText("\r\n\r\n");
				div13 = createElement("div");
				div12 = createElement("div");
				div8 = createElement("div");
				div3 = createElement("div");
				div3.innerHTML = "<div class=\"pop_ro_title_left svelte-s34jtn\">Название группы</div>\n\t\t\t\t\t\t  <div class=\"pop_ro_title_right svelte-s34jtn\">Обязательное</div>";
				text5 = createText("\r\n\t\t   ");
				div4 = createElement("div");
				input = createElement("input");
				text6 = createText("\r\n\r\n\t\t   ");
				div6 = createElement("div");
				div6.innerHTML = "<div class=\"pop_ro_title_left svelte-s34jtn\">Квартальная сеть</div>";
				text8 = createText("\r\n\t\t   ");
				div7 = createElement("div");
				select = createElement("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text9 = createText("\r\n\r\n\t\t\t  ");
				span = createElement("span");
				text10 = createText("\r\n\t\t");
				div11 = createElement("div");
				div9 = createElement("div");
				div9.textContent = "Отмена";
				text12 = createText("\r\n\t\t   ");
				div10 = createElement("div");
				div10.textContent = "Создать";
				div0.className = "pop_title svelte-s34jtn";
				div3.className = "pop_ro_title svelte-s34jtn";
				addListener(input, "change", change_handler);
				input.className = "inp_pop svelte-s34jtn";
				input.name = "layerID";
				input.placeholder = "Делянки";
				div4.className = "pop_ro svelte-s34jtn";
				div6.className = "pop_ro_title svelte-s34jtn";
				addListener(select, "change", change_handler_1);
				select.name = "quadrantLayerId";
				select.className = "select svelte-s34jtn";
				addListener(span, "click", click_handler);
				span.className = "pop_upload svelte-s34jtn";
				setAttribute(span, "alt", "pop_upload");
				div7.className = "pop_ro svelte-s34jtn";
				div8.className = "scrollbar";
				div8.id = "style-4";
				addListener(div9, "click", click_handler_1);
				div9.className = "pop_bottom_left svelte-s34jtn";
				addListener(div10, "click", click_handler_2);
				div10.className = "pop_bottom_right svelte-s34jtn";
				div11.className = "pop_bottom svelte-s34jtn";
				div12.className = "main_pop_cont_2 svelte-s34jtn";
				div13.className = "site-block";
			},

			m: function m(target, anchor) {
				insert(target, div0, anchor);
				insert(target, text1, anchor);
				insert(target, div13, anchor);
				append(div13, div12);
				append(div12, div8);
				append(div8, div3);
				append(div8, text5);
				append(div8, div4);
				append(div4, input);
				component.refs.layerID = input;
				append(div8, text6);
				append(div8, div6);
				append(div8, text8);
				append(div8, div7);
				append(div7, select);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select, null);
				}

				component.refs.quadrantLayerId = select;
				append(div7, text9);
				append(div7, span);
				append(div12, text10);
				append(div12, div11);
				append(div11, div9);
				append(div11, text12);
				append(div11, div10);
				current = true;
			},

			p: function p(changed, ctx) {
				if (changed.quadrantIds || changed.quadrantLayerId) {
					each_value = ctx.quadrantIds;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$1(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: run,

			d: function d(detach) {
				if (detach) {
					detachNode(div0);
					detachNode(text1);
					detachNode(div13);
				}

				removeListener(input, "change", change_handler);
				if (component.refs.layerID === input) { component.refs.layerID = null; }

				destroyEach(each_blocks, detach);

				removeListener(select, "change", change_handler_1);
				if (component.refs.quadrantLayerId === select) { component.refs.quadrantLayerId = null; }
				removeListener(span, "click", click_handler);
				removeListener(div9, "click", click_handler_1);
				removeListener(div10, "click", click_handler_2);
			}
		};
	}

	// (15:5) {#each quadrantIds as it}
	function create_each_block$1(component, ctx) {
		var option, text_value = ctx.it.title, text, option_value_value, option_selected_value, option_class_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it.id;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.quadrantLayerId === ctx.it.id;
				option.className = option_class_value = ctx.it.bad ? 'red' : '';
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.quadrantIds) && text_value !== (text_value = ctx.it.title)) {
					setData(text, text_value);
				}

				if ((changed.quadrantIds) && option_value_value !== (option_value_value = ctx.it.id)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.quadrantLayerId || changed.quadrantIds) && option_selected_value !== (option_selected_value = ctx.quadrantLayerId === ctx.it.id)) {
					option.selected = option_selected_value;
				}

				if ((changed.quadrantIds) && option_class_value !== (option_class_value = ctx.it.bad ? 'red' : '')) {
					option.className = option_class_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	function CreateSite(options) {
		init(this, options);
		this.refs = {};
		this._state = assign(data$1(), options.data);
		this._intro = !!options.intro;

		this._fragment = create_main_fragment$1(this, this._state);

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);
		}

		this._intro = true;
	}

	assign(CreateSite.prototype, proto);
	assign(CreateSite.prototype, methods$1);

	/* src\Snapping.html generated by Svelte v2.16.1 */



	// import * as geoMag from './geomag.js';

	var DEFANGLE = 45,
		DEFLEG = 200,
		PATERNS = {
			angle: /(\d*)\.?\d*_a/,
			dist: /(\d+)_d/
			// ,
			// latlng: '\d*([\.]&#123;1&#125;\d*)?'
		};

	function isReqTypeReport(ref) {
		var meta = ref.meta;

		return meta.report_t && (meta.report_t.Value === 'ВЛ' || meta.report_t.Value === 'о воспроизводстве лесов');
	}

	function latlng$1(ref) {
		var snap = ref.snap;

		return snap && snap.latlng;
	}

	function latlngPoint(ref) {
		var snap = ref.snap;

		return snap && snap.latlng && L.gmxUtil.getCoordinatesString(L.latLng(snap.latlng[0], snap.latlng[1]), 1);
	}

	function snapArr(ref) {
		var snap = ref.snap;

		return snap && snap.snap || [[0, 0, 0]];
	}

	function ringArr(ref) {
		var snap = ref.snap;

		return snap && snap.ring || [[0, 0, 0]];
	}

	function listQuadrants(ref) {
		var quadrantValues = ref.quadrantValues;

		return quadrantValues && Object.keys(quadrantValues) || null;
	}

	function data$2() {
		return {
			step: 1,
			coordType: 0,
			cancel: null,
			drawings: null,
			quadrantLayerId: null,
			quadrantIds: null,
			quadrantValues: null,
			layerItems: null,
			snap: null,
			kvartal: null,
			paterns: {
				angle: '[СВЮЗ]*[ВЗ]*[\d]+([\.,][\d]+)?',			// С, СВ, В, ЮВ, Ю, ЮЗ, З, СЗ
				latlng: '\d*([\.]&#123;1&#125;\d*)?',
				latlngPoint: '\d+°\d+\'\d\d.\d\d" N, \d+°\d+\'\d\d.\d\d" E'
			},
			fieldsConf: fieldsConf || {},
			isForestCols: false,
			reportType: 'ИЛ',
			hashCols: {},
			checked: {},
			layerID: '',
			layerIds: []
		}
	}
	var methods$2 = {
		_lastProps: {},
		_useLastProps: function _useLastProps(props) {
			var _lastProps = getState('gmxForest_lastProps') || {};
			if (props) {
				for (var k in props) {
					if (fieldsConf[k] && fieldsConf[k].save && props[k]) {
						if (!L.Util.isArray(_lastProps[k])) { _lastProps[k] = []; }
						_lastProps[k].push(props[k]);
					}
				}
				saveState(_lastProps, 'gmxForest_lastProps');
			}
			return _lastProps;
		},
		coordFormatChange: function coordFormatChange(ev) {
			var ref = this.get();
			var snap = ref.snap;
			var coordType = ref.coordType;
			if (coordType) {
				var latlng = snap.latLng;
				var str = L.gmxUtil.latLonFormatCoordinates(latlng);
			} else {
				var latlng$1 = snap.latLng;
				var str$1 = L.gmxUtil.formatCoordinates(latlng$1);
	console.log('coordFormatChange', ev);
	// return  gmxAPIutils.formatDegrees(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
		// gmxAPIutils.formatDegrees(Math.abs(x)) + (x > 0 ? ' E' : ' W');
			}
			this.set({coordType: coordType ? 0 : 1});
		},

		parseCoordinate: function(text) {
			if (text.match(/[йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮqrtyuiopadfghjklzxcvbmQRTYUIOPADFGHJKLZXCVBM_:]/)) {
				return null;
			}
			text = text.replace(/,/g, '.');
			var regex = /(-?\d+(\.\d+)?)([^\d\-]*)/g,
				t = regex.exec(text),
				results = [];

			while (t) {
				results.push(t[1]);
				t = regex.exec(text);
			}
			if (!results.length) {
				return null;
			}
			var ii = Math.floor(results.length),
				y = 0,
				mul = 1,
				i;
			for (i = 0; i < ii; i++) {
				y += parseFloat(results[i]) * mul;
				mul /= 60;
			}

			if (text.indexOf('S') !== -1 || text.indexOf('W') !== -1) {
				y = -y;
			}
			return y;
		},

		onKeyUp: function onKeyUp(ev) {
			if (ev.key === 'Enter') {
				this.nextPoint(ev.target, true);
			}
		},
		_parseAngle: function _parseAngle(str) {		// С, СВ, В, ЮВ, Ю, ЮЗ, З, СЗ
			str = str.trim();
			var angle = 0,
				np = '',
				p1 = (str[0] || '').toUpperCase(),
				p2 = (str[1] || '').toUpperCase(),
				fMinus = false,
				s = 1;

			if (p1 === 'C' || p1 === 'С') {
				np = 'С';
				if (p2 === 'З') {
					// angle = 360;
					s = 2;
					np = 'СЗ';
					fMinus = true;
				} else if (p2 === 'В' || p2 === 'B') {
					s = 2;
					np = 'СВ';
				}
			} else if (p1 === 'Ю') {
				np = 'Ю';
				angle = 180;
				if (p2 === 'З') {
					s = 2;
					np = 'ЮЗ';
				} else if (p2 === 'В' || p2 === 'B') {
					s = 2;
					np = 'ЮВ';
					fMinus = true;
				}
			} else if (p1 === 'З') {
				np = 'З';
				angle = 270;
			} else if (p1 === 'В' || p1 === 'B') {
				np = 'В';
				angle = 90;
			} else {
				s = 0;
			}
			var rumb = Number(str.substr(s));
			return {
				np: np,
				rumb: rumb,
				angle: angle + (fMinus ? -rumb : rumb)
			};
		},

		_isError: function _isError(val, val1, rmb) {
			if (rmb && rmb.np) {
				if (rmb.np.length === 1 && rmb.rumb !== 0) {
					return true;
				} else if (rmb.rumb < 0 || rmb.rumb >= 90) {
				// } else if (isNaN(val) || rmb.rumb < 0 || rmb.rumb >= 90) {
					return true;
				} else {
					val = rmb.rumb;
				}
			}
			return isNaN(val) || (val !== null && (val < 0 || val >= 360)) ? true : (val1 !== undefined && val1 <= 0 ? true : false);
		},
		fromClipboard: function fromClipboard(ev) {
			var ref = this.get();
			var snap = ref.snap;
			var map = ref.map;
			var cont = this.refs.sn0,
				inputs = cont.getElementsByTagName('input'),
				target = ev.target,
				clipboardData = ev.clipboardData,
				str = clipboardData.getData('text/plain'),
				arr = str.indexOf(',') !== -1 ? L.gmxUtil.parseCoordinates(str) : this.parseCoordinate(str);
			if (arr) {
				if (!L.Util.isArray(arr)) {
					arr = target === inputs[0] ? [arr, inputs[1].value] : [inputs[0].value, arr];
				}
				clipboardData.clearData();
				
				snap.latlng = this._getLatlng(L.latLng(arr[0] || 0, arr[1] || 0));
				setTimeout(function() {
					inputs[0].value = snap.latlng[0];
					inputs[1].value = snap.latlng[1];
				}, 200);
				inputs[0].classList.remove('error');
				inputs[1].classList.remove('error');
				this.set({snap: snap});
			} else {
				inputs[0].classList.add('error');
				inputs[1].classList.add('error');
				this.refs.sn00.classList.add('error');
			}
		},
		setPoint: function setPoint(ev) {
			var node = ev.target,
				key = ev.data;

			if (node.value === '') {
				return;
			}
			var ref = this.get();
			var snap = ref.snap;
			var map = ref.map;
			var str = node.options ? node.options[node.selectedIndex].value : node.value;
			
			var rmb = this._parseAngle(str),
				val = rmb.angle,
				name = node.name,
				prnt = node.parentNode,
				type = 'point',
				data = snap.latlng,
				error = true;

			if (prnt.classList.contains('snap')) {
				type = 'snap';
				data = snap.snap || [[]];
			} else if (prnt.classList.contains('ring')) {
				type = 'ring';
				data = snap.ring || [[]];
			}
	// console.log('setPoint', type, val, node, prnt.name);
			if (type === 'point') {
				if (name === 'lng' || name === 'lat') {
					val = Number(node.value);
					if (val) {
						if (name === 'lng' && val >= -180 && val <= 180) {
							error = false;
							// snap.latlng = [snap.latlng ? snap.latlng[0] : 0, val];
							snap.latlng = this._getLatlng(L.latLng(snap.latlng ? snap.latlng[0] : 0, val));
						} else if (name === 'lat' && val > -90 && val < 90) {
							error = false;
							snap.latlng = this._getLatlng(L.latLng(val, snap.latlng ? snap.latlng[1] : 0));
							// snap.latlng = [val, snap.latlng ? snap.latlng[1] : 0];
						}
					} else if (val === 0) {
						error = false;
						var cont = this.refs.sn0,
							inputs = cont.getElementsByTagName('input'),
							center = map.getCenter();

						snap.latlng = this._getLatlng(center);
						// snap.latlng = [Number(center.lat.toFixed(6)), Number(center.lng.toFixed(6))];
						inputs[0].value = snap.latlng[0];
						inputs[1].value = snap.latlng[1];
						
						if (snap.snap && !snap.snap[0].length) {
							snap.snap = [[90, DEFLEG, '90']];
						}
						if (snap.ring && !snap.ring[0].length) {
							snap.ring = [[45, DEFLEG, '45']];
						}
						
						this.set({snap: snap});
						return;
					}
					if (!error) {
						this.declination = geoMag$1(snap.latlng[0], snap.latlng[1], 0).dec - this.sbl_mer(snap.latlng[0], snap.latlng[1]);
						// this.delta = snap.latlng[0] ? 1 / Math.cos(snap.latlng[0] * Math.PI / 180) : 1;
						this.delta = 1;
						this.reDrawing(snap, true);
					}
				}
			} else if (type === 'snap' || type === 'ring') {
				if (PATERNS.angle.test(name)) {
					var arr = PATERNS.angle.exec(name);
					if (arr.length) {
						var it = data[arr[1]];
						// error = !val || this._isError(val, it[1], rmb);
						error = this._isError(val, undefined, rmb);
						if (!error) {
							it[0] = Number(val);
							it[1] = it[1] || 200;
						}
						it[2] = str;
					}
				} else if (PATERNS.dist.test(name)) {
					error = this._isError(null, val);
					if (!error) {
						var arr$1 = PATERNS.dist.exec(name);
						if (arr$1.length) {
							var it$1 = data[arr$1[1]];
							it$1[1] = Number(val);
							it$1[0] = it$1[0] || 0;
						}
					}
				}
				if (!error) {
					if (type === 'snap') {
						snap.snap = data;
					} else {
						snap.ring = data;
						// this._focus = data.length === 1 && _focus !== null ? _focus : null;
					}
				}
			}
			
			var delItem = prnt.getElementsByClassName('delItem')[0],
				addNext = prnt.getElementsByClassName('addNext')[0];
			if (error) {
				node.classList.add('error');
				if (delItem) { delItem.classList.add('disabled'); }
				if (addNext) { addNext.classList.add('disabled'); }
			} else {
				node.classList.remove('error');
				if (delItem) { delItem.classList.remove('disabled'); }
				if (addNext) { addNext.classList.remove('disabled'); }
				// this.reDrawing(snap);
			}
			this.set({ snap: snap });
		},

		setLatlngPoint: function setLatlngPoint(ev) {
			var ref = this.get();
			var snap = ref.snap;
			var node = ev.target,
				res = L.Control.gmxLocation.Utils.parseCoordinates(node.value);

			if (res) {
				snap.latlng = res;
				this.set({ snap: snap });
			}
		},

		delPoint: function delPoint(node) {
			var ref = this.get();
			var snap = ref.snap;
			var prnt = node.parentNode.parentNode,
				inputs = prnt.getElementsByTagName('input'),
				cmdSpans = prnt.getElementsByClassName('pop_ro_right_dotted')[0].children;

			if (prnt.classList.contains('snap') && snap.snap && snap.snap.length) {
			// if (prnt.classList.contains('snap') && snap.snap.length > 1) {
				var arr = PATERNS.angle.exec(inputs[0].name),
					nm = arr.length ? Number(arr[1]) : 0;
				snap.snap.splice(nm, 1);
				if (!snap.snap.length) {
					snap.snap = [[]];
					inputs[0].value = inputs[1].value = '';
					cmdSpans[0].classList.add('disabled');
					cmdSpans[1].classList.add('disabled');
				}
				this.set({ snap: snap });
			} else if (prnt.classList.contains('ring') && snap.ring && snap.ring.length) {
			// } else if (prnt.classList.contains('ring') && snap.ring.length > 1) {
				var arr$1 = PATERNS.angle.exec(inputs[0].name),
					nm$1 = arr$1.length ? Number(arr$1[1]) : 0;
				snap.ring.splice(nm$1, 1);
				if (!snap.ring.length) {
					snap.ring = [[]];
					inputs[0].value = inputs[1].value = '';
					cmdSpans[0].classList.add('disabled');
					cmdSpans[1].classList.add('disabled');
				}
				this.set({ snap: snap });
			}
		},

		_getNum: function _getNum(str, reg) {
			var arr = reg.exec(str);
			return arr.length ? Number(arr[1]) : 0;
		},
		nextPoint: function nextPoint(node, flag) {
			var ref = this.get();
			var snap = ref.snap;
			var prnt = flag ? node.parentNode : node.parentNode.parentNode,
				cont = this.refs.sn0,
				scrollBox = this.refs.scroll,
				inputs = prnt.getElementsByTagName('input'),
				firstChild = inputs[0],
				rmb = this._parseAngle(firstChild.value),
				leg = [90, DEFLEG];
	 // console.log('nextPoint', snap, scrollBox.scrollHeight, scrollBox.clientHeight, scrollBox.offsetHeight);
			this._focusNode = node === inputs[0] ? inputs[1].name : null;
			if (prnt.classList.contains('point')) {
				snap.snap = snap.snap || [[]];
				snap.snap.unshift(leg);
				this.set({ snap: snap });
			} else if (prnt.classList.contains('snap')) {
				if (!this._isError(inputs[0].value, inputs[1].value, rmb)) {
					var nm = this._getNum(inputs[0].name, PATERNS.angle);
					snap.snap = snap.snap || [[Number(inputs[0].value), Number(inputs[1].value)]];
					if (!this._focusNode) {
						snap.snap.splice(nm + 1, 0, leg);
						this._focusNode = 'snap' + (nm + 1) + '_a';
					}
					this.set({ snap: snap });
				}
			} else if (prnt.classList.contains('ring')) {
				if (!this._isError(inputs[0].value, inputs[1].value, rmb)) {
					// let arr = PATERNS.angle.exec(firstChild.name),
						// nm = arr.length ? Number(arr[1]) : 0;
					var nm$1 = this._getNum(inputs[0].name, PATERNS.angle);
					snap.ring = snap.ring || [[Number(inputs[0].value), Number(inputs[1].value)]];
					this._focus = 0;
					if (!this._focusNode) {
						snap.ring.splice(nm$1 + 1, 0, [DEFANGLE, DEFLEG]);
						this._focusNode = 'ring' + (nm$1 + 1) + '_a';
					}
					this.set({ snap: snap });
				}
			}
		},

		addRing: function addRing(node) {
			var ref = this.get();
			var snap = ref.snap;
			snap.ring = snap.ring || [];
			snap.ring.unshift([DEFANGLE, DEFLEG]);
			this.set({ snap: snap });
		},
		createKvartal: function createKvartal() {
			createLayer(true);
		},
		setKvartal: function setKvartal(node) {
			var ref = this.get();
			var map = ref.map;
			var quadrantValues = ref.quadrantValues;
			var snap = ref.snap;
	// console.log('setKvartal', node);
			if (quadrantValues) {
				if (this._drawingItems) {
					for (var key in this._drawingItems) {
						map.gmxDrawing.remove(this._drawingItems[key]);
					}
				}
				this._drawingItems = null;
				var kv = node.value,
					cont = this.refs.sn0,
					addNext = cont.getElementsByClassName('addNext')[0];
				if (quadrantValues[kv]) {
					var bbox = quadrantValues[kv].bbox,
						latlng = bbox.getCenter().reverse(),
						lat = cont.getElementsByClassName('lat')[0],
						lng = cont.getElementsByClassName('lng')[0],
						min = bbox.min,
						max = bbox.max;
					map.fitBounds([[min.y, min.x], [max.y, max.x]]);
					
					lat.value = latlng[0]; lat.classList.remove('error');
					lng.value = latlng[1]; lng.classList.remove('error');
		//					addNext.classList.remove('disabled');
		// console.log('setKvartal', latlng);
					snap.latlng = this._getLatlng(L.latLng(latlng[0], latlng[1]));
					// snap.latlng = this._getLatlng(latlng);
					// snap.latlng = latlng;
					this.declination = geoMag$1(snap.latlng[0], snap.latlng[1], 0).dec - this.sbl_mer(snap.latlng[0], snap.latlng[1]);
					// this.declination = Requests.geoMag(snap.latlng[0], snap.latlng[1], 0).dec;
					//this.delta = snap.latlng[0] ? 1 / Math.cos(snap.latlng[0] * Math.PI / 180) : 1;
					this.delta = 1;
		// console.log('nextPoint', snap, prnt);
					snap.snap = snap.snap || [[]];
					if (snap.snap.length === 0) {
						snap.snap.unshift([90, DEFLEG]);
					}
					this.set({ snap: snap, kvartal: kv });
					this.chkInputs(true);
				}
			}

		},
		_drawingItems: null,
		_clearDrawingItems: function _clearDrawingItems() {
			var ref = this.get();
			var geo = ref.geo;
			var map = ref.map;
			if (this._drawingItems) {
				for (var key in this._drawingItems) {
					map.gmxDrawing.remove(this._drawingItems[key]);
				}
			}
			if (geo) { map.gmxDrawing.remove(geo); }
			this._drawingItems = null;
		},

		cancelMe: function cancelMe() {
			this.toggleContextmenu(0);
			this._clearDrawingItems();
			this.set({cancel: true});
	// console.log('cancelMe', this);
		},
		addObjectAny: function addObjectAny(geo) {
			var this$1 = this;

			var ref = this.get();
			var layerID = ref.layerID;
			var kvartal = ref.kvartal;
			var hashCols = ref.hashCols;
			var prnt = ref.prnt;
			var map = ref.map;

			var snap = '';
			if (this._drawingItems.snap) {
				var geo$1 = this._drawingItems.snap.toGeoJSON().geometry,
					coords = geo$1.coordinates;
				if (coords.length > 1) {
					if (coords.length !== 2 || coords[0][0] !== coords[1][0] || coords[0][1] !== coords[1][1]) {
						snap = JSON.stringify(geo$1);
					}
				}
			}
	// console.log('Requests.fields', Requests.fields)

			$(
				editObject(layerID, null, {
					hashCols: hashCols,
					dFields: JSON.parse(window.localStorage.getItem('gmxForest_Delanka')) || {},
					// fields: fields,
					snap: snap,
					drawingObject: geo
				})
			).on ('close', function (e) {
				this$1._clearDrawingItems();
				map.gmxDrawing.remove(geo);
				prnt.regetFeatures();
				L.gmx.layersVersion.chkVersion(layerID);
				var dFields = e.target.getAll();
	 // console.log('dFields', dFields, hashCols);
				delete dFields.FRSTAT;
				delete dFields.snap;
				window.localStorage.setItem('gmxForest_Delanka', JSON.stringify(dFields));
			});
			this.set({cancel: true});
		},

		chkInputs: function chkInputs(flag) {
			// node = node || document.getElementsByClassName('main_pop_cont_2')[0];
			var inputs = document.getElementsByClassName('main_pop_cont_2')[0].getElementsByTagName('input');
			for (var i = 0, len = inputs.length; i < len; i++) {
				var it = inputs[i];
				if (flag && it.name === 'ring0_a') {
					it.classList.add('error');
				}
				// console.log('chkInputs', it.classList.contains('error'), val, name)
				if (it.classList.contains('error')) {
					it.focus();
					it.select();
					return false;
				}
			}
			return true;
		},
		// _namesHash: {
			// reportType: 'Тип отчета',
			// organizationName: 'Наименование организации',
			// inn: 'ИНН',
			// region: 'Субъект Российской Федерации',
			// forestry: 'Лесничество',
			// sectionForestry: 'Участковое Лесничество',
			// quadrant: 'Квартал',
			// dacha: 'Дача',
			// stratum: 'Выделы',
			// fellingForm: 'Форма рубки',
			// fellingType: 'Тип рубки', // *
			// recoveryEventType: 'Тип лесовосстановления',
			// siteArea: 'Площадь',
			// scale: 'Масштаб',
			// site: 'Делянка'
		// },

		addObject: function addObject(node) {
			var this$1 = this;

			var ref = this.get();
			var map = ref.map;
			var prnt = ref.prnt;
			var snap = ref.snap;
			var layerID = ref.layerID;
			var hashCols = ref.hashCols;
			var kvartal = ref.kvartal;
			var meta = ref.meta;
			var item = ref.item;
			var geo = ref.geo;

	// console.log('Requests.fields', Requests.fields)
			var properties = {
				snap: JSON.stringify(this._drawingItems.snap.toGeoJSON().geometry),
				FRSTAT: 0
			};
			var fields$$1 = [
					{ name: 'FRSTAT', value: 0 },
					{ name: 'snap', value: JSON.stringify(this._drawingItems.snap.toGeoJSON().geometry) }
				],
				inputs = this.refs.scroll.getElementsByTagName('input');
				// ,
				// selectNodes = this.refs.scroll.getElementsByTagName('select');

			// inputs.concat(selectNodes);
			for (var key in meta) {
				if (key in hashCols) {
					//fields.push({ name: key, value: meta[key].Value });
					properties[key] = meta[key].Value || '';
				}
			}
			for (var i = 0, len = inputs.length; i < len; i++) {
				var it = inputs[i],
					name = it.name,
					val = it.options ? it.options[it.selectedIndex || 0].value : it.value;

				if (val) {
					properties[name] = val;
					// properties[this._namesHash[name] || name] = val;
					// fields.push({ name: this._namesHash[name] || name, value: val });
				}
			}
			if (hashCols['Квартал'] || hashCols.kv || hashCols.kvartal) {
				var kvKey = hashCols['Квартал'] ? 'Квартал' : (hashCols.kv ? 'kv' : 'kvartal');
				// fields.push({ name: kvKey, value: kvartal });
				properties[kvKey] = kvartal;
			}
			
			this._useLastProps(properties);
			// let lastProps = Object.keys(properties).reduce((p, k) => {
				// if (Config.fieldsConf[k] && Config.fieldsConf[k].save && properties[k]) {
					// p[k] = properties[k];
				// }
				// return p;
			// }, {});
			
			// Requests.saveState(lastProps, 'gmxForest_lastProps');
	// console.log('ssssssssss', latlngs) L.gmxUtil.geoJSONtoGeometry
			modifyVectorObjects(layerID, [{
				properties: properties,
				geometry: L.gmxUtil.geoJSONtoGeometry(geo.toGeoJSON()),
				action: 'insert'
			}]).then(function (ev) {
	console.log('insert VectorObjects', ev);
				this$1._clearDrawingItems();
				map.gmxDrawing.remove(geo);
				// prnt.editSite();
				prnt.regetFeatures();
				L.gmx.layersVersion.chkVersion(layerID);
			});
			this.cancelMe();
		},

		nextStep: function nextStep() {
			var ref = this.get();
			var step = ref.step;
			var meta = ref.meta;
			var map = ref.map;
	 console.log('nextStep', step, meta, this.refs);
	// this.chkInputs();
			var isRing = this._drawingItems && this._drawingItems.ring;
			if (step === 2) {
				this.addObject();
			} else if (this.chkInputs(!isRing)) {
				var ring = this._drawingItems.ring.rings[0].ring,
					latlngs = ring.getLayers()[0].getLatLngs();
	// console.log('ssssssssss', latlngs)
				latlngs[latlngs.length - 1] = latlngs[0];

				map.gmxDrawing.remove(this._drawingItems.ring);
				var geo = map.gmxDrawing.add(L.polygon(latlngs), {title: 'Делянка'});

				this.set({step: 2, geo: geo, _lastProps: this._useLastProps()});
			}
		},

		reDrawing: function reDrawing(snap, setView) {
			var this$1 = this;

			var ref = this.get();
			var map = ref.map;
	// console.log('reDrawing', snap);

			this._clearDrawingItems();
			if (snap) {
				if (snap.latlng) {
					this.declination = geoMag$1(snap.latlng[0], snap.latlng[1], 0).dec - this.sbl_mer(snap.latlng[0], snap.latlng[1]);
					var cont = this.refs.sn0;
					if (cont) {
						var inputs = cont.getElementsByTagName('input');
						inputs[0].classList.remove('error');
						inputs[1].classList.remove('error');
					}
					// this.declination = Requests.geoMag(snap.latlng[0], snap.latlng[1], 0).dec;
					// this.delta = snap.latlng[0] ? 1 / Math.cos(snap.latlng[0] * Math.PI / 180) : 1;
					this.delta = 1;
					var gmxDrawing = map.gmxDrawing,
						latlng = new L.LatLng(snap.latlng[0], snap.latlng[1]),
						p = latlng,
						marker = L.marker(latlng, {draggable: true, title: 'Snap point'}).on('dragend', function (it, ev) {
							// if (snap.snap && snap.snap.length) {
								var cont = this$1.refs.sn0,
									inputs = cont.getElementsByTagName('input'),
									latlng = it.target.getLatLng();
								snap.latlng = this$1._getLatlng(latlng);
								// snap.latlng = [latlng.lat, latlng.lng];
								this$1.set({snap: snap});
							// }
						}, this),
						myObject = map.gmxDrawing.add(marker, {}),
						out = {
							marker: myObject
						},
						arr = [];

					if (setView) { map.setView(latlng); }
					if (snap.snap) {
						arr = snap.snap.map(function (it) {
							// p = L.GeometryUtil.destination(p, 180 + it[0], it[1]);
							var angle = it[0] || 0,
								dist = it[1] || 0;
							angle += this$1.declination ? this$1.declination : 0;
							dist *= this$1.delta ? this$1.delta : 1;
							p = L.GeometryUtil.destination(p, angle, dist);
							return p;
						});
						// arr = arr.reverse();
						arr.unshift(latlng);
						latlng = p;
						out.snap = map.gmxDrawing.add(L.polyline(arr), {pointStyle:{shape: 'circle'}, lineStyle:{color: '#ff0000'}} );
						out.snap.on('editstop dragend rotateend', function (it) {
							var geoJSON = it.object.toGeoJSON(),
								coords = geoJSON.geometry.coordinates,
								latlngs = coords.map(function (it) { return L.latLng(it[1], it[0]); }),
								arr = getAngleDist(latlngs[0], latlngs, this$1.declination, this$1.delta);
							arr.shift();
	// console.log('latlng1', coords[0]);
							snap.latlng = this$1._getLatlng(L.latLng(coords[0][1], coords[0][0]));
							snap.snap = arr;
							this$1.lastEdit = 'snap';
							this$1.set({snap: snap});
						}, this);
					}
					if (snap.ring) {
						arr = snap.ring.map(function (it) {
							var angle = (it[0] || 0);
							angle -= this$1.declination ? this$1.declination : 0;
							p = L.GeometryUtil.destination(p, (it[0] || 0) + (this$1.declination ? this$1.declination : 0), it[1] || 0);
							return p;
						});
						arr.unshift(latlng);
						out.ring = map.gmxDrawing.add(L.polyline(arr), {pointStyle:{shape: ''}, lineStyle:{color: '#0000ff'}} );
						out.ring.on('editstop dragend rotateend', function (it) {
							var geoJSON = it.object.toGeoJSON(),
								latlngs = geoJSON.geometry.coordinates.map(function (it) { return L.latLng(it[1], it[0]); }),
								arr = getAngleDist(latlngs[0], latlngs, this$1.declination, this$1.delta),
								snapLen = snap.snap ? snap.snap.length : 0;
							if (!snapLen) {
								snap.latlng = this$1._getLatlng(latlngs[0]);
							}
							arr.shift();
							snap.ring = arr;
							this$1.lastEdit = 'ring';
							this$1.set({snap: snap});
						}, this);
					}
					if (this.lastEdit && out[this.lastEdit]) {
						out[this.lastEdit].bringToFront();
					}
					this.lastEdit = '';
					this._drawingItems = out;
				}
			}
		},

		toggleContextmenu: function toggleContextmenu(flag) {
	 // console.log('toggleContextmenu', flag);
			var map = nsGmx.leafletMap,
				mcm = map.contextmenu,
				dcm = map.gmxDrawing.contextmenu;

			if (!this._privazMenu) {
				this._privazMenu = {callback: this.privaz.bind(this), text: 'Привязать'};
			}
			if (flag === 1) {
				dcm.insertItem(this._privazMenu, 0, 'points');
				this._getCenterMenu = mcm.insertItem({callback: this.getCenter.bind(this), text: 'Взять координату'}, 0);
			} else {
				dcm.removeItem(this._privazMenu, 'points');
				if (this._getCenterMenu) {
					mcm.removeItem(this._getCenterMenu);
				}
				map.gmxDrawing.clear();
				this._clearDrawingItems();
				this.set({cancel: true});
			}
		},
		sbl_mer: function sbl_mer(lat, lon) {
			var zone = Math.round(lon / 6) + 1,
				l0 = zone * 6 - 3;
			return (lon - l0) * Math.sin(lat);
		},
		setNodeField: function setNodeField(node, setFlag) {
			var this$1 = this;

			var ref = this.get();
			var map = ref.map;
			var quadrantIds = ref.quadrantIds;
			this.set({quadrantValues: null, quadrantLayerId: null});
			var val = node.options ? node.options[node.selectedIndex].value : node.value;
			if (val) {
				L.gmxUtil.loaderStatus(val);
				loadQuadrantValues(val)
				.then(function (json) {
					this$1.set({quadrantValues: json, quadrantLayerId: val || null});
					for (var i = 0, len = quadrantIds.length; i < len; i++) {
						var pt = quadrantIds[i];
						if (pt.id === val) {
							map.fitBounds(pt.bounds);
							if (!pt._layer._map) { map.addLayer(pt._layer); }
							break;
						}
					}
					L.gmxUtil.loaderStatus(val, true);
				});
			}
		},
		privaz: function privaz(ev, feature) {
			var ref = this.get();
			var snap = ref.snap;
			var geoJson = feature.toGeoJSON(),
				latlngs = L.geoJson(geoJson).getLayers()[0].getLatLngs();
				
			if (latlngs[0][0] instanceof L.LatLng) {
				latlngs = latlngs[0];
			}

			snap.latlng = this._getLatlng(latlngs[0]);
			
			this.declination = geoMag$1(snap.latlng[0], snap.latlng[1], 0).dec - this.sbl_mer(latlngs[0].lat, latlngs[0].lng);
			this.delta = 1;
			latlngs.push(latlngs[0]);
			
			snap.snap = [[]];
			var ring = getAngleDist(latlngs[0], latlngs, this.declination, this.delta);
			ring.shift();
			snap.ring = ring;
			feature.remove();
			this.set({snap: snap});
		},
		_getLatlng: function _getLatlng(latlng) {
			return [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))];
		},
		getCenter: function getCenter(ev) {
	 				var ref = this.get();
	 				var snap = ref.snap;
	 				var map = ref.map;
			snap.latlng = this._getLatlng(ev.latlng);
			this.set({snap: snap});
		}
	};

	function onstate(ref) {
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

		if (changed.step && current.step === 1) {
			this.toggleContextmenu(current.step);
		}

	 console.log('snap onstate', current._lastProps, current);
		if (changed.snap) {
			var snap = current.snap,
				quadrantValues = current.quadrantValues,
				item = current.item,
				hashCols = current.hashCols;
			if (!snap.latlng && quadrantValues && item && hashCols && current.map) {
				var out = {},
					kv = item[hashCols.kv || hashCols.kvartal];
				if (quadrantValues[kv]) {
					var bbox = quadrantValues[kv].bbox,
						min = bbox.min,
						max = bbox.max;
					current.map.fitBounds([[min.y, min.x], [max.y, max.x]]);
					out.latlng = bbox.getCenter();
					this.declination = geoMag$1(out.latlng[0], out.latlng[1], 0).dec - this.sbl_mer(out.latlng[0], out.latlng[1]);
					// this.delta = out.latlng[0] ? 1 / Math.cos(out.latlng[0] * Math.PI / 180) : 1;
					this.delta = 1;
					var p = new L.LatLng(out.latlng[1], out.latlng[0]),
						center = p,
						fp = null;
					if (!snap.ring && item && hashCols) {
						var geo = item[hashCols.geomixergeojson],
							geoJSON = L.geoJson(L.gmxUtil.geometryToGeoJSON(geo)),
							latlngs = geoJSON.getLayers()[0].getLatLngs()[0];
						fp = latlngs[0];
						latlngs.unshift(latlngs[0]);
						var ring = getAngleDist(p, latlngs, this.declination, this.delta);
						ring.shift();
						ring.shift();
						p = latlngs[latlngs.length - 1];
						var bearing = L.GeometryUtil.bearing(p, fp);
						bearing = Math.floor(bearing * 100) / 100;
						ring.push([
							bearing + (bearing < 0 ? 360 : 0),
							L.gmxUtil.distVincenty(p.lng, p.lat, fp.lng, fp.lat)
						]);
						out.ring = ring;
					}
					if (!snap.snap) {
						var bearing$1 = L.GeometryUtil.bearing(fp, center);
						bearing$1 = Math.floor(bearing$1 * 100) / 100;
						out.snap = [[
							bearing$1 + (bearing$1 < 0 ? 360 : 0),
							L.gmxUtil.distVincenty(fp.lng, fp.lat, center.lng, center.lat)
						]];
					}
					snap = out;
					this.set({snap: out, kvartal: kv});
					this.reDrawing(snap, true);
					return;
				}
			// } else if (this._focusNode !== undefined) {
				// console.log('sssssss', this._focusNode);
				// this.set({snap: {
					// snap: [[]],
					// ring: [[]]
				// }});
			}
			this.reDrawing(snap);
		}
	}
	function onupdate(ref) {
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

		if (changed.cancel && current.cancel) {
			this.toggleContextmenu(0);
		}
		if (changed.snap && this._focusNode) {
			var arr = document.getElementsByName(this._focusNode);
			if (arr && arr.length) {
				arr[0].focus();
				arr[0].select();
			}
			this._focusNode = undefined;
		}
	}
	function get_each_context_4(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.pt = list[i];
		return child_ctx;
	}

	function change_handler(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.set({reportType: this.options[this.selectedIndex].value});
	}

	function get_each_context_3(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.kk = list[i];
		return child_ctx;
	}

	function get_each_context_2(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.k = list[i];
		return child_ctx;
	}

	function click_handler_3(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.delPoint(this);
	}

	function click_handler_2(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.nextPoint(this);
	}

	function input_handler_3(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.setPoint(event);
	}

	function keyup_handler_3(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.onKeyUp(event);
	}

	function input_handler_2(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.setPoint(event);
	}

	function keyup_handler_2(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.onKeyUp(event);
	}

	function get_each1_context(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		child_ctx.i = i;
		return child_ctx;
	}

	function click_handler_1(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.delPoint(this);
	}

	function click_handler(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.nextPoint(this);
	}

	function input_handler_1(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.setPoint(event);
	}

	function keyup_handler_1(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.onKeyUp(event);
	}

	function input_handler(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.setPoint(event);
	}

	function keyup_handler(event) {
		var ref = this._svelte;
		var component = ref.component;

		component.onKeyUp(event);
	}

	function get_each0_context(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		child_ctx.i = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function get_each_context$2(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function create_main_fragment$2(component, ctx) {
		var div1, div0, text_1, current;

		function select_block_type(ctx) {
			if (ctx.step === 1) { return create_if_block$1; }
			return create_else_block;
		}

		var current_block_type = select_block_type(ctx);
		var if_block = current_block_type(component, ctx);

		return {
			c: function c() {
				div1 = createElement("div");
				div0 = createElement("div");
				div0.textContent = "Добавление делянки";
				text_1 = createText("\r\n");
				if_block.c();
				div0.className = "pop_title svelte-10h989y";
				div1.className = "main_pop_cont_2 svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div1, text_1);
				if_block.m(div1, null);
				current = true;
			},

			p: function p(changed, ctx) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block.d(1);
					if_block = current_block_type(component, ctx);
					if_block.c();
					if_block.m(div1, null);
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: run,

			d: function d(detach) {
				if (detach) {
					detachNode(div1);
				}

				if_block.d();
			}
		};
	}

	// (997:0) {:else}
	function create_else_block(component, ctx) {
		var div5, div4, text4, text5, div8, div6, text7, div7;

		var each_value_2 = ctx.Object.keys(ctx.hashCols);

		var each_blocks = [];

		for (var i = 0; i < each_value_2.length; i += 1) {
			each_blocks[i] = create_each_block_4(component, get_each_context_2(ctx, each_value_2, i));
		}

		function click_handler_4(event) {
			component.cancelMe();
		}

		function click_handler_5(event) {
			component.nextStep();
		}

		return {
			c: function c() {
				div5 = createElement("div");
				div4 = createElement("div");
				div4.innerHTML = "<div class=\"pop_ro_title_big svelte-10h989y\">Шаг 2. Информация</div>\n\t\t\t\t\t\t<div class=\"info svelte-10h989y\">Важно!\n\t\t\t\t\t\t\t<div class=\"main_pop_cont_4_Imp svelte-10h989y\"><div class=\"main_pop_cont_4_Imp_text  svelte-10h989y\">\n\t\t\t\t\t\t\t\t   на основе этой информации Вы будете создавать отчет, поэтому мы бы рекомендовали заполнить ее сразу, в процессе добавления делянки\n\t\t\t\t\t\t\t\t</div></div></div>";
				text4 = createText("\r\n\r\n");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text5 = createText("\r\n\t");
				div8 = createElement("div");
				div6 = createElement("div");
				div6.textContent = "Отмена";
				text7 = createText("\r\n\t\t");
				div7 = createElement("div");
				div7.textContent = "Создать";
				div4.className = "pop_ro_title svelte-10h989y";
				div5.className = "scrollbar svelte-10h989y";
				addListener(div6, "click", click_handler_4);
				div6.className = "pop_bottom_left svelte-10h989y";
				addListener(div7, "click", click_handler_5);
				div7.className = "pop_bottom_right svelte-10h989y";
				div8.className = "pop_bottom svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div5, anchor);
				append(div5, div4);
				append(div5, text4);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div5, null);
				}

				component.refs.scroll = div5;
				insert(target, text5, anchor);
				insert(target, div8, anchor);
				append(div8, div6);
				append(div8, text7);
				append(div8, div7);
			},

			p: function p(changed, ctx) {
				if (changed.Object || changed.hashCols || changed.reportType || changed.isForestCols || changed.fieldsConf || changed._lastProps) {
					each_value_2 = ctx.Object.keys(ctx.hashCols);

					for (var i = 0; i < each_value_2.length; i += 1) {
						var child_ctx = get_each_context_2(ctx, each_value_2, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_4(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div5, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_2.length;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div5);
				}

				destroyEach(each_blocks, detach);

				if (component.refs.scroll === div5) { component.refs.scroll = null; }
				if (detach) {
					detachNode(text5);
					detachNode(div8);
				}

				removeListener(div6, "click", click_handler_4);
				removeListener(div7, "click", click_handler_5);
			}
		};
	}

	// (915:0) {#if step === 1}
	function create_if_block$1(component, ctx) {
		var div13, div1, text1, div3, text3, div4, select, option, text4, span0, text5, text6, div6, text8, div7, span1, text9, input0, input0_value_value, input0_pattern_value, text10, input1, input1_value_value, input1_pattern_value, text11, div8, input2, input2_value_value, input2_class_value, text12, div10, div9, text14, text15, div12, text17, text18, div16, div14, text20, div15;

		var if_block0 = (ctx.quadrantIds) && create_if_block_2(component, ctx);

		function change_handler(event) {
			component.setNodeField(this, true);
		}

		function click_handler(event) {
			component.createKvartal();
		}

		var if_block1 = (ctx.listQuadrants) && create_if_block_1(component, ctx);

		function click_handler_1(event) {
			component.coordFormatChange(this);
		}

		function input_handler(event) {
			component.setPoint(event);
		}

		function paste_handler(event) {
			component.fromClipboard(event);
		}

		function input_handler_1(event) {
			component.setPoint(event);
		}

		function paste_handler_1(event) {
			component.fromClipboard(event);
		}

		function input_handler_2(event) {
			component.setLatlngPoint(event);
		}

		var each0_value = ctx.snapArr;

		var each0_blocks = [];

		for (var i = 0; i < each0_value.length; i += 1) {
			each0_blocks[i] = create_each_block_1(component, get_each0_context(ctx, each0_value, i));
		}

		var each1_value = ctx.ringArr || [[]];

		var each1_blocks = [];

		for (var i = 0; i < each1_value.length; i += 1) {
			each1_blocks[i] = create_each_block$2(component, get_each1_context(ctx, each1_value, i));
		}

		function click_handler_4(event) {
			component.cancelMe();
		}

		function click_handler_5(event) {
			component.nextStep();
		}

		return {
			c: function c() {
				div13 = createElement("div");
				div1 = createElement("div");
				div1.innerHTML = "<div class=\"pop_ro_title_big svelte-10h989y\">Шаг 1. Контур делянки</div>";
				text1 = createText("\r\n\t\t\r\n\t\t");
				div3 = createElement("div");
				div3.innerHTML = "<div class=\"pop_ro_title_left svelte-10h989y\"><label class=\"custom-control-label svelte-10h989y\">Слой квартальной сети</label></div>";
				text3 = createText("\r\n\t\t");
				div4 = createElement("div");
				select = createElement("select");
				option = createElement("option");
				if (if_block0) { if_block0.c(); }
				text4 = createText("\r\n\t\t\t");
				span0 = createElement("span");
				text5 = createText("\r\n");
				if (if_block1) { if_block1.c(); }
				text6 = createText("\r\n\t\t");
				div6 = createElement("div");
				div6.innerHTML = "<div class=\"pop_ro_title_left svelte-10h989y\"><label class=\"custom-control-label svelte-10h989y\" for=\"defaultUnchecked\">Координаты опорной точки</label></div>";
				text8 = createText("\r\n\t\t");
				div7 = createElement("div");
				span1 = createElement("span");
				text9 = createText("\r\n\t\t\t");
				input0 = createElement("input");
				text10 = createText("\r\n\t\t\t");
				input1 = createElement("input");
				text11 = createText("\r\n\t\t");
				div8 = createElement("div");
				input2 = createElement("input");
				text12 = createText("\r\n\t\t");
				div10 = createElement("div");
				div9 = createElement("div");
				div9.textContent = "Привязочный ход";
				text14 = createText("\r\n\r\n\t\t");

				for (var i = 0; i < each0_blocks.length; i += 1) {
					each0_blocks[i].c();
				}

				text15 = createText("\r\n\r\n\t\t");
				div12 = createElement("div");
				div12.innerHTML = "<div class=\"pop_ro_title_left svelte-10h989y\">Контур делянки</div>";
				text17 = createText("\r\n\r\n\t\t");

				for (var i = 0; i < each1_blocks.length; i += 1) {
					each1_blocks[i].c();
				}

				text18 = createText("\r\n\t");
				div16 = createElement("div");
				div14 = createElement("div");
				div14.textContent = "Отмена";
				text20 = createText("\r\n\t\t");
				div15 = createElement("div");
				div15.textContent = "Далее";
				div1.className = "pop_ro_title svelte-10h989y";
				div3.className = "pop_ro_title_radio svelte-10h989y";
				option.__value = "";
				option.value = option.__value;
				option.className = "svelte-10h989y";
				addListener(select, "change", change_handler);
				select.name = "quadrantLayerId";
				select.className = "quadrantLayerId gmx-sidebar-select-large svelte-10h989y";
				addListener(span0, "click", click_handler);
				span0.className = "pop_upload svelte-10h989y";
				setAttribute(span0, "alt", "pop_upload");
				div4.className = "pop_ro_title svelte-10h989y";
				div6.className = "pop_ro_title_radio svelte-10h989y";
				addListener(span1, "click", click_handler_1);
				span1.className = "leaflet-gmx-coordFormatChange svelte-10h989y";
				span1.title = "Сменить формат координат";
				addListener(input0, "input", input_handler);
				addListener(input0, "paste", paste_handler);
				input0.name = "lat";
				input0.value = input0_value_value = ctx.latlng ? ctx.latlng[0] : '';
				input0.className = "inp_pop_mini lat error svelte-10h989y";
				input0.placeholder = "lat";
				setAttribute(input0, "type", "number");
				input0.pattern = input0_pattern_value = ctx.paterns.latlng;
				input0.min = "-90";
				input0.max = "90";
				input0.step = "0.002";
				addListener(input1, "input", input_handler_1);
				addListener(input1, "paste", paste_handler_1);
				input1.name = "lng";
				input1.value = input1_value_value = ctx.latlng ? ctx.latlng[1] : '';
				input1.className = "inp_pop_mini lng error svelte-10h989y";
				input1.placeholder = "long";
				setAttribute(input1, "type", "number");
				input1.pattern = input1_pattern_value = ctx.paterns.latlng;
				input1.min = "-180";
				input1.max = "180";
				input1.step = "0.002";
				div7.className = "pop_ro pop_ro_radio_input point svelte-10h989y";
				addListener(input2, "input", input_handler_2);
				input2.name = "latlng";
				input2.disabled = true;
				input2.value = input2_value_value = ctx.latlngPoint ? ctx.latlngPoint : '';
				input2.className = input2_class_value = "inp_pop_mini " + (ctx.latlngPoint ? '' : 'error') + " svelte-10h989y";
				div8.className = "pop_ro pop_ro_radio_input latlngPoint svelte-10h989y";
				div9.className = "pop_ro_title_left svelte-10h989y";
				div10.className = "p_block snap svelte-10h989y";
				div12.className = "pop_ro_title svelte-10h989y";
				div13.className = "scrollbar svelte-10h989y";
				addListener(div14, "click", click_handler_4);
				div14.className = "pop_bottom_left svelte-10h989y";
				addListener(div15, "click", click_handler_5);
				div15.className = "pop_bottom_right svelte-10h989y";
				div16.className = "pop_bottom svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div13, anchor);
				append(div13, div1);
				append(div13, text1);
				append(div13, div3);
				append(div13, text3);
				append(div13, div4);
				append(div4, select);
				append(select, option);
				if (if_block0) { if_block0.m(select, null); }
				component.refs.quadrantLayerId = select;
				append(div4, text4);
				append(div4, span0);
				append(div13, text5);
				if (if_block1) { if_block1.m(div13, null); }
				append(div13, text6);
				append(div13, div6);
				append(div13, text8);
				append(div13, div7);
				append(div7, span1);
				append(div7, text9);
				append(div7, input0);
				append(div7, text10);
				append(div7, input1);
				component.refs.sn0 = div7;
				append(div13, text11);
				append(div13, div8);
				append(div8, input2);
				component.refs.sn00 = div8;
				append(div13, text12);
				append(div13, div10);
				append(div10, div9);
				append(div10, text14);

				for (var i = 0; i < each0_blocks.length; i += 1) {
					each0_blocks[i].m(div10, null);
				}

				append(div13, text15);
				append(div13, div12);
				append(div13, text17);

				for (var i = 0; i < each1_blocks.length; i += 1) {
					each1_blocks[i].m(div13, null);
				}

				component.refs.scroll = div13;
				insert(target, text18, anchor);
				insert(target, div16, anchor);
				append(div16, div14);
				append(div16, text20);
				append(div16, div15);
			},

			p: function p(changed, ctx) {
				if (ctx.quadrantIds) {
					if (if_block0) {
						if_block0.p(changed, ctx);
					} else {
						if_block0 = create_if_block_2(component, ctx);
						if_block0.c();
						if_block0.m(select, null);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (ctx.listQuadrants) {
					if (if_block1) {
						if_block1.p(changed, ctx);
					} else {
						if_block1 = create_if_block_1(component, ctx);
						if_block1.c();
						if_block1.m(div13, text6);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if ((changed.latlng) && input0_value_value !== (input0_value_value = ctx.latlng ? ctx.latlng[0] : '')) {
					input0.value = input0_value_value;
				}

				if ((changed.paterns) && input0_pattern_value !== (input0_pattern_value = ctx.paterns.latlng)) {
					input0.pattern = input0_pattern_value;
				}

				if ((changed.latlng) && input1_value_value !== (input1_value_value = ctx.latlng ? ctx.latlng[1] : '')) {
					input1.value = input1_value_value;
				}

				if ((changed.paterns) && input1_pattern_value !== (input1_pattern_value = ctx.paterns.latlng)) {
					input1.pattern = input1_pattern_value;
				}

				if ((changed.latlngPoint) && input2_value_value !== (input2_value_value = ctx.latlngPoint ? ctx.latlngPoint : '')) {
					input2.value = input2_value_value;
				}

				if ((changed.latlngPoint) && input2_class_value !== (input2_class_value = "inp_pop_mini " + (ctx.latlngPoint ? '' : 'error') + " svelte-10h989y")) {
					input2.className = input2_class_value;
				}

				if (changed.Math || changed.snapArr) {
					each0_value = ctx.snapArr;

					for (var i = 0; i < each0_value.length; i += 1) {
						var child_ctx = get_each0_context(ctx, each0_value, i);

						if (each0_blocks[i]) {
							each0_blocks[i].p(changed, child_ctx);
						} else {
							each0_blocks[i] = create_each_block_1(component, child_ctx);
							each0_blocks[i].c();
							each0_blocks[i].m(div10, null);
						}
					}

					for (; i < each0_blocks.length; i += 1) {
						each0_blocks[i].d(1);
					}
					each0_blocks.length = each0_value.length;
				}

				if (changed.Math || changed.ringArr || changed.snapArr) {
					each1_value = ctx.ringArr || [[]];

					for (var i = 0; i < each1_value.length; i += 1) {
						var child_ctx$1 = get_each1_context(ctx, each1_value, i);

						if (each1_blocks[i]) {
							each1_blocks[i].p(changed, child_ctx$1);
						} else {
							each1_blocks[i] = create_each_block$2(component, child_ctx$1);
							each1_blocks[i].c();
							each1_blocks[i].m(div13, null);
						}
					}

					for (; i < each1_blocks.length; i += 1) {
						each1_blocks[i].d(1);
					}
					each1_blocks.length = each1_value.length;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div13);
				}

				if (if_block0) { if_block0.d(); }
				removeListener(select, "change", change_handler);
				if (component.refs.quadrantLayerId === select) { component.refs.quadrantLayerId = null; }
				removeListener(span0, "click", click_handler);
				if (if_block1) { if_block1.d(); }
				removeListener(span1, "click", click_handler_1);
				removeListener(input0, "input", input_handler);
				removeListener(input0, "paste", paste_handler);
				removeListener(input1, "input", input_handler_1);
				removeListener(input1, "paste", paste_handler_1);
				if (component.refs.sn0 === div7) { component.refs.sn0 = null; }
				removeListener(input2, "input", input_handler_2);
				if (component.refs.sn00 === div8) { component.refs.sn00 = null; }

				destroyEach(each0_blocks, detach);

				destroyEach(each1_blocks, detach);

				if (component.refs.scroll === div13) { component.refs.scroll = null; }
				if (detach) {
					detachNode(text18);
					detachNode(div16);
				}

				removeListener(div14, "click", click_handler_4);
				removeListener(div15, "click", click_handler_5);
			}
		};
	}

	// (1011:1) {#if    (k !== 'geomixergeojson' &&  k !== 'gmx_id' &&  k !== 'FRSTAT' &&  k !== 'snap') &&    (     (reportType === 'ИЛ' && k !== 'reforest_t') ||     (reportType === 'ВЛ' && k !== 'form_rub' && k !== 'type_rub')    )   }
	function create_if_block_3(component, ctx) {
		var div1, div0, text0_value = ctx.isForestCols && ctx.fieldsConf[ctx.k] ? ctx.fieldsConf[ctx.k].title : ctx.k, text0, text1, div2;

		function select_block_type_1(ctx) {
			if (ctx.isForestCols && ctx.k === 'report_t') { return create_if_block_4; }
			return create_else_block_1;
		}

		var current_block_type = select_block_type_1(ctx);
		var if_block = current_block_type(component, ctx);

		return {
			c: function c() {
				div1 = createElement("div");
				div0 = createElement("div");
				text0 = createText(text0_value);
				text1 = createText("\r\n\t\t");
				div2 = createElement("div");
				if_block.c();
				div0.className = "pop_ro_title_left svelte-10h989y";
				div1.className = "pop_ro_title svelte-10h989y";
				div2.className = "pop_ro svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div0, text0);
				insert(target, text1, anchor);
				insert(target, div2, anchor);
				if_block.m(div2, null);
			},

			p: function p(changed, ctx) {
				if ((changed.isForestCols || changed.fieldsConf || changed.Object || changed.hashCols) && text0_value !== (text0_value = ctx.isForestCols && ctx.fieldsConf[ctx.k] ? ctx.fieldsConf[ctx.k].title : ctx.k)) {
					setData(text0, text0_value);
				}

				if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block.d(1);
					if_block = current_block_type(component, ctx);
					if_block.c();
					if_block.m(div2, null);
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div1);
					detachNode(text1);
					detachNode(div2);
				}

				if_block.d();
			}
		};
	}

	// (1029:2) {:else}
	function create_else_block_1(component, ctx) {
		var input, input_list_value, input_id_value, input_name_value, input_placeholder_value, text, if_block_anchor;

		var if_block = (ctx._lastProps[ctx.k]) && create_if_block_5(component, ctx);

		return {
			c: function c() {
				input = createElement("input");
				text = createText("\r\n\t\t\t");
				if (if_block) { if_block.c(); }
				if_block_anchor = createComment();
				setAttribute(input, "list", input_list_value = "" + ctx.k + "_");
				input.id = input_id_value = ctx.k;
				input.name = input_name_value = ctx.k;
				input.className = "inp_pop svelte-10h989y";
				input.placeholder = input_placeholder_value = ctx.isForestCols && ctx.fieldsConf[ctx.k] ? ctx.fieldsConf[ctx.k].title : ctx._lastProps[ctx.k] || '';
			},

			m: function m(target, anchor) {
				insert(target, input, anchor);
				insert(target, text, anchor);
				if (if_block) { if_block.m(target, anchor); }
				insert(target, if_block_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if ((changed.Object || changed.hashCols) && input_list_value !== (input_list_value = "" + ctx.k + "_")) {
					setAttribute(input, "list", input_list_value);
				}

				if ((changed.Object || changed.hashCols) && input_id_value !== (input_id_value = ctx.k)) {
					input.id = input_id_value;
				}

				if ((changed.Object || changed.hashCols) && input_name_value !== (input_name_value = ctx.k)) {
					input.name = input_name_value;
				}

				if ((changed.isForestCols || changed.fieldsConf || changed.Object || changed.hashCols || changed._lastProps) && input_placeholder_value !== (input_placeholder_value = ctx.isForestCols && ctx.fieldsConf[ctx.k] ? ctx.fieldsConf[ctx.k].title : ctx._lastProps[ctx.k] || '')) {
					input.placeholder = input_placeholder_value;
				}

				if (ctx._lastProps[ctx.k]) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_5(component, ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(input);
					detachNode(text);
				}

				if (if_block) { if_block.d(detach); }
				if (detach) {
					detachNode(if_block_anchor);
				}
			}
		};
	}

	// (1023:2) {#if isForestCols && k === 'report_t'}
	function create_if_block_4(component, ctx) {
		var select, select_name_value;

		var each_value_3 = ctx.Object.keys(ctx.fieldsConf[ctx.k].onValue);

		var each_blocks = [];

		for (var i = 0; i < each_value_3.length; i += 1) {
			each_blocks[i] = create_each_block_5(component, get_each_context_3(ctx, each_value_3, i));
		}

		return {
			c: function c() {
				select = createElement("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				select._svelte = { component: component };

				addListener(select, "change", change_handler);
				select.name = select_name_value = ctx.k;
				select.className = "reportType gmx-sidebar-select-large svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, select, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select, null);
				}

				component.refs.reportType = select;
			},

			p: function p(changed, ctx) {
				if (changed.Object || changed.fieldsConf || changed.hashCols) {
					each_value_3 = ctx.Object.keys(ctx.fieldsConf[ctx.k].onValue);

					for (var i = 0; i < each_value_3.length; i += 1) {
						var child_ctx = get_each_context_3(ctx, each_value_3, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_5(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_3.length;
				}

				if ((changed.Object || changed.hashCols) && select_name_value !== (select_name_value = ctx.k)) {
					select.name = select_name_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(select);
				}

				destroyEach(each_blocks, detach);

				removeListener(select, "change", change_handler);
				if (component.refs.reportType === select) { component.refs.reportType = null; }
			}
		};
	}

	// (1031:3) {#if _lastProps[k]}
	function create_if_block_5(component, ctx) {
		var datalist, datalist_id_value;

		var each_value_4 = ctx._lastProps[ctx.k];

		var each_blocks = [];

		for (var i = 0; i < each_value_4.length; i += 1) {
			each_blocks[i] = create_each_block_6(component, get_each_context_4(ctx, each_value_4, i));
		}

		return {
			c: function c() {
				datalist = createElement("datalist");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				datalist.id = datalist_id_value = "" + ctx.k + "_";
				datalist.className = "svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, datalist, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(datalist, null);
				}
			},

			p: function p(changed, ctx) {
				if (changed._lastProps || changed.Object || changed.hashCols) {
					each_value_4 = ctx._lastProps[ctx.k];

					for (var i = 0; i < each_value_4.length; i += 1) {
						var child_ctx = get_each_context_4(ctx, each_value_4, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_6(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(datalist, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_4.length;
				}

				if ((changed.Object || changed.hashCols) && datalist_id_value !== (datalist_id_value = "" + ctx.k + "_")) {
					datalist.id = datalist_id_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(datalist);
				}

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (1033:5) {#each _lastProps[k] as pt}
	function create_each_block_6(component, ctx) {
		var option, option_value_value;

		return {
			c: function c() {
				option = createElement("option");
				option.__value = option_value_value = ctx.pt;
				option.value = option.__value;
				option.className = "svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
			},

			p: function p(changed, ctx) {
				if ((changed._lastProps || changed.Object || changed.hashCols) && option_value_value !== (option_value_value = ctx.pt)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (1025:4) {#each Object.keys(fieldsConf[k].onValue) as kk}
	function create_each_block_5(component, ctx) {
		var option, text_value = ctx.fieldsConf[ctx.k].onValue[ctx.kk].title, text, option_value_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.kk;
				option.value = option.__value;
				option.className = "svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.fieldsConf || changed.Object || changed.hashCols) && text_value !== (text_value = ctx.fieldsConf[ctx.k].onValue[ctx.kk].title)) {
					setData(text, text_value);
				}

				if ((changed.Object || changed.fieldsConf || changed.hashCols) && option_value_value !== (option_value_value = ctx.kk)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (1010:0) {#each Object.keys(hashCols) as k}
	function create_each_block_4(component, ctx) {
		var if_block_anchor;

		var if_block = ((ctx.k !== 'geomixergeojson' &&  ctx.k !== 'gmx_id' &&  ctx.k !== 'FRSTAT' &&  ctx.k !== 'snap') &&
			(
				(ctx.reportType === 'ИЛ' && ctx.k !== 'reforest_t') ||
				(ctx.reportType === 'ВЛ' && ctx.k !== 'form_rub' && ctx.k !== 'type_rub')
			)) && create_if_block_3(component, ctx);

		return {
			c: function c() {
				if (if_block) { if_block.c(); }
				if_block_anchor = createComment();
			},

			m: function m(target, anchor) {
				if (if_block) { if_block.m(target, anchor); }
				insert(target, if_block_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if ((ctx.k !== 'geomixergeojson' &&  ctx.k !== 'gmx_id' &&  ctx.k !== 'FRSTAT' &&  ctx.k !== 'snap') &&
			(
				(ctx.reportType === 'ИЛ' && ctx.k !== 'reforest_t') ||
				(ctx.reportType === 'ВЛ' && ctx.k !== 'form_rub' && ctx.k !== 'type_rub')
			)) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_3(component, ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			d: function d(detach) {
				if (if_block) { if_block.d(detach); }
				if (detach) {
					detachNode(if_block_anchor);
				}
			}
		};
	}

	// (927:0) {#if quadrantIds}
	function create_if_block_2(component, ctx) {
		var each_anchor;

		var each_value = ctx.quadrantIds;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block_3(component, get_each_context$2(ctx, each_value, i));
		}

		return {
			c: function c() {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_anchor = createComment();
			},

			m: function m(target, anchor) {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if (changed.quadrantIds || changed.quadrantLayerId) {
					each_value = ctx.quadrantIds;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_3(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_anchor.parentNode, each_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function d(detach) {
				destroyEach(each_blocks, detach);

				if (detach) {
					detachNode(each_anchor);
				}
			}
		};
	}

	// (928:0) {#each quadrantIds as it}
	function create_each_block_3(component, ctx) {
		var option, text_value = ctx.it.title, text, option_value_value, option_selected_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it.id;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.it.id === ctx.quadrantLayerId;
				option.className = "svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.quadrantIds) && text_value !== (text_value = ctx.it.title)) {
					setData(text, text_value);
				}

				if ((changed.quadrantIds) && option_value_value !== (option_value_value = ctx.it.id)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.quadrantIds || changed.quadrantLayerId) && option_selected_value !== (option_selected_value = ctx.it.id === ctx.quadrantLayerId)) {
					option.selected = option_selected_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (935:0) {#if listQuadrants}
	function create_if_block_1(component, ctx) {
		var div1, text1, div2, input, input_value_value, text2, datalist;

		function input_handler(event) {
			component.setKvartal(this);
		}

		var each_value_1 = ctx.listQuadrants;

		var each_blocks = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_2(component, get_each_context_1(ctx, each_value_1, i));
		}

		return {
			c: function c() {
				div1 = createElement("div");
				div1.innerHTML = "<div class=\"pop_ro_title_left svelte-10h989y\"><label class=\"custom-control-label svelte-10h989y\" for=\"defaultUnchecked\">Квартал</label></div>";
				text1 = createText("\r\n\t\t");
				div2 = createElement("div");
				input = createElement("input");
				text2 = createText("\r\n\t\t\t");
				datalist = createElement("datalist");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div1.className = "pop_ro_title_radio svelte-10h989y";
				addListener(input, "input", input_handler);
				input.name = "kvartal";
				input.value = input_value_value = ctx.kvartal || '';
				input.className = " svelte-10h989y";
				setAttribute(input, "list", "kvartal");
				input.title = "Указать квартал";
				datalist.id = "kvartal";
				datalist.className = "svelte-10h989y";
				div2.className = "pop_ro pop_ro_radio_input svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div1, anchor);
				insert(target, text1, anchor);
				insert(target, div2, anchor);
				append(div2, input);
				append(div2, text2);
				append(div2, datalist);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(datalist, null);
				}
			},

			p: function p(changed, ctx) {
				if ((changed.kvartal) && input_value_value !== (input_value_value = ctx.kvartal || '')) {
					input.value = input_value_value;
				}

				if (changed.listQuadrants) {
					each_value_1 = ctx.listQuadrants;

					for (var i = 0; i < each_value_1.length; i += 1) {
						var child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_2(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(datalist, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_1.length;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div1);
					detachNode(text1);
					detachNode(div2);
				}

				removeListener(input, "input", input_handler);

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (942:3) {#each listQuadrants as it}
	function create_each_block_2(component, ctx) {
		var option, option_value_value;

		return {
			c: function c() {
				option = createElement("option");
				option.__value = option_value_value = ctx.it;
				option.value = option.__value;
				option.className = "svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
			},

			p: function p(changed, ctx) {
				if ((changed.listQuadrants) && option_value_value !== (option_value_value = ctx.it)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (962:2) {#each snapArr as it, i}
	function create_each_block_1(component, ctx) {
		var div2, div0, text0, text1, text2_value = ctx.i + 1, text2, text3, input0, input0_value_value, text4, input1, input1_value_value, text5, div1, span0, text6, span1;

		return {
			c: function c() {
				div2 = createElement("div");
				div0 = createElement("div");
				text0 = createText(ctx.i);
				text1 = createText("-");
				text2 = createText(text2_value);
				text3 = createText("\r\n\t\t\t\t");
				input0 = createElement("input");
				text4 = createText("\r\n\t\t\t\t-\r\n\t\t\t\t");
				input1 = createElement("input");
				text5 = createText("\r\n\t\t\t\t");
				div1 = createElement("div");
				span0 = createElement("span");
				text6 = createText("\r\n\t\t\t\t\t");
				span1 = createElement("span");
				div0.className = "pop_ro_title_left svelte-10h989y";

				input0._svelte = { component: component };

				addListener(input0, "keyup", keyup_handler);
				addListener(input0, "input", input_handler);
				input0.name = "snap" + ctx.i + "_a";
				input0.value = input0_value_value = ctx.it[2] || ctx.it[0] || 0;
				input0.className = "inp_pop_mini_m svelte-10h989y";
				input0.placeholder = "Angle";

				input1._svelte = { component: component };

				addListener(input1, "keyup", keyup_handler_1);
				addListener(input1, "input", input_handler_1);
				input1.name = "snap" + ctx.i + "_d";
				input1.value = input1_value_value = ctx.Math.round(ctx.it[1] || 0);
				input1.className = "inp_pop_mini_m svelte-10h989y";
				input1.placeholder = "Distance";
				setAttribute(input1, "type", "number");
				input1.min = "0";
				input1.step = "1";
				input1.size = "6";

				span0._svelte = { component: component };

				addListener(span0, "click", click_handler);
				span0.className = "add_thin_ic addNext svelte-10h989y";
				span0.title = "Добавить строку";

				span1._svelte = { component: component };

				addListener(span1, "click", click_handler_1);
				span1.className = "dotted_ic delItem svelte-10h989y";
				span1.title = "Удалить строку";
				div1.className = "pop_ro_right_dotted svelte-10h989y";
				div2.className = "pop_ro snap svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div0, text0);
				append(div0, text1);
				append(div0, text2);
				append(div2, text3);
				append(div2, input0);
				append(div2, text4);
				append(div2, input1);
				append(div2, text5);
				append(div2, div1);
				append(div1, span0);
				append(div1, text6);
				append(div1, span1);
			},

			p: function p(changed, ctx) {
				if ((changed.snapArr) && input0_value_value !== (input0_value_value = ctx.it[2] || ctx.it[0] || 0)) {
					input0.value = input0_value_value;
				}

				if ((changed.Math || changed.snapArr) && input1_value_value !== (input1_value_value = ctx.Math.round(ctx.it[1] || 0))) {
					input1.value = input1_value_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div2);
				}

				removeListener(input0, "keyup", keyup_handler);
				removeListener(input0, "input", input_handler);
				removeListener(input1, "keyup", keyup_handler_1);
				removeListener(input1, "input", input_handler_1);
				removeListener(span0, "click", click_handler);
				removeListener(span1, "click", click_handler_1);
			}
		};
	}

	// (980:2) {#each ringArr || [[]] as it, i}
	function create_each_block$2(component, ctx) {
		var div2, div0, text0_value = ctx.i + (ctx.snapArr ? ctx.snapArr.length : 0), text0, text1, text2_value = ctx.i === ctx.ringArr.length - 1 ? (ctx.snapArr ? ctx.snapArr.length : 0) : (ctx.snapArr ? ctx.snapArr.length : 0) + ctx.i + 1, text2, text3, input0, input0_value_value, text4, input1, input1_value_value, text5, div1, span0, text6, span1;

		return {
			c: function c() {
				div2 = createElement("div");
				div0 = createElement("div");
				text0 = createText(text0_value);
				text1 = createText("-");
				text2 = createText(text2_value);
				text3 = createText("\r\n\t\t\t");
				input0 = createElement("input");
				text4 = createText("\r\n\t\t\t-\r\n\t\t\t");
				input1 = createElement("input");
				text5 = createText("\r\n\t\t\t");
				div1 = createElement("div");
				span0 = createElement("span");
				text6 = createText("\r\n\t\t\t\t");
				span1 = createElement("span");
				div0.className = "pop_ro_title_left svelte-10h989y";

				input0._svelte = { component: component };

				addListener(input0, "keyup", keyup_handler_2);
				addListener(input0, "input", input_handler_2);
				input0.name = "ring" + ctx.i + "_a";
				input0.value = input0_value_value = ctx.it[2] || ctx.it[0] || 0;
				input0.className = "inp_pop_mini_m svelte-10h989y";

				input1._svelte = { component: component };

				addListener(input1, "keyup", keyup_handler_3);
				addListener(input1, "input", input_handler_3);
				input1.name = "ring" + ctx.i + "_d";
				input1.value = input1_value_value = ctx.Math.round(ctx.it[1] || 0);
				input1.className = "inp_pop_mini_m svelte-10h989y";
				input1.placeholder = "Distance";
				setAttribute(input1, "type", "number");
				input1.min = "0";
				input1.step = "1";

				span0._svelte = { component: component };

				addListener(span0, "click", click_handler_2);
				span0.className = "add_thin_ic addNext svelte-10h989y";
				span0.title = "Добавить строку";

				span1._svelte = { component: component };

				addListener(span1, "click", click_handler_3);
				span1.className = "dotted_ic delItem svelte-10h989y";
				span1.title = "Удалить строку";
				div1.className = "pop_ro_right_dotted svelte-10h989y";
				div2.className = "pop_ro ring ring" + ctx.i + " svelte-10h989y";
			},

			m: function m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div0, text0);
				append(div0, text1);
				append(div0, text2);
				append(div2, text3);
				append(div2, input0);
				append(div2, text4);
				append(div2, input1);
				append(div2, text5);
				append(div2, div1);
				append(div1, span0);
				append(div1, text6);
				append(div1, span1);
			},

			p: function p(changed, ctx) {
				if ((changed.snapArr) && text0_value !== (text0_value = ctx.i + (ctx.snapArr ? ctx.snapArr.length : 0))) {
					setData(text0, text0_value);
				}

				if ((changed.ringArr || changed.snapArr) && text2_value !== (text2_value = ctx.i === ctx.ringArr.length - 1 ? (ctx.snapArr ? ctx.snapArr.length : 0) : (ctx.snapArr ? ctx.snapArr.length : 0) + ctx.i + 1)) {
					setData(text2, text2_value);
				}

				if ((changed.ringArr) && input0_value_value !== (input0_value_value = ctx.it[2] || ctx.it[0] || 0)) {
					input0.value = input0_value_value;
				}

				if ((changed.Math || changed.ringArr) && input1_value_value !== (input1_value_value = ctx.Math.round(ctx.it[1] || 0))) {
					input1.value = input1_value_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div2);
				}

				removeListener(input0, "keyup", keyup_handler_2);
				removeListener(input0, "input", input_handler_2);
				removeListener(input1, "keyup", keyup_handler_3);
				removeListener(input1, "input", input_handler_3);
				removeListener(span0, "click", click_handler_2);
				removeListener(span1, "click", click_handler_3);
			}
		};
	}

	function Snapping(options) {
		var this$1 = this;

		init(this, options);
		this.refs = {};
		this._state = assign(assign({ Math : Math, Object : Object }, data$2()), options.data);

		this._recompute({ meta: 1, snap: 1, quadrantValues: 1 }, this._state);
		this._intro = !!options.intro;

		this._handlers.state = [onstate];
		this._handlers.update = [onupdate];

		onstate.call(this, { changed: assignTrue({}, this._state), current: this._state });

		this._fragment = create_main_fragment$2(this, this._state);

		this.root._oncreate.push(function () {
			this$1.fire("update", { changed: assignTrue({}, this$1._state), current: this$1._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Snapping.prototype, proto);
	assign(Snapping.prototype, methods$2);

	Snapping.prototype._recompute = function _recompute(changed, state) {
		if (changed.meta) {
			if (this._differs(state.isReqTypeReport, (state.isReqTypeReport = isReqTypeReport(state)))) { changed.isReqTypeReport = true; }
		}

		if (changed.snap) {
			if (this._differs(state.latlng, (state.latlng = latlng$1(state)))) { changed.latlng = true; }
			if (this._differs(state.latlngPoint, (state.latlngPoint = latlngPoint(state)))) { changed.latlngPoint = true; }
			if (this._differs(state.snapArr, (state.snapArr = snapArr(state)))) { changed.snapArr = true; }
			if (this._differs(state.ringArr, (state.ringArr = ringArr(state)))) { changed.ringArr = true; }
		}

		if (changed.quadrantValues) {
			if (this._differs(state.listQuadrants, (state.listQuadrants = listQuadrants(state)))) { changed.listQuadrants = true; }
		}
	};

	/* src\Table.html generated by Svelte v2.16.1 */

	function data$3() {
		return {
			editFlag: false,
			parentComp: null,
			sortType: 'desc',
			sortKey: 'gmx_id',
			reverse: false,
			pageCurr: 1,
			pagesize: 15,
			pageFrom: 0,
			tableItems: [],
			items: [],
			item: null,
			// checked: {},
			hashCols: []
		};
	}
	var methods$3 = {
		sort: function sort(key) {
			var ref = this.get();
			var sortType = ref.sortType;
			// console.log('sort', sortType);
			this.set({sortType: sortType === 'desc' ? 'asc' : 'desc', sortKey: key});
			this.setCurrPage(1);
		},
		checkReverse: function checkReverse(ev) {
			 console.log('checkReverse', ev.ctrlKey);

			var nChecked = {};
			var ctrlKey = ev.ctrlKey;
			var isChecked = ev.target.checked;
			
			if (ctrlKey || isChecked) {
				var ref = this.get();
				var items = ref.items;
				var hashCols = ref.hashCols;
				var checked = ref.checked;
				var nm = hashCols.gmx_id;
				items.forEach(function (it) {
					var id = it[nm];
					if (!ctrlKey || !checked[id]) {
						nChecked[id] = true;
					}
				});
			}
			this.set({checked: nChecked, reverse: isChecked});
			// this.root.set({checked: nChecked});
		},
		checkMe: function checkMe(id) {
			// console.log('checkMe', id);
			var ref = this.get();
			var checked = ref.checked;
			if (checked[id]) {
				delete checked[id];
			} else {
				checked[id] = true;
			}
			this.set({checked: checked});
			// this.root.set({checked: checked});
		},
		sortMe: function sortMe(arr, sortKey, hashCols, sortType) {
			var nm = hashCols[sortKey];
			return arr.sort(function (a, b) {
				var x = b[nm];
				var y = a[nm];
	                return (x < y ? -1 : (x > y ? 1 : 0)) * (sortType === 'desc' ? -1 : 1);
			});
		},
		pageTo: function pageTo(nm) {
			var ref = this.get();
			var pageFrom = ref.pageFrom;
			this.set({pageCurr: nm});
			nm = nm < 1 ? 1 : (nm > pageFrom ? pageFrom : nm);
			this.setCurrPage(nm);
			return nm;
		},
		setItem: function setItem(id) {
			var this$1 = this;

			var ref = this.get();
			var tableItems = ref.tableItems;
			var hashCols = ref.hashCols;
			var prnt = ref.prnt;
			tableItems.forEach(function (it) {
				if(it[hashCols.gmx_id] === id) {
					// let snap = it[hashCols.snap] || null;
		// console.log('setItem', id, snap);
					this$1.set({item: it});
				}
			});
			// this.set({item: snap ? JSON.parse(snap) : {}});
		},
		viewItem: function viewItem(id) {
			var ref = this.get();
			var tableItems = ref.tableItems;
			var hashCols = ref.hashCols;
			this.root.viewItem(id, tableItems, hashCols);
		},
		deleteItem: function deleteItem(id, ev) {
			var ref = this.get();
			var prnt = ref.prnt;
			prnt.deleteItem(id, ev);
		},
		editItem: function editItem(id, del) {
			var ref = this.get();
			var tableItems = ref.tableItems;
			var hashCols = ref.hashCols;
			var prnt = ref.prnt;

			this.root.viewItem(id, tableItems, hashCols);
			var snap = null;
			tableItems.forEach(function (it) {
				if(it[hashCols.gmx_id] === id) {
					snap = it[hashCols.snap];
	// console.log('editItem', id, snap);
				}
			});
			prnt.editItem(id, snap, del);
		},

		setCurrPage: function setCurrPage(nm) {
			// console.log('setCurrPage', nm);
			var ref = this.get();
			var items = ref.items;
			var hashCols = ref.hashCols;
			var pageCurr = ref.pageCurr;
			var pagesize = ref.pagesize;
			var sortKey = ref.sortKey;
			var sortType = ref.sortType;
			nm = nm || pageCurr;
			var beg = pagesize * (nm - 1);

			var arr = (sortKey ? this.sortMe(items, sortKey, hashCols, sortType) : items)
				.slice(beg, beg + pagesize);

			var cnt = items.length / pagesize;
			var pf = Math.floor(cnt);
			// console.log('setCurrPage1', nm, arr, cnt);
			this.set({tableItems: arr, pageCurr: nm, pageFrom: pf + (cnt > pf ? 1 : 0)});
		}
	};

	function onstate$1(ref) {
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

	 // console.log('Table in onstate', changed, current, this.refs.Reverse);
		if (changed.items) {
			if (current.items.length) {
				this.setCurrPage();
			} else {
				this.set({tableItems: [], pageCurr: 1, pageFrom: 0});
			}
			if (this.refs.Reverse) {
				this.refs.Reverse.checked = false;
			}
		}
		if (changed.tableItems) ;
	}
	function click_handler_2$1(event) {
		var ref = this._svelte;
		var component = ref.component;
		var ctx = ref.ctx;

		component.deleteItem(ctx.it[ctx.hashCols.gmx_id], event);
	}

	function click_handler_1$1(event) {
		var ref = this._svelte;
		var component = ref.component;
		var ctx = ref.ctx;

		component.viewItem(ctx.it[ctx.hashCols.gmx_id]);
	}

	function click_handler$1(event) {
		var ref = this._svelte;
		var component = ref.component;
		var ctx = ref.ctx;

		component.editItem(ctx.it[ctx.hashCols.gmx_id]);
	}

	function change_handler$1(event) {
		var ref = this._svelte;
		var component = ref.component;
		var ctx = ref.ctx;

		component.checkMe(ctx.it[ctx.hashCols.gmx_id]);
	}

	function get_each_context$3(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function create_main_fragment$3(component, ctx) {
		var table, tbody, tr0, th0, text0, span0, span0_class_value, text1, th1, text2, span1, span1_class_value, text3, text4, tr1, td, div3, div0, span2, span2_disabled_value, text5, div1, text6, text7, text8, text9, text10, div2, span3, span3_disabled_value, td_colspan_value, current;

		var if_block = (!ctx.editFlag) && create_if_block_3$1(component, ctx);

		function click_handler(event) {
			component.sort('gmx_id');
		}

		function click_handler_1(event) {
			component.sort('FRSTAT');
		}

		var each_value = ctx.tableItems;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$3(component, get_each_context$3(ctx, each_value, i));
		}

		function click_handler_3(event) {
			component.pageTo(ctx.pageCurr - 1);
		}

		function click_handler_4(event) {
			component.pageTo(ctx.pageCurr + 1);
		}

		return {
			c: function c() {
				table = createElement("table");
				tbody = createElement("tbody");
				tr0 = createElement("tr");
				th0 = createElement("th");
				if (if_block) { if_block.c(); }
				text0 = createText("\r\n\t\tID");
				span0 = createElement("span");
				text1 = createText("\r\n\t\t");
				th1 = createElement("th");
				text2 = createText("Статус");
				span1 = createElement("span");
				text3 = createText("\r\n ");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text4 = createText("\r\n ");
				tr1 = createElement("tr");
				td = createElement("td");
				div3 = createElement("div");
				div0 = createElement("div");
				span2 = createElement("span");
				text5 = createText("\r\n\t\t  ");
				div1 = createElement("div");
				text6 = createText("Страница ");
				text7 = createText(ctx.pageCurr);
				text8 = createText("/");
				text9 = createText(ctx.pageFrom);
				text10 = createText("\r\n\t\t  ");
				div2 = createElement("div");
				span3 = createElement("span");
				addListener(span0, "click", click_handler);
				span0.className = span0_class_value = "c2 sorting " + (ctx.sortKey === 'gmx_id' ? (ctx.sortType === 'desc' ? 'sorting-desc' : 'sorting-asc') : '') + " svelte-4wbbt";
				th0.className = "svelte-4wbbt";
				span1.className = span1_class_value = "c2 sorting " + (ctx.sortKey === 'FRSTAT' ? (ctx.sortType === 'desc' ? 'sorting-desc' : 'sorting-asc') : '') + " svelte-4wbbt";
				addListener(th1, "click", click_handler_1);
				th1.className = "svelte-4wbbt";
				tr0.className = "tabl_main_cont_tr svelte-4wbbt";
				addListener(span2, "click", click_handler_3);
				setAttribute(span2, "disabled", span2_disabled_value = ctx.pageCurr === 1);
				span2.className = "svelte-4wbbt";
				div0.className = "bottom_tabl_block_left svelte-4wbbt";
				div1.className = "bottom_tabl_block_middle svelte-4wbbt";
				addListener(span3, "click", click_handler_4);
				setAttribute(span3, "disabled", span3_disabled_value = ctx.pageFrom === ctx.pageCurr);
				span3.className = "svelte-4wbbt";
				div2.className = "bottom_tabl_block_right svelte-4wbbt";
				div3.className = "bottom_tabl_block svelte-4wbbt";
				td.colSpan = td_colspan_value = ctx.editFlag ? 2 : 3;
				td.className = "no_pad svelte-4wbbt";
				tr1.className = "svelte-4wbbt";
				table.className = "tabl_main_cont svelte-4wbbt";
			},

			m: function m(target, anchor) {
				insert(target, table, anchor);
				append(table, tbody);
				append(tbody, tr0);
				append(tr0, th0);
				if (if_block) { if_block.m(th0, null); }
				append(th0, text0);
				append(th0, span0);
				append(tr0, text1);
				append(tr0, th1);
				append(th1, text2);
				append(th1, span1);
				append(tbody, text3);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(tbody, null);
				}

				append(tbody, text4);
				append(tbody, tr1);
				append(tr1, td);
				append(td, div3);
				append(div3, div0);
				append(div0, span2);
				append(div3, text5);
				append(div3, div1);
				append(div1, text6);
				append(div1, text7);
				append(div1, text8);
				append(div1, text9);
				append(div3, text10);
				append(div3, div2);
				append(div2, span3);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				if (!ctx.editFlag) {
					if (!if_block) {
						if_block = create_if_block_3$1(component, ctx);
						if_block.c();
						if_block.m(th0, text0);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if ((changed.sortKey || changed.sortType) && span0_class_value !== (span0_class_value = "c2 sorting " + (ctx.sortKey === 'gmx_id' ? (ctx.sortType === 'desc' ? 'sorting-desc' : 'sorting-asc') : '') + " svelte-4wbbt")) {
					span0.className = span0_class_value;
				}

				if ((changed.sortKey || changed.sortType) && span1_class_value !== (span1_class_value = "c2 sorting " + (ctx.sortKey === 'FRSTAT' ? (ctx.sortType === 'desc' ? 'sorting-desc' : 'sorting-asc') : '') + " svelte-4wbbt")) {
					span1.className = span1_class_value;
				}

				if (changed.item || changed.hashCols || changed.tableItems || changed.editFlag || changed.checked) {
					each_value = ctx.tableItems;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context$3(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$3(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(tbody, text4);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}

				if ((changed.pageCurr) && span2_disabled_value !== (span2_disabled_value = ctx.pageCurr === 1)) {
					setAttribute(span2, "disabled", span2_disabled_value);
				}

				if (changed.pageCurr) {
					setData(text7, ctx.pageCurr);
				}

				if (changed.pageFrom) {
					setData(text9, ctx.pageFrom);
				}

				if ((changed.pageFrom || changed.pageCurr) && span3_disabled_value !== (span3_disabled_value = ctx.pageFrom === ctx.pageCurr)) {
					setAttribute(span3, "disabled", span3_disabled_value);
				}

				if ((changed.editFlag) && td_colspan_value !== (td_colspan_value = ctx.editFlag ? 2 : 3)) {
					td.colSpan = td_colspan_value;
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: run,

			d: function d(detach) {
				if (detach) {
					detachNode(table);
				}

				if (if_block) { if_block.d(); }
				removeListener(span0, "click", click_handler);
				removeListener(th1, "click", click_handler_1);

				destroyEach(each_blocks, detach);

				removeListener(span2, "click", click_handler_3);
				removeListener(span3, "click", click_handler_4);
			}
		};
	}

	// (145:2) {#if !editFlag}
	function create_if_block_3$1(component, ctx) {
		var input;

		function click_handler(event) {
			component.checkReverse(event);
		}

		return {
			c: function c() {
				input = createElement("input");
				addListener(input, "click", click_handler);
				setAttribute(input, "type", "checkbox");
			},

			m: function m(target, anchor) {
				insert(target, input, anchor);
				component.refs.Reverse = input;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(input);
				}

				removeListener(input, "click", click_handler);
				if (component.refs.Reverse === input) { component.refs.Reverse = null; }
			}
		};
	}

	// (154:2) {#if !editFlag}
	function create_if_block_2$1(component, ctx) {
		var input, input_checked_value;

		return {
			c: function c() {
				input = createElement("input");
				input._svelte = { component: component, ctx: ctx };

				addListener(input, "change", change_handler$1);
				input.checked = input_checked_value = ctx.checked[ctx.it[ctx.hashCols.gmx_id]];
				setAttribute(input, "type", "checkbox");
			},

			m: function m(target, anchor) {
				insert(target, input, anchor);
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				input._svelte.ctx = ctx;
				if ((changed.checked || changed.tableItems || changed.hashCols) && input_checked_value !== (input_checked_value = ctx.checked[ctx.it[ctx.hashCols.gmx_id]])) {
					input.checked = input_checked_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(input);
				}

				removeListener(input, "change", change_handler$1);
			}
		};
	}

	// (163:4) {#if editFlag}
	function create_if_block_1$1(component, ctx) {
		var span;

		return {
			c: function c() {
				span = createElement("span");
				span._svelte = { component: component, ctx: ctx };

				addListener(span, "click", click_handler$1);
				span.className = "sketch_ic svelte-4wbbt";
				span.title = "Редактировать";
			},

			m: function m(target, anchor) {
				insert(target, span, anchor);
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				span._svelte.ctx = ctx;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(span);
				}

				removeListener(span, "click", click_handler$1);
			}
		};
	}

	// (167:4) {#if editFlag}
	function create_if_block$2(component, ctx) {
		var span;

		return {
			c: function c() {
				span = createElement("span");
				span._svelte = { component: component, ctx: ctx };

				addListener(span, "click", click_handler_2$1);
				span.className = "delete_ic svelte-4wbbt";
				span.title = "Удалить";
			},

			m: function m(target, anchor) {
				insert(target, span, anchor);
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				span._svelte.ctx = ctx;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(span);
				}

				removeListener(span, "click", click_handler_2$1);
			}
		};
	}

	// (151:1) {#each tableItems as it}
	function create_each_block$3(component, ctx) {
		var tr, td0, text0, text1_value = ctx.it[ctx.hashCols.gmx_id], text1, text2, td1, div2, div0, span0, span0_class_value, span0_title_value, text3, div1, text4, span1, text5, tr_class_value;

		var if_block0 = (!ctx.editFlag) && create_if_block_2$1(component, ctx);

		var if_block1 = (ctx.editFlag) && create_if_block_1$1(component, ctx);

		var if_block2 = (ctx.editFlag) && create_if_block$2(component, ctx);

		return {
			c: function c() {
				tr = createElement("tr");
				td0 = createElement("td");
				if (if_block0) { if_block0.c(); }
				text0 = createText("\r\n\t\t");
				text1 = createText(text1_value);
				text2 = createText("\r\n\t\t");
				td1 = createElement("td");
				div2 = createElement("div");
				div0 = createElement("div");
				span0 = createElement("span");
				text3 = createText("\r\n\t\t\t\t");
				div1 = createElement("div");
				if (if_block1) { if_block1.c(); }
				text4 = createText("\r\n\t\t\t\t\t");
				span1 = createElement("span");
				text5 = createText("\r\n\t\t\t\t");
				if (if_block2) { if_block2.c(); }
				td0.className = "c2 svelte-4wbbt";
				span0.className = span0_class_value = "" + (ctx.it[ctx.hashCols.FRSTAT] > 0 ? 'checked' : '') + " svelte-4wbbt";
				span0.title = span0_title_value = "Отчет" + (ctx.it[ctx.hashCols.FRSTAT] > 0 ? '' : ' не') + " создан";
				div0.className = "td_round svelte-4wbbt";

				span1._svelte = { component: component, ctx: ctx };

				addListener(span1, "click", click_handler_1$1);
				span1.className = "marker_ic svelte-4wbbt";
				span1.title = "Центрировать";
				div1.className = "td_icons_right svelte-4wbbt";
				div2.className = "td_last_edit svelte-4wbbt";
				td1.className = "c3 svelte-4wbbt";
				tr.className = tr_class_value = "item " + (ctx.item && ctx.item[ctx.hashCols.gmx_id] === ctx.it[ctx.hashCols.gmx_id] ? 'current' : '') + " svelte-4wbbt";
			},

			m: function m(target, anchor) {
				insert(target, tr, anchor);
				append(tr, td0);
				if (if_block0) { if_block0.m(td0, null); }
				append(td0, text0);
				append(td0, text1);
				append(tr, text2);
				append(tr, td1);
				append(td1, div2);
				append(div2, div0);
				append(div0, span0);
				append(div2, text3);
				append(div2, div1);
				if (if_block1) { if_block1.m(div1, null); }
				append(div1, text4);
				append(div1, span1);
				append(div1, text5);
				if (if_block2) { if_block2.m(div1, null); }
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				if (!ctx.editFlag) {
					if (if_block0) {
						if_block0.p(changed, ctx);
					} else {
						if_block0 = create_if_block_2$1(component, ctx);
						if_block0.c();
						if_block0.m(td0, text0);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if ((changed.tableItems || changed.hashCols) && text1_value !== (text1_value = ctx.it[ctx.hashCols.gmx_id])) {
					setData(text1, text1_value);
				}

				if ((changed.tableItems || changed.hashCols) && span0_class_value !== (span0_class_value = "" + (ctx.it[ctx.hashCols.FRSTAT] > 0 ? 'checked' : '') + " svelte-4wbbt")) {
					span0.className = span0_class_value;
				}

				if ((changed.tableItems || changed.hashCols) && span0_title_value !== (span0_title_value = "Отчет" + (ctx.it[ctx.hashCols.FRSTAT] > 0 ? '' : ' не') + " создан")) {
					span0.title = span0_title_value;
				}

				if (ctx.editFlag) {
					if (if_block1) {
						if_block1.p(changed, ctx);
					} else {
						if_block1 = create_if_block_1$1(component, ctx);
						if_block1.c();
						if_block1.m(div1, text4);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				span1._svelte.ctx = ctx;

				if (ctx.editFlag) {
					if (if_block2) {
						if_block2.p(changed, ctx);
					} else {
						if_block2 = create_if_block$2(component, ctx);
						if_block2.c();
						if_block2.m(div1, null);
					}
				} else if (if_block2) {
					if_block2.d(1);
					if_block2 = null;
				}

				if ((changed.item || changed.hashCols || changed.tableItems) && tr_class_value !== (tr_class_value = "item " + (ctx.item && ctx.item[ctx.hashCols.gmx_id] === ctx.it[ctx.hashCols.gmx_id] ? 'current' : '') + " svelte-4wbbt")) {
					tr.className = tr_class_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(tr);
				}

				if (if_block0) { if_block0.d(); }
				if (if_block1) { if_block1.d(); }
				removeListener(span1, "click", click_handler_1$1);
				if (if_block2) { if_block2.d(); }
			}
		};
	}

	function Table(options) {
		var this$1 = this;

		init(this, options);
		this.refs = {};
		this._state = assign(data$3(), options.data);
		this._intro = !!options.intro;

		this._handlers.state = [onstate$1];

		onstate$1.call(this, { changed: assignTrue({}, this._state), current: this._state });

		this._fragment = create_main_fragment$3(this, this._state);

		this.root._oncreate.push(function () {
			this$1.fire("update", { changed: assignTrue({}, this$1._state), current: this$1._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Table.prototype, proto);
	assign(Table.prototype, methods$3);

	/* src\Sites.html generated by Svelte v2.16.1 */



	function snap(ref) {
		var item = ref.item;
		var hashCols = ref.hashCols;

		var out = {};
		if (item) {
			var snap = item[hashCols.snap];
			if (snap) {
				try {
					out = JSON.parse(snap);
				} catch (e) {
					return out;
				}
			}
		}
		return out;
	}

	function data$4() {
		return {
			prnt: this,
			error: '',
			askMode: false,
			layerItems: null,
			hashCols: {},
			checked: {},
			quadrantLayerId: '',
			quadrantIds: [],
			quadrantValues: null,
			item: null,
			delAsk: 0,
			delID: 0,
			delAskStyle: '',
			thisComp: null,
			layerID: '',
			layerIds: []
		}
	}
	var methods$4 = {
		colsToHash: function colsToHash$$1(arr) {
			return arr.reduce(function (a, v, i) { a[v] = i; return a; }, {});
		},
		setNodeField: function setNodeField(node, setFlag) {
			var ref = this.get();
			var map = ref.map;
			var gmxMap = ref.gmxMap;
			var val = node.options ? node.options[node.selectedIndex].value : node.value,
				name = node.name;

	// console.log('setNodeField', node, setFlag, val, gmxMap);
			if (val) {
				this.regetFeatures(val);
	/*
				let layer = gmxMap.layersByID[val],
					meta = layer.getGmxProperties().MetaProperties;

				Requests.loadFeatures(val)
				.then(json => {
					if (json.Status === 'ok') {
						let res = json.Result,
							cols = res.fields,
							hashCols = this.colsToHash(cols),
							out = {prnt: this, cols: cols, hashCols: hashCols, layerItems: res.values, layerID: val || '', quadrantLayerId: '', quadrantValues: null},
							latlngBounds = L.latLngBounds();

						res.values.map( it => {
							let bb = L.gmxUtil.getGeometryBounds(it[it.length - 1]);
							latlngBounds.extend([
								[bb.min.y, bb.min.x],
								[bb.max.y, bb.max.x]
							]);
						});
						if (res.values.length) {
							map.fitBounds(latlngBounds);
						}
						if (!layer._map) {
							map.addLayer(layer);
						}

						// Requests.chkLayer(val);

						if (meta.kvartal) {
							let quadrantLayerId = meta.kvartal.Value;
							Requests.loadQuadrantValues(quadrantLayerId)
							.then(json => {
								out.quadrantLayerId = quadrantLayerId;
								out.quadrantValues = json;
								this.set(out);
							});
						} else {
							this.set(out);
						}
					}
				});
	*/
			} else {
				this.set({layerID: ''});
			}
		},

		regetFeatures: function regetFeatures(lid) {
			var this$1 = this;

			var ref = this.get();
			var layerID = ref.layerID;
			var map = ref.map;
			var gmxMap = ref.gmxMap;
			if (lid) { layerID = lid; }
			var layer = gmxMap.layersByID[layerID],
				meta = layer.getGmxProperties().MetaProperties;
			loadFeatures(layerID)
			.then(function (json) {
				if (json.Status === 'ok') {
					var res = json.Result,
						cols = res.fields,
						attr = {prnt: this$1, isForestCols: true, cols: cols, hashCols: this$1.colsToHash(cols), layerItems: res.values, layerID: layerID};

					for (var k in fieldsConf) {
						if (!(k in attr.hashCols)) {

							attr.isForestCols = false;
							break;
						}
					}
	// console.log('kkkkkkk', lid, attr);
					if (lid) {
						var latlngBounds = L.latLngBounds();
						res.values.forEach( function (it) {
							var bb = L.gmxUtil.getGeometryBounds(it[it.length - 1]);
							latlngBounds.extend([
								[bb.min.y, bb.min.x],
								[bb.max.y, bb.max.x]
							]);
						});
						if (res.values.length) {
							map.fitBounds(latlngBounds);
						}
						if (!layer._map) {
							map.addLayer(layer);
						}

						// Requests.chkLayer(val);

						if (meta.kvartal) {
							var quadrantLayerId = meta.kvartal.Value;
							loadQuadrantValues(quadrantLayerId)
							.then(function (json) {
								attr.quadrantLayerId = quadrantLayerId;
								attr.quadrantValues = json;
								this$1.set(attr);
							});
						} else {
							this$1.set(attr);
						}
					}

					this$1.set(attr);
				}
			});
		},

		setField: function setField(key, data) {
			var ref = this.get();
			var changedParams = ref.changedParams;
			changedParams[key] = data;
			this.set({changedParams: changedParams});
		},

		sendExcel: function sendExcel$$1(ev) {
			var this$1 = this;

			sendExcel(ev.target).then(function (json) {
				if (json) {
					if (json.status === 'error') {
						setTimeout(function() { this.set({error: ''}); }.bind(this$1), 5000);
						this$1.set({error: json.text});
					}
					if (json.layerID) {
						this$1.regetLayersIds(json.layerID);
					}
				}
				
	// console.log('sendFile', json);
			});
			this.set({askMode: false});
		},
		sendFile: function sendFile(ev) {
			var this$1 = this;

			sendVectorFile(ev.target, true).then(function (json) {
				if (json) {
					if (json.status === 'error') {
						setTimeout(function() { this.set({error: ''}); }.bind(this$1), 5000);
						this$1.set({error: json.text});
					}
					if (json.layerID) {
						this$1.regetLayersIds(json.layerID);
					}
				}
				
	// console.log('sendFile', json);
			});
			this.set({askMode: false});
		},
		addHand: function addHand() {
	// console.log('addHand');
			this.set({askMode: false});
			this.createSite1();

		},
		
		regetLayersIds: function regetLayersIds(layerID) {
	// console.log('regetLayersIds', layerID);
			var ref = this.get();
			var gmxMap = ref.gmxMap;

			var ph = getLayersIds(gmxMap);
			ph.layerID = layerID;
			this.set(ph);
			this.setNodeField(this.refs.LayerSelect);
	/*
			Requests.getLayersIds(gmxMap).then(json => {
				json.layerID = layerID;
				this.set(json);
				this.setNodeField(this.refs.LayerSelect);
			});
	*/
		},

		createSnap: function createSnap() {
			var ref = this.get();
			var map = ref.map;
			var quadrantLayerId = ref.quadrantLayerId;
			var quadrantIds = ref.quadrantIds;
			var snap = ref.snap;
			var gmxMap = ref.gmxMap;
			var layerID = ref.layerID;
			var item = ref.item;
			var isForestCols = ref.isForestCols;
			var hashCols = ref.hashCols;
			var quadrantValues = ref.quadrantValues;
			var gmxPopup = L.control.gmxPopup({maxHeight: 0, position: 'document', anchor: L.point(451, 430), closeOnMapClick: false}).openOn(map),
				site = new Snapping({
					target: gmxPopup._contentNode,
					data: {
						prnt: this,
						snap: snap,
						layerID: layerID,
						item: item,
						meta: gmxMap.layersByID[layerID].getGmxProperties().MetaProperties,
						isForestCols: isForestCols,
						hashCols: hashCols,
						quadrantLayerId: quadrantLayerId,
						quadrantIds: quadrantIds,
						quadrantValues: quadrantValues,
						gmxPopup: gmxPopup,
						map: map
					}
				});
			map.on('removeControl', site.toggleContextmenu.bind(site));
			site.on('update', function (ref) {
				var changed = ref.changed;
				var current = ref.current;
				var previous = ref.previous;

				if (changed.cancel && current.cancel) {
	// console.log('юююююю json', changed, current, site);
					map.removeControl(gmxPopup);
					// this.set({});
				}
				
			});
			map.gmxControlsManager.add(gmxPopup);
			this.gmxPopup = gmxPopup;
		},
		createSite1: function createSite1() {
			var ref = this.get();
			var map = ref.map;
			var quadrantIds = ref.quadrantIds;
			var gmxPopup = L.control.gmxPopup({maxHeight: 0, position: 'document', anchor: L.point(451, 430), closeOnMapClick: false}).openOn(map),
				site = new CreateSite({
					target: gmxPopup._contentNode,
					data: {
						prnt: this,
						quadrantIds: quadrantIds,
						gmxPopup: gmxPopup,
						map: map
					}
				});
	// console.log('createSite1 json', map);
			map.gmxControlsManager.add(gmxPopup);
			this.gmxPopup = gmxPopup;
		},
		deleteItem: function deleteItem(id, ev) {
			var this$1 = this;

			var ref = this.get();
			var layerID = ref.layerID;
			var delAsk = ref.delAsk;
			var delID = ref.delID;
			
			if (delAsk && delID === id) {
				modifyVectorObjects(layerID, [{"action":"delete","id": delID}]).then(function (argv) {
					this$1.regetFeatures();
				});
				this.set({delAsk: 0});
			} else {
				this.set({delAsk: 1, delID: id, delAskStyle: 'top: '+ (ev.clientY - 30) + 'px; left: 120px;'});
			}
	console.log('deleteItem', delID);
		},
		editItem: function editItem(id, snap, del) {
			var this$1 = this;

			var ref = this.get();
			var map = ref.map;
			var layerID = ref.layerID;
			var hashCols = ref.hashCols;
			var gmxDrawingSnap = null;
			if (snap) {
				try {
					var json = JSON.parse(snap);
					var coords = json.coordinates.map(function (it) { return it.reverse(); });
					gmxDrawingSnap = map.gmxDrawing.add(L.polyline(coords), {pointStyle:{shape: 'circle'}, lineStyle:{color: '#ff0000'}} );
					gmxDrawingSnap.on('editstop dragend rotateend', function (it) {
						var geoJSON = it.object.toGeoJSON(),
							tr = document.getElementsByClassName('edit-obj')[0].getElementsByTagName('tr'),
							inp = tr[tr.length - 1].getElementsByTagName('input')[0];
						inp.value = JSON.stringify(geoJSON.geometry);
					});
					// map.setView(coords[0]);
					// map.fitBounds(gmxDrawingSnap.getBounds());

				} catch (err) {
					console.log('Без привязки', err);
				}
			}
			$(
				editObject(layerID, id, {
					del: del,
					hashCols: hashCols,
					fields: [
						{ name: 'FRSTAT', hide: true },
						{ name: 'snap', hide: true }
					]
				})
			).on ('close', function (e) {
				var target = e.currentTarget,
					geo = JSON.stringify(target.getGeometry()),
					dgeo = JSON.stringify(target.getGeometryObj().toGeoJSON().geometry);

				// flag = geo === dgeo;
				map.gmxDrawing.remove(gmxDrawingSnap);
				this$1.regetFeatures();
			});
			
		},

		setAskMode: function setAskMode() {
			if (this.gmxPopup && this.gmxPopup._map) {
				this.gmxPopup._map.removeControl(this.gmxPopup);
				this.gmxPopup = null;
			}

			this.set({askMode: true});
		},

		editSite: function editSite() {
			var ref = this.get();
			var gmxMap = ref.gmxMap;
			var layerID = ref.layerID;
			var stateSave = ref.stateSave;
	// console.log('editSite', layerID);
			this.currentLayer = gmxMap.layersByID[layerID];
			$(
				editLayer(layerID)
			);
			
			this.regetFeatures();
		}
	};

	function onstate$2(ref) {
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

	 // console.log('Sites onstate', changed, current.layerIds);
		if (changed.gmxMap) {
			var ph = getLayersIds(current.gmxMap);
			this.set(ph);
		}
	}
	function get_each_context$4(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function create_main_fragment$4(component, ctx) {
		var div5, div2, div0, text1, div1, span0, text2, span0_class_value, text3, span1, text5, div3, text6, div4, text7, text8, text9, current;

		function click_handler(event) {
			component.editSite();
		}

		function click_handler_1(event) {
			component.setAskMode();
		}

		var if_block0 = (ctx.layerIds.length) && create_if_block_5$1(component, ctx);

		var if_block1 = (ctx.error) && create_if_block_4$1(component, ctx);

		var if_block2 = (ctx.askMode) && create_if_block_3$2(component, ctx);

		var if_block3 = (ctx.layerID) && create_if_block$3(component, ctx);

		return {
			c: function c() {
				div5 = createElement("div");
				div2 = createElement("div");
				div0 = createElement("div");
				div0.textContent = "Группа делянок";
				text1 = createText("\r\n\t\t");
				div1 = createElement("div");
				span0 = createElement("span");
				text2 = createText("Редактировать");
				text3 = createText("    ");
				span1 = createElement("span");
				span1.textContent = "Создать";
				text5 = createText("\r\n\t");
				div3 = createElement("div");
				if (if_block0) { if_block0.c(); }
				text6 = createText("\r\n\t");
				div4 = createElement("div");
				text7 = createText("\r\n\t");
				if (if_block1) { if_block1.c(); }
				text8 = createText("\r\n\t");
				if (if_block2) { if_block2.c(); }
				text9 = createText("\r\n\r\n\t");
				if (if_block3) { if_block3.c(); }
				div0.className = "main_right_tab_title_left svelte-bz26k5";
				addListener(span0, "click", click_handler);
				span0.className = span0_class_value = "" + (ctx.layerID ? '' : 'disabled') + " svelte-bz26k5";
				addListener(span1, "click", click_handler_1);
				span1.className = "svelte-bz26k5";
				div1.className = "main_right_tab_title_right svelte-bz26k5";
				div2.className = "main_row svelte-bz26k5";
				div3.className = "main_row svelte-bz26k5";
				div4.className = "separator svelte-bz26k5";
				div5.className = "sites svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, div5, anchor);
				append(div5, div2);
				append(div2, div0);
				append(div2, text1);
				append(div2, div1);
				append(div1, span0);
				append(span0, text2);
				append(div1, text3);
				append(div1, span1);
				append(div5, text5);
				append(div5, div3);
				if (if_block0) { if_block0.m(div3, null); }
				append(div5, text6);
				append(div5, div4);
				append(div5, text7);
				if (if_block1) { if_block1.m(div5, null); }
				append(div5, text8);
				if (if_block2) { if_block2.m(div5, null); }
				append(div5, text9);
				if (if_block3) { if_block3.m(div5, null); }
				current = true;
			},

			p: function p(changed, ctx) {
				if ((!current || changed.layerID) && span0_class_value !== (span0_class_value = "" + (ctx.layerID ? '' : 'disabled') + " svelte-bz26k5")) {
					span0.className = span0_class_value;
				}

				if (ctx.layerIds.length) {
					if (if_block0) {
						if_block0.p(changed, ctx);
					} else {
						if_block0 = create_if_block_5$1(component, ctx);
						if_block0.c();
						if_block0.m(div3, null);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (ctx.error) {
					if (if_block1) {
						if_block1.p(changed, ctx);
					} else {
						if_block1 = create_if_block_4$1(component, ctx);
						if_block1.c();
						if_block1.m(div5, text8);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (ctx.askMode) {
					if (!if_block2) {
						if_block2 = create_if_block_3$2(component, ctx);
						if_block2.c();
						if_block2.m(div5, text9);
					}
				} else if (if_block2) {
					if_block2.d(1);
					if_block2 = null;
				}

				if (ctx.layerID) {
					if (if_block3) {
						if_block3.p(changed, ctx);
					} else {
						if_block3 = create_if_block$3(component, ctx);
						if (if_block3) { if_block3.c(); }
					}

					if_block3.i(div5, null);
				} else if (if_block3) {
					if_block3.o(function() {
						if_block3.d(1);
						if_block3 = null;
					});
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (if_block3) { if_block3.o(outrocallback); }
				else { outrocallback(); }

				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div5);
				}

				removeListener(span0, "click", click_handler);
				removeListener(span1, "click", click_handler_1);
				if (if_block0) { if_block0.d(); }
				if (if_block1) { if_block1.d(); }
				if (if_block2) { if_block2.d(); }
				if (if_block3) { if_block3.d(); }
			}
		};
	}

	// (368:2) {#if layerIds.length}
	function create_if_block_5$1(component, ctx) {
		var select, option;

		var each_value = ctx.layerIds;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$4(component, get_each_context$4(ctx, each_value, i));
		}

		function change_handler(event) {
			component.setNodeField(this, true);
		}

		return {
			c: function c() {
				select = createElement("select");
				option = createElement("option");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				option.__value = "";
				option.value = option.__value;
				option.className = "svelte-bz26k5";
				addListener(select, "change", change_handler);
				select.name = "layerID";
				select.className = "select svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, select, anchor);
				append(select, option);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select, null);
				}

				component.refs.LayerSelect = select;
			},

			p: function p(changed, ctx) {
				if (changed.layerIds || changed.layerID) {
					each_value = ctx.layerIds;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context$4(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$4(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(select);
				}

				destroyEach(each_blocks, detach);

				removeListener(select, "change", change_handler);
				if (component.refs.LayerSelect === select) { component.refs.LayerSelect = null; }
			}
		};
	}

	// (371:4) {#each layerIds as it}
	function create_each_block$4(component, ctx) {
		var option, text_value = ctx.it.title, text, option_value_value, option_selected_value, option_class_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it.id;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.layerID === ctx.it.id;
				option.className = option_class_value = "" + (ctx.it.bad ? 'red' : '') + " svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.layerIds) && text_value !== (text_value = ctx.it.title)) {
					setData(text, text_value);
				}

				if ((changed.layerIds) && option_value_value !== (option_value_value = ctx.it.id)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.layerID || changed.layerIds) && option_selected_value !== (option_selected_value = ctx.layerID === ctx.it.id)) {
					option.selected = option_selected_value;
				}

				if ((changed.layerIds) && option_class_value !== (option_class_value = "" + (ctx.it.bad ? 'red' : '') + " svelte-bz26k5")) {
					option.className = option_class_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (378:1) {#if error}
	function create_if_block_4$1(component, ctx) {
		var div, text_value = ctx.error || '', text;

		return {
			c: function c() {
				div = createElement("div");
				text = createText(text_value);
				div.className = "error svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, div, anchor);
				append(div, text);
			},

			p: function p(changed, ctx) {
				if ((changed.error) && text_value !== (text_value = ctx.error || '')) {
					setData(text, text_value);
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div);
				}
			}
		};
	}

	// (381:1) {#if askMode}
	function create_if_block_3$2(component, ctx) {
		var div4, div0, text1, div1, label0, text3, input0, text4, div2, label1, text6, input1, text7, div3;

		function click_handler(event) {
			component.set({askMode: false});
		}

		function change_handler(event) {
			component.sendExcel(event);
		}

		function change_handler_1(event) {
			component.sendFile(event);
		}

		function click_handler_1(event) {
			component.addHand();
		}

		return {
			c: function c() {
				div4 = createElement("div");
				div0 = createElement("div");
				div0.textContent = "×";
				text1 = createText("\r\n\t\t");
				div1 = createElement("div");
				label0 = createElement("label");
				label0.textContent = "Из файла Excel";
				text3 = createText(" \r\n\t\t\t");
				input0 = createElement("input");
				text4 = createText("\r\n\t\t");
				div2 = createElement("div");
				label1 = createElement("label");
				label1.textContent = "Из векторного файла";
				text6 = createText(" \r\n\t\t\t");
				input1 = createElement("input");
				text7 = createText("\r\n\t\t");
				div3 = createElement("div");
				div3.textContent = "Вводом углов и дистанций";
				addListener(div0, "click", click_handler);
				div0.className = "closeButton svelte-bz26k5";
				label0.htmlFor = "profileImage";
				label0.className = "svelte-bz26k5";
				addListener(input0, "change", change_handler);
				setAttribute(input0, "type", "file");
				input0.id = "profileImage";
				setStyle(input0, "display", "none");
				input0.className = "svelte-bz26k5";
				div1.className = "main_pop_cont_1_top svelte-bz26k5";
				label1.htmlFor = "profileVector";
				label1.className = "svelte-bz26k5";
				addListener(input1, "change", change_handler_1);
				setAttribute(input1, "type", "file");
				input1.id = "profileVector";
				setStyle(input1, "display", "none");
				input1.className = "svelte-bz26k5";
				div2.className = "main_pop_cont_1_top svelte-bz26k5";
				addListener(div3, "click", click_handler_1);
				div3.className = "main_pop_cont_1_bottom svelte-bz26k5";
				div4.className = "main_pop_cont_1 svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, div4, anchor);
				append(div4, div0);
				append(div4, text1);
				append(div4, div1);
				append(div1, label0);
				append(div1, text3);
				append(div1, input0);
				append(div4, text4);
				append(div4, div2);
				append(div2, label1);
				append(div2, text6);
				append(div2, input1);
				append(div4, text7);
				append(div4, div3);
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div4);
				}

				removeListener(div0, "click", click_handler);
				removeListener(input0, "change", change_handler);
				removeListener(input1, "change", change_handler_1);
				removeListener(div3, "click", click_handler_1);
			}
		};
	}

	// (396:1) {#if layerID}
	function create_if_block$3(component, ctx) {
		var div1, div0, text_1, if_block_anchor, current;

		function click_handler(event) {
			component.createSnap();
		}

		var if_block = (ctx.layerItems) && create_if_block_1$2(component, ctx);

		return {
			c: function c() {
				div1 = createElement("div");
				div0 = createElement("div");
				div0.textContent = "Добавить делянку";
				text_1 = createText("\r\n\t");
				if (if_block) { if_block.c(); }
				if_block_anchor = createComment();
				addListener(div0, "click", click_handler);
				div0.className = "add_del svelte-bz26k5";
				div1.className = "main_row svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				insert(target, text_1, anchor);
				if (if_block) { if_block.m(target, anchor); }
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function p(changed, ctx) {
				if (ctx.layerItems) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_1$2(component, ctx);
						if (if_block) { if_block.c(); }
					}

					if_block.i(if_block_anchor.parentNode, if_block_anchor);
				} else if (if_block) {
					if_block.o(function() {
						if_block.d(1);
						if_block = null;
					});
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (if_block) { if_block.o(outrocallback); }
				else { outrocallback(); }

				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div1);
				}

				removeListener(div0, "click", click_handler);
				if (detach) {
					detachNode(text_1);
				}

				if (if_block) { if_block.d(detach); }
				if (detach) {
					detachNode(if_block_anchor);
				}
			}
		};
	}

	// (400:1) {#if layerItems}
	function create_if_block_1$2(component, ctx) {
		var div, table_updating = {}, text, if_block_anchor, current;

		var table_initial_data = {
		 	prnt: ctx.prnt,
		 	layerID: ctx.layerID,
		 	items: ctx.layerItems,
		 	hashCols: ctx.hashCols,
		 	editFlag: "true"
		 };
		if (ctx.item  !== void 0) {
			table_initial_data.item = ctx.item ;
			table_updating.item = true;
		}
		if (ctx.checked  !== void 0) {
			table_initial_data.checked = ctx.checked ;
			table_updating.checked = true;
		}
		var table = new Table({
			root: component.root,
			store: component.store,
			data: table_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!table_updating.item && changed.item) {
					newState.item = childState.item;
				}

				if (!table_updating.checked && changed.checked) {
					newState.checked = childState.checked;
				}
				component._set(newState);
				table_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			table._bind({ item: 1, checked: 1 }, table.get());
		});

		var if_block = (ctx.delAsk) && create_if_block_2$2(component, ctx);

		return {
			c: function c() {
				div = createElement("div");
				table._fragment.c();
				text = createText("\r\n\t");
				if (if_block) { if_block.c(); }
				if_block_anchor = createComment();
				div.className = "main_row svelte-bz26k5";
			},

			m: function m(target, anchor) {
				insert(target, div, anchor);
				table._mount(div, null);
				insert(target, text, anchor);
				if (if_block) { if_block.m(target, anchor); }
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				var table_changes = {};
				if (changed.prnt) { table_changes.prnt = ctx.prnt; }
				if (changed.layerID) { table_changes.layerID = ctx.layerID; }
				if (changed.layerItems) { table_changes.items = ctx.layerItems; }
				if (changed.hashCols) { table_changes.hashCols = ctx.hashCols; }
				if (!table_updating.item && changed.item) {
					table_changes.item = ctx.item ;
					table_updating.item = ctx.item  !== void 0;
				}
				if (!table_updating.checked && changed.checked) {
					table_changes.checked = ctx.checked ;
					table_updating.checked = ctx.checked  !== void 0;
				}
				table._set(table_changes);
				table_updating = {};

				if (ctx.delAsk) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_2$2(component, ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (table) { table._fragment.o(outrocallback); }
				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div);
				}

				table.destroy();
				if (detach) {
					detachNode(text);
				}

				if (if_block) { if_block.d(detach); }
				if (detach) {
					detachNode(if_block_anchor);
				}
			}
		};
	}

	// (404:1) {#if delAsk}
	function create_if_block_2$2(component, ctx) {
		var div4, div0, text1, div3, div1, text3, div2;

		function click_handler(event) {
			component.deleteItem(ctx.delID);
		}

		function click_handler_1(event) {
			component.set({delAsk: 0});
		}

		return {
			c: function c() {
				div4 = createElement("div");
				div0 = createElement("div");
				div0.textContent = "Вы уверены?";
				text1 = createText("\r\n\t\t\t");
				div3 = createElement("div");
				div1 = createElement("div");
				div1.textContent = "Да, удалить";
				text3 = createText("\r\n\t\t\t\t");
				div2 = createElement("div");
				div2.textContent = "Отмена";
				div0.className = "main_pop_cont_del_row1 svelte-bz26k5";
				addListener(div1, "click", click_handler);
				div1.className = "but_del svelte-bz26k5";
				addListener(div2, "click", click_handler_1);
				div2.className = "but_cancel svelte-bz26k5";
				div3.className = "main_pop_cont_del_row2 svelte-bz26k5";
				div4.className = "main_pop_cont_del svelte-bz26k5";
				div4.style.cssText = ctx.delAskStyle;
			},

			m: function m(target, anchor) {
				insert(target, div4, anchor);
				append(div4, div0);
				append(div4, text1);
				append(div4, div3);
				append(div3, div1);
				append(div3, text3);
				append(div3, div2);
				component.refs.delAsk = div4;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				if (changed.delAskStyle) {
					div4.style.cssText = ctx.delAskStyle;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div4);
				}

				removeListener(div1, "click", click_handler);
				removeListener(div2, "click", click_handler_1);
				if (component.refs.delAsk === div4) { component.refs.delAsk = null; }
			}
		};
	}

	function Sites(options) {
		var this$1 = this;

		init(this, options);
		this.refs = {};
		this._state = assign(data$4(), options.data);

		this._recompute({ item: 1, hashCols: 1 }, this._state);
		this._intro = !!options.intro;

		this._handlers.state = [onstate$2];

		onstate$2.call(this, { changed: assignTrue({}, this._state), current: this._state });

		this._fragment = create_main_fragment$4(this, this._state);

		this.root._oncreate.push(function () {
			this$1.fire("update", { changed: assignTrue({}, this$1._state), current: this$1._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Sites.prototype, proto);
	assign(Sites.prototype, methods$4);

	Sites.prototype._recompute = function _recompute(changed, state) {
		if (changed.item || changed.hashCols) {
			if (this._differs(state.snap, (state.snap = snap(state)))) { changed.snap = true; }
		}
	};

	/* src\SelectInput.html generated by Svelte v2.16.1 */

	function value(ref) {
		var key = ref.key;
		var changedParams = ref.changedParams;

		var it = changedParams ? changedParams[key] : {};
		return it && it.value || '';
	}

	function colName(ref) {
		var key = ref.key;
		var changedParams = ref.changedParams;

		var it = changedParams ? changedParams[key] : {};
		return it && it.field || '';
	}

	function isClicked(ref) {
		var key = ref.key;
		var changedParams = ref.changedParams;

		var it = changedParams ? changedParams[key] : {};
		return it && it.field || false;
	}

	function select(ref) {
	var key = ref.key;
	var params = ref.params;
	 var it = params[key]; return it.select; }

	function list(ref) {
	var key = ref.key;
	var params = ref.params;
	 var it = params[key]; return it.list; }

	function title(ref) {
	var key = ref.key;
	var params = ref.params;
	 var it = params[key]; return it.title || it.value; }

	function data$5() {
		return {
			key: '',
			prnt: null,
			cols: []
		};
	}
	var methods$5 = {
		setSelection: function setSelection(val) {
			var ref = this.get();
			var key = ref.key;
			var changedParams = ref.changedParams;
			var prnt = ref.prnt;
	 // console.log(`___ setSelection ______`, key, prnt, this.props.prnt);
			changedParams[key] = {value: '', field: val};
			// resetButton1();
			this.set({changedParams: changedParams, recheckFlag: 1});
		},
		setValue: function setValue(val, fieldFlag) {
			var ref = this.get();
			var key = ref.key;
			var changedParams = ref.changedParams;
			var meta = ref.meta;
			var params = ref.params;
			var prnt = ref.prnt;
	 // console.log(`___ setValue ______`, key, prnt);
			// let it = params[key],
				// meta[params[key].title]
	 
			changedParams[key] = {value: !fieldFlag ? val : '', field: fieldFlag ? val : ''};
			this.set({changedParams: changedParams, recheckFlag: 1});
			// resetButton1();
		}
	};

	function onstate$3(ref) {
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

	// console.log('select onstate', changed, current);
		if (changed.meta) {
		// if (changed.meta && !current.changedParams[current.key] && current.meta[current.key]) {
			var key = current.key,
				val = current.params[key].fieldName;
			if (val) {
				this.setSelection(val);
			}
		}
		if (changed.changedParams) ;

	}
	function get_each_context_2$1(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function get_each_context_1$1(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function get_each_context$5(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function create_main_fragment$5(component, ctx) {
		var div3, div0, text0, text1, div2, div1, current;

		function select_block_type(ctx) {
			if (ctx.isClicked) { return create_if_block$4; }
			if (ctx.select) { return create_if_block_1$3; }
			return create_else_block$1;
		}

		var current_block_type = select_block_type(ctx);
		var if_block = current_block_type(component, ctx);

		return {
			c: function c() {
				div3 = createElement("div");
				div0 = createElement("div");
				text0 = createText(ctx.title);
				text1 = createText("\r\n\t");
				div2 = createElement("div");
				div1 = createElement("div");
				if_block.c();
				div0.className = "gmx-sidebar-label svelte-oew3xe";
				div3.className = "gmx-sidebar-labeled-block svelte-oew3xe";
			},

			m: function m(target, anchor) {
				insert(target, div3, anchor);
				append(div3, div0);
				append(div0, text0);
				append(div3, text1);
				append(div3, div2);
				append(div2, div1);
				if_block.m(div1, null);
				current = true;
			},

			p: function p(changed, ctx) {
				if (changed.title) {
					setData(text0, ctx.title);
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block.d(1);
					if_block = current_block_type(component, ctx);
					if_block.c();
					if_block.m(div1, null);
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: run,

			d: function d(detach) {
				if (detach) {
					detachNode(div3);
				}

				if_block.d();
			}
		};
	}

	// (84:3) {:else}
	function create_else_block$1(component, ctx) {
		var input, input_list_value, text0, text1, button;

		function change_handler(event) {
			component.setValue(event.target.value);
		}

		var if_block = (ctx.list) && create_if_block_2$3(component, ctx);

		function click_handler(event) {
			component.setValue(ctx.cols[0], true);
		}

		return {
			c: function c() {
				input = createElement("input");
				text0 = createText("\r\n\t\t\t\t");
				if (if_block) { if_block.c(); }
				text1 = createText("\r\n\t\t\t\t");
				button = createElement("button");
				addListener(input, "change", change_handler);
				setAttribute(input, "type", "text");
				input.className = "gmx-sidebar-input-with-addon svelte-oew3xe";
				input.value = ctx.value;
				setAttribute(input, "list", input_list_value = ctx.list ? ctx.title : '');
				addListener(button, "click", click_handler);
				button.className = "gmx-addon-button svelte-oew3xe";
				button.title = "выбрать из таблицы атрибутов";
			},

			m: function m(target, anchor) {
				insert(target, input, anchor);
				component.refs.inp = input;
				insert(target, text0, anchor);
				if (if_block) { if_block.m(target, anchor); }
				insert(target, text1, anchor);
				insert(target, button, anchor);
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				if (changed.value) {
					input.value = ctx.value;
				}

				if ((changed.list || changed.title) && input_list_value !== (input_list_value = ctx.list ? ctx.title : '')) {
					setAttribute(input, "list", input_list_value);
				}

				if (ctx.list) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_2$3(component, ctx);
						if_block.c();
						if_block.m(text1.parentNode, text1);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(input);
				}

				removeListener(input, "change", change_handler);
				if (component.refs.inp === input) { component.refs.inp = null; }
				if (detach) {
					detachNode(text0);
				}

				if (if_block) { if_block.d(detach); }
				if (detach) {
					detachNode(text1);
					detachNode(button);
				}

				removeListener(button, "click", click_handler);
			}
		};
	}

	// (77:19) 
	function create_if_block_1$3(component, ctx) {
		var select_1, text, button;

		var each_value_1 = ctx.select;

		var each_blocks = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1$1(component, get_each_context_1$1(ctx, each_value_1, i));
		}

		function change_handler(event) {
			component.setValue(event.target.options[event.target.selectedIndex].value);
		}

		function click_handler(event) {
			component.setValue(ctx.cols[0], true);
		}

		return {
			c: function c() {
				select_1 = createElement("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text = createText("\r\n\t\t\t\t");
				button = createElement("button");
				addListener(select_1, "change", change_handler);
				select_1.className = "gmx-sidebar-select-with-addon svelte-oew3xe";
				addListener(button, "click", click_handler);
				button.className = "gmx-addon-button svelte-oew3xe";
				button.title = "выбрать из таблицы атрибутов";
			},

			m: function m(target, anchor) {
				insert(target, select_1, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select_1, null);
				}

				component.refs.sel1 = select_1;
				insert(target, text, anchor);
				insert(target, button, anchor);
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				if (changed.select || changed.value) {
					each_value_1 = ctx.select;

					for (var i = 0; i < each_value_1.length; i += 1) {
						var child_ctx = get_each_context_1$1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_1$1(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select_1, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_1.length;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(select_1);
				}

				destroyEach(each_blocks, detach);

				removeListener(select_1, "change", change_handler);
				if (component.refs.sel1 === select_1) { component.refs.sel1 = null; }
				if (detach) {
					detachNode(text);
					detachNode(button);
				}

				removeListener(button, "click", click_handler);
			}
		};
	}

	// (70:3) {#if isClicked}
	function create_if_block$4(component, ctx) {
		var select_1, text, button;

		var each_value = ctx.cols;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$5(component, get_each_context$5(ctx, each_value, i));
		}

		function change_handler(event) {
			component.setSelection(event.target.options[event.target.selectedIndex].value);
		}

		function click_handler(event) {
			component.setValue('');
		}

		return {
			c: function c() {
				select_1 = createElement("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text = createText("\r\n\t\t\t\t");
				button = createElement("button");
				addListener(select_1, "change", change_handler);
				select_1.className = "gmx-sidebar-select-with-addon svelte-oew3xe";
				addListener(button, "click", click_handler);
				button.className = "gmx-addon-button svelte-oew3xe";
				button.title = "выбрать из таблицы атрибутов";
			},

			m: function m(target, anchor) {
				insert(target, select_1, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select_1, null);
				}

				component.refs.sel = select_1;
				insert(target, text, anchor);
				insert(target, button, anchor);
			},

			p: function p(changed, ctx) {
				if (changed.cols || changed.colName) {
					each_value = ctx.cols;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context$5(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$5(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select_1, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(select_1);
				}

				destroyEach(each_blocks, detach);

				removeListener(select_1, "change", change_handler);
				if (component.refs.sel === select_1) { component.refs.sel = null; }
				if (detach) {
					detachNode(text);
					detachNode(button);
				}

				removeListener(button, "click", click_handler);
			}
		};
	}

	// (86:4) {#if list}
	function create_if_block_2$3(component, ctx) {
		var datalist;

		var each_value_2 = ctx.list;

		var each_blocks = [];

		for (var i = 0; i < each_value_2.length; i += 1) {
			each_blocks[i] = create_each_block_2$1(component, get_each_context_2$1(ctx, each_value_2, i));
		}

		return {
			c: function c() {
				datalist = createElement("datalist");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				datalist.id = ctx.title;
			},

			m: function m(target, anchor) {
				insert(target, datalist, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(datalist, null);
				}
			},

			p: function p(changed, ctx) {
				if (changed.list) {
					each_value_2 = ctx.list;

					for (var i = 0; i < each_value_2.length; i += 1) {
						var child_ctx = get_each_context_2$1(ctx, each_value_2, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_2$1(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(datalist, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_2.length;
				}

				if (changed.title) {
					datalist.id = ctx.title;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(datalist);
				}

				destroyEach(each_blocks, detach);
			}
		};
	}

	// (88:5) {#each list as it}
	function create_each_block_2$1(component, ctx) {
		var option, option_value_value;

		return {
			c: function c() {
				option = createElement("option");
				option.__value = option_value_value = ctx.it;
				option.value = option.__value;
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
			},

			p: function p(changed, ctx) {
				if ((changed.list) && option_value_value !== (option_value_value = ctx.it)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (79:5) {#each select as it}
	function create_each_block_1$1(component, ctx) {
		var option, text_value = ctx.it, text, option_value_value, option_selected_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.value === ctx.it;
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.select) && text_value !== (text_value = ctx.it)) {
					setData(text, text_value);
				}

				if ((changed.select) && option_value_value !== (option_value_value = ctx.it)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.value || changed.select) && option_selected_value !== (option_selected_value = ctx.value === ctx.it)) {
					option.selected = option_selected_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (72:5) {#each cols as it}
	function create_each_block$5(component, ctx) {
		var option, text_value = ctx.it, text, option_value_value, option_selected_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.colName === ctx.it;
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.cols) && text_value !== (text_value = ctx.it)) {
					setData(text, text_value);
				}

				if ((changed.cols) && option_value_value !== (option_value_value = ctx.it)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.colName || changed.cols) && option_selected_value !== (option_selected_value = ctx.colName === ctx.it)) {
					option.selected = option_selected_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	function SelectInput(options) {
		var this$1 = this;

		init(this, options);
		this.refs = {};
		this._state = assign(data$5(), options.data);

		this._recompute({ key: 1, changedParams: 1, params: 1 }, this._state);
		this._intro = !!options.intro;

		this._handlers.state = [onstate$3];

		onstate$3.call(this, { changed: assignTrue({}, this._state), current: this._state });

		this._fragment = create_main_fragment$5(this, this._state);

		this.root._oncreate.push(function () {
			this$1.fire("update", { changed: assignTrue({}, this$1._state), current: this$1._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(SelectInput.prototype, proto);
	assign(SelectInput.prototype, methods$5);

	SelectInput.prototype._recompute = function _recompute(changed, state) {
		if (changed.key || changed.changedParams) {
			if (this._differs(state.value, (state.value = value(state)))) { changed.value = true; }
			if (this._differs(state.colName, (state.colName = colName(state)))) { changed.colName = true; }
			if (this._differs(state.isClicked, (state.isClicked = isClicked(state)))) { changed.isClicked = true; }
		}

		if (changed.key || changed.params) {
			if (this._differs(state.select, (state.select = select(state)))) { changed.select = true; }
			if (this._differs(state.list, (state.list = list(state)))) { changed.list = true; }
			if (this._differs(state.title, (state.title = title(state)))) { changed.title = true; }
		}
	};

	/* src\Report.html generated by Svelte v2.16.1 */

	var stateStorage = getState();

	function metaTypeReport(ref) {
		var meta = ref.meta;

		return meta && meta['Тип отчета'] ? meta['Тип отчета'].Value : '';
	}

	function isTypeRecovery(ref) {
		var meta = ref.meta;

		return meta && meta['Тип отчета'] &&  meta['Тип отчета'].Value === 'о воспроизводстве лесов';
	}

	function data$6() {
		return {
			recheckFlag: 0,
			stateSave: 1,
			reverse: false,
			error: '',
			changedParams: {},
			params: {
				layerID: {value: '', title: 'Выбор слоя'},
				quadrantLayerId: {value: '', title: 'Слой квартальной сети'},
				reportType: {value: 'об использовании лесов', options: ['об использовании лесов', 'о воспроизводстве лесов'], title: 'Тип отчета'},
				organizationName: {value: '', title: 'Наименование организации'},
				inn: {value: '', title: 'ИНН'},
				region: {value: '', title: 'Субъект Российской Федерации'},
				forestry: {value: '', title: 'Лесничество'},
				//forestry: {value: '', title: 'Лесничество', fieldName: 'Лесничество'},
				sectionForestry: {value: '', title: 'Участковое лесничество'},
				quadrant: {value: '', title: 'Квартал'},
				dacha: {value: '', title: 'Дача/Урочище'},
				stratum: {value: '', title: 'Выдел'},
				fellingForm: {value: 'сплошная', title: 'Форма рубки', select: ['сплошная', 'выборочная']},
				fellingType: {value: '', title: 'Тип рубки'},
				recoveryEventType: {value: '', title: 'Тип лесовосстановительного мероприятия'},
				siteArea: {value: '', title: 'Площадь'},
				scale: {value: 10000, title: 'Масштаб'},
				site: {value: '', title: 'Делянка'}
			},

			scales: [
				{value: 5000, title: '1:5000'},
				{value: 10000, title: '1:10000'},
				{value: 15000, title: '1:15000'},
				{value: 20000, title: '1:20000'},
				{value: 25000, title: '1:25000'},
				{value: 30000, title: '1:30000'},
				{value: 35000, title: '1:35000'},
				{value: 40000, title: '1:40000'},
				{value: 45000, title: '1:45000'},
				{value: 50000, title: '1:50000'},
				{value: '', title: 'Авто'}
			],
	 
			showGrid: 1,
			pdf: 0,
			numPoints: 0,
			drawSnap: 0,
			layerItems: [],
			format: 2,
			templ: '',
			num_points: true,
			limit: 0,
			report: false,
			drawstart: false,
			layerID: '',
			quadrantLayerId: '',
			reportType: '',
			checked: {},
			layerIds: [], quadrantIds: [],
			meta: {},
			hashCols: {},
			cols: []
		}
	}
	var methods$6 = {
		viewItem: function viewItem(id) {
			var ref = this.get();
			var map = ref.map;
			var layerItems = ref.layerItems;
			var hashCols = ref.hashCols;

			for (var i = 0, len = layerItems.length; i < len; i++) {
				var it = layerItems[i];
				if (id === it[hashCols.gmx_id]) {
					var geo = it[hashCols.geomixergeojson],
						bbox = L.gmxUtil.getGeometryBounds(geo),
						latlngBbox = L.latLngBounds([[bbox.min.y, bbox.min.x], [bbox.max.y, bbox.max.x]]);
					map.fitBounds(latlngBbox);
					break;
				}
			}
		},
		sendReport: function sendReport$$1(pt) {
			var this$1 = this;

			var ref = this.get();
			var numPoints = ref.numPoints;
			var drawSnap = ref.drawSnap;
			var showGrid = ref.showGrid;
			var pdf = ref.pdf;
			var checked = ref.checked;
			var layerItems = ref.layerItems;
			var hashCols = ref.hashCols;
			var params = ref.params;
			var format = ref.format;
			var layerID = ref.layerID;
			var gmxMap = ref.gmxMap;
			var changedParams = ref.changedParams;
			var num_points = ref.num_points;
			var templ = ref.templ;

			var flag = pt.textContent === 'Создать отчеты';

			var promise = sendReport(flag, numPoints, drawSnap, showGrid, pdf, checked, layerItems, hashCols, params, format, layerID, gmxMap, changedParams, num_points, templ, this);
			if (promise) {
				this.set({report: true, error: ''});
				promise.then(function (json) {
					if (json) { this$1.set(json); }
				})
				.catch(function (err) { return console.warn(err); });
			} else {
				this.set({error: 'Не все обязательные параметры заполнены!'});
				//pt.textContent = 'Продолжить';
				this.resetButton1(true);
			}
		},
		startDrawing: function startDrawing(ev) {
			var this$1 = this;

			var ref = this.get();
			var map = ref.map;
			var drawstart = ref.drawstart;
			var layerID = ref.layerID;
			var checked = ref.checked;
			this.set({drawstart: !drawstart});
			if(!drawstart) {
				map.gmxDrawing.clear();
				map.gmxDrawing.create('Polygon');
				map.gmxDrawing.on('drawstop', function (e) {
					this$1.set({drawstart: false});
					selectFeaturesWithDrawing(layerID, e.object.toGeoJSON().geometry)
						.then(function (json) {
							this$1.set({checked: L.extend(json, checked)});
						});
				}, this);
				map._gmxEventsManager._drawstart = true;
			}

		},
		getKeyState: function getKeyState(key) {
			var ref = this.get();
			var changedParams = ref.changedParams;
			return changedParams[key];
		},
		setField: function setField(key, data) {
			var ref = this.get();
			var changedParams = ref.changedParams;
			changedParams[key] = data;
			this.set({changedParams: changedParams});
		},
		setNodeField: function setNodeField(node, setFlag) {
			var ref = this.get();
			var map = ref.map;
			var val = node.options ? node.options[node.selectedIndex].value : node.value,
				name = node.name;
			this.setField(name, val);
			if (setFlag) {
				var attr = {checked: {}, reverse: false};
				attr[name] = val;
				if (name === 'layerID') {
					this.clearChangedNodes();
					chkLayer(val);
					// let layer = nsGmx.gmxMap.layersByID[val],
						// latLngBounds = L.gmxUtil.getGeometryBounds(layer._gmx.geometry).toLatLngBounds(true);
					// map.fitBounds(latLngBounds);
					// if (!layer._map) {
						// map.addLayer(layer);
					// }
				}
				this.set(attr);
			}
		},
		colsToHash: function colsToHash(arr) {
			return arr.reduce(function (a, v, i) { a[v] = i; return a; }, {});
		},

		styleHook: function styleHook(it) {
			var ref = this.get();
			var checked = ref.checked;
			return checked && checked[it.id] ? { strokeStyle: '#00ffff' } : {};
		},
		loadState: function loadState() {
			var ref = this.get();
			var hashCols = ref.hashCols;
			var changedParams = {};
			for(var key in stateStorage) {
				var it = stateStorage[key],
					pk = it.field;

				if (pk && !hashCols[pk]) {
					continue;
				}
				changedParams[key] = it;
			}
			this.set({changedParams: changedParams});
			this.checkState();
		},
		clearChangedNodes: function clearChangedNodes() {
			var ref = this.get();
			var changedParams = ref.changedParams;
			for(var key in changedParams) {
				var node = this.refs[key];

				if (node) {
						node.value = '';
				}
			}
			this.set({reportType: '', changedParams:{}});
		},
		checkState: function checkState() {
			var ref = this.get();
			var changedParams = ref.changedParams;
			var target = this.options.target;
			for(var key in changedParams) {
				var it = changedParams[key],
					node = this.refs[key];

				if (node) {
					if (typeof(it) !== 'object') {
						node.value = it;
					}
				}
				if (key === 'reportType') {
					this.set({reportType: it});
				}
			}
		},
		loadFeatures: function loadFeatures$$1() {
			var this$1 = this;

			var ref = this.get();
			var gmxMap = ref.gmxMap;
			var layerID = ref.layerID;
			var stateSave = ref.stateSave;
			this.currentLayer = gmxMap.layersByID[layerID];
			var meta = null;

			if (this.currentLayer) {
				this.currentLayer.setStyleHook(this.styleHook.bind(this));
				meta = this.currentLayer.getGmxProperties().MetaProperties;
			}
			loadFeatures(layerID)
			.then(function (json) {
				if (json.Status === 'ok') {
					var cols = json.Result.fields,
						attr = {cols: cols, hashCols: this$1.colsToHash(cols), meta: meta, layerItems: json.Result.values};
					if (Object.keys(stateStorage).length) {
						attr.stateSave = 1;
					}
					if (meta && meta['Тип отчета']) {
						attr.reportType = meta['Тип отчета'].Value;
					}

					this$1.refs.scale.selectedIndex = 1;
					if (attr.stateSave) {
						this$1.refs.loadState.classList.remove('disabled');
					}
					this$1.set(attr);
				}
			});
		},
		resetButton1: function resetButton1(flag) {
			if (this.refs.submitButton) {
				this.refs.submitButton.textContent = flag ? 'Продолжить' : 'Создать отчеты';
				var attr = {recheckFlag: 0};
				if (!flag) { attr.error = 0; }
				this.set(attr);
				//this.needRefreshButton = null;
			}
		}
	};

	function onstate$4(ref) {
		var this$1 = this;
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

	// console.log('Report onstate', changed, current);
		if (changed.gmxMap) {
			var ph = getLayersIds(current.gmxMap);
			getReportsCount().then(function (json) {
				if (json && json.registered) {
					var count = json.limit - json.used;
					ph.limit = count > 0 ? count : 0;
				}
				this$1.set(ph);
			});

			// this.set(Requests.getLayersIds(current.gmxMap));
		}
		if (changed.layerID && current.layerID) {
			this.loadFeatures();
		}
		if (changed.checked && this.currentLayer) {
			this.currentLayer.repaint();
		}
		if (changed.recheckFlag && current.recheckFlag) {
			this.resetButton1();
	console.log('recheckFlag', current.recheckFlag);
		}
		
		// if (changed.changedParams) {
	// console.log('ggggg', changed)
			// if (this.refs.submitButton && this.refs.submitButton.textContent !== 'Создать отчеты') {
				// this.refs.submitButton.textContent === 'Создать отчеты';
			// }
		// }
		
	}
	function get_each_context_3$1(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function get_each_context_2$2(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function get_each_context_1$2(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function get_each_context$6(ctx, list, i) {
		var child_ctx = Object.create(ctx);
		child_ctx.it = list[i];
		return child_ctx;
	}

	function create_main_fragment$6(component, ctx) {
		var div2, div0, text0, text1, text2, div1, span, text4, select, option, text5, current;

		var if_block0 = (ctx.layerIds) && create_if_block_8(component, ctx);

		function change_handler(event) {
			component.setNodeField(this, true);
		}

		var if_block1 = (ctx.layerID) && create_if_block$5(component, ctx);

		return {
			c: function c() {
				div2 = createElement("div");
				div0 = createElement("div");
				text0 = createText("Лимит отчетов: ");
				text1 = createText(ctx.limit);
				text2 = createText("\r\n\t");
				div1 = createElement("div");
				span = createElement("span");
				span.textContent = "Выбор слоя";
				text4 = createText("\r\n\t\t");
				select = createElement("select");
				option = createElement("option");
				if (if_block0) { if_block0.c(); }
				text5 = createText("\r\n");
				if (if_block1) { if_block1.c(); }
				div0.className = "forest-plugin-header svelte-c1dd6u";
				span.className = "gmx-select-layer-container__label svelte-c1dd6u";
				option.__value = "";
				option.value = option.__value;
				option.className = "svelte-c1dd6u";
				addListener(select, "change", change_handler);
				select.name = "layerID";
				select.className = "gmx-sidebar-select-medium svelte-c1dd6u";
				div1.className = "gmx-select-layer-container svelte-c1dd6u";
				div2.className = "forest-plugin-container svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div0, text0);
				append(div0, text1);
				append(div2, text2);
				append(div2, div1);
				append(div1, span);
				append(div1, text4);
				append(div1, select);
				append(select, option);
				if (if_block0) { if_block0.m(select, null); }
				append(div2, text5);
				if (if_block1) { if_block1.m(div2, null); }
				current = true;
			},

			p: function p(changed, ctx) {
				if (!current || changed.limit) {
					setData(text1, ctx.limit);
				}

				if (ctx.layerIds) {
					if (if_block0) {
						if_block0.p(changed, ctx);
					} else {
						if_block0 = create_if_block_8(component, ctx);
						if_block0.c();
						if_block0.m(select, null);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (ctx.layerID) {
					if (if_block1) {
						if_block1.p(changed, ctx);
					} else {
						if_block1 = create_if_block$5(component, ctx);
						if (if_block1) { if_block1.c(); }
					}

					if_block1.i(div2, null);
				} else if (if_block1) {
					if_block1.o(function() {
						if_block1.d(1);
						if_block1 = null;
					});
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (if_block1) { if_block1.o(outrocallback); }
				else { outrocallback(); }

				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div2);
				}

				if (if_block0) { if_block0.d(); }
				removeListener(select, "change", change_handler);
				if (if_block1) { if_block1.d(); }
			}
		};
	}

	// (294:3) {#if layerIds}
	function create_if_block_8(component, ctx) {
		var each_anchor;

		var each_value = ctx.layerIds;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block_3$1(component, get_each_context$6(ctx, each_value, i));
		}

		return {
			c: function c() {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_anchor = createComment();
			},

			m: function m(target, anchor) {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if (changed.layerIds || changed.layerID) {
					each_value = ctx.layerIds;

					for (var i = 0; i < each_value.length; i += 1) {
						var child_ctx = get_each_context$6(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_3$1(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_anchor.parentNode, each_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value.length;
				}
			},

			d: function d(detach) {
				destroyEach(each_blocks, detach);

				if (detach) {
					detachNode(each_anchor);
				}
			}
		};
	}

	// (295:4) {#each layerIds as it}
	function create_each_block_3$1(component, ctx) {
		var option, text_value = ctx.it.title, text, option_value_value, option_selected_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it.id;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.layerID === ctx.it.id;
				option.className = "svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.layerIds) && text_value !== (text_value = ctx.it.title)) {
					setData(text, text_value);
				}

				if ((changed.layerIds) && option_value_value !== (option_value_value = ctx.it.id)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.layerID || changed.layerIds) && option_selected_value !== (option_selected_value = ctx.layerID === ctx.it.id)) {
					option.selected = option_selected_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (301:0) {#if layerID}
	function create_if_block$5(component, ctx) {
		var div16, div0, text0, text1, div8, div7, div2, div1, text2_value = ctx.params.reportType.title, text2, text3, select0, text4, text5, selectinput0_updating = {}, text6, selectinput1_updating = {}, text7, selectinput2_updating = {}, text8, selectinput3_updating = {}, text9, selectinput4_updating = {}, text10, selectinput5_updating = {}, text11, selectinput6_updating = {}, text12, selectinput7_updating = {}, text13, selectinput8_updating = {}, text14, text15, selectinput9_updating = {}, text16, div4, div3, text17_value = ctx.params.scale.title || ctx.params.scale.value, text17, text18, select1, text19, div6, div5, text20_value = ctx.params.quadrantLayerId.title || ctx.params.quadrantLayerId.value, text20, text21, select2, option, text22, div9, span0, input0, text23, label0, text25, span1, input1, text26, label1, text28, span2, input2, text29, label2, text31, div10, text33, div14, div13, div11, button, text34_value = ctx.drawstart ? 'Полигон рисуется' :'Выделите участки полигоном', text34, text35, div12, text36, text37_value = ctx.Object.keys(ctx.checked).length, text37, text38, text39_value = ctx.layerItems.length, text39, text40, table_updating = {}, text41, text42, div15, current;

		var if_block0 = (ctx.stateSave) && create_if_block_7(component, ctx);

		function select_block_type(ctx) {
			if (ctx.metaTypeReport) { return create_if_block_6; }
			return create_else_block_1$1;
		}

		var current_block_type = select_block_type(ctx);
		var if_block1 = current_block_type(component, ctx);

		function change_handler(event) {
			component.setNodeField(this, true);
		}

		var if_block2 = (ctx.reportType !== 'о воспроизводстве лесов') && create_if_block_5$2(component, ctx);

		var selectinput0_initial_data = { key: "organizationName" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput0_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput0_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput0_initial_data.params = ctx.params  ;
			selectinput0_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput0_initial_data.cols = ctx.cols ;
			selectinput0_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput0_initial_data.changedParams = ctx.changedParams ;
			selectinput0_updating.changedParams = true;
		}
		var selectinput0 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput0_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput0_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput0_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput0_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput0_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput0_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput0._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput0.get());
		});

		var selectinput1_initial_data = { key: "inn" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput1_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput1_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput1_initial_data.params = ctx.params  ;
			selectinput1_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput1_initial_data.cols = ctx.cols ;
			selectinput1_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput1_initial_data.changedParams = ctx.changedParams ;
			selectinput1_updating.changedParams = true;
		}
		var selectinput1 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput1_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput1_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput1_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput1_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput1_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput1_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput1._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput1.get());
		});

		var selectinput2_initial_data = { key: "region" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput2_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput2_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput2_initial_data.params = ctx.params  ;
			selectinput2_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput2_initial_data.cols = ctx.cols ;
			selectinput2_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput2_initial_data.changedParams = ctx.changedParams ;
			selectinput2_updating.changedParams = true;
		}
		var selectinput2 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput2_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput2_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput2_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput2_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput2_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput2_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput2._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput2.get());
		});

		var selectinput3_initial_data = { key: "forestry", meta: ctx.meta };
		if (ctx.recheckFlag  !== void 0) {
			selectinput3_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput3_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput3_initial_data.params = ctx.params  ;
			selectinput3_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput3_initial_data.cols = ctx.cols ;
			selectinput3_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput3_initial_data.changedParams = ctx.changedParams ;
			selectinput3_updating.changedParams = true;
		}
		var selectinput3 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput3_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput3_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput3_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput3_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput3_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput3_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput3._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput3.get());
		});

		var selectinput4_initial_data = { key: "sectionForestry" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput4_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput4_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput4_initial_data.params = ctx.params  ;
			selectinput4_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput4_initial_data.cols = ctx.cols ;
			selectinput4_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput4_initial_data.changedParams = ctx.changedParams ;
			selectinput4_updating.changedParams = true;
		}
		var selectinput4 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput4_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput4_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput4_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput4_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput4_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput4_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput4._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput4.get());
		});

		var selectinput5_initial_data = { key: "dacha" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput5_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput5_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput5_initial_data.params = ctx.params  ;
			selectinput5_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput5_initial_data.cols = ctx.cols ;
			selectinput5_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput5_initial_data.changedParams = ctx.changedParams ;
			selectinput5_updating.changedParams = true;
		}
		var selectinput5 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput5_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput5_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput5_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput5_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput5_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput5_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput5._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput5.get());
		});

		var selectinput6_initial_data = { key: "quadrant" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput6_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput6_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput6_initial_data.params = ctx.params  ;
			selectinput6_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput6_initial_data.cols = ctx.cols ;
			selectinput6_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput6_initial_data.changedParams = ctx.changedParams ;
			selectinput6_updating.changedParams = true;
		}
		var selectinput6 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput6_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput6_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput6_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput6_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput6_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput6_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput6._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput6.get());
		});

		var selectinput7_initial_data = { key: "stratum" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput7_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput7_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput7_initial_data.params = ctx.params  ;
			selectinput7_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput7_initial_data.cols = ctx.cols ;
			selectinput7_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput7_initial_data.changedParams = ctx.changedParams ;
			selectinput7_updating.changedParams = true;
		}
		var selectinput7 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput7_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput7_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput7_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput7_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput7_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput7_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput7._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput7.get());
		});

		var selectinput8_initial_data = { key: "site" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput8_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput8_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput8_initial_data.params = ctx.params  ;
			selectinput8_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput8_initial_data.cols = ctx.cols ;
			selectinput8_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput8_initial_data.changedParams = ctx.changedParams ;
			selectinput8_updating.changedParams = true;
		}
		var selectinput8 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput8_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput8_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput8_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput8_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput8_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput8_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput8._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput8.get());
		});

		var if_block3 = (ctx.reportType === 'о воспроизводстве лесов') && create_if_block_4$2(component, ctx);

		var selectinput9_initial_data = { key: "siteArea" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput9_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput9_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput9_initial_data.params = ctx.params  ;
			selectinput9_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput9_initial_data.cols = ctx.cols ;
			selectinput9_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput9_initial_data.changedParams = ctx.changedParams ;
			selectinput9_updating.changedParams = true;
		}
		var selectinput9 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput9_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput9_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput9_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput9_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput9_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput9_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput9._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput9.get());
		});

		var each_value_2 = ctx.scales;

		var each_blocks = [];

		for (var i = 0; i < each_value_2.length; i += 1) {
			each_blocks[i] = create_each_block_1$2(component, get_each_context_2$2(ctx, each_value_2, i));
		}

		function change_handler_1(event) {
			component.setNodeField(this, true);
		}

		var if_block4 = (ctx.quadrantIds) && create_if_block_3$3(component, ctx);

		function change_handler_2(event) {
			component.setNodeField(this, true);
		}

		function mousedown_handler(event) {
			component.set({recheckFlag: 1});
		}

		function change_handler_3(event) {
			component.set({pdf: this.checked ? 1 : 0});
		}

		function change_handler_4(event) {
			component.set({numPoints: this.checked ? 1 : 0});
		}

		function change_handler_5(event) {
			component.set({drawSnap: this.checked ? 1 : 0});
		}

		function click_handler(event) {
			component.startDrawing(event);
		}

		var table_initial_data = {
		 	items: ctx.layerItems,
		 	hashCols: ctx.hashCols,
		 	reverse: ctx.reverse
		 };
		if (ctx.checked  !== void 0) {
			table_initial_data.checked = ctx.checked ;
			table_updating.checked = true;
		}
		var table = new Table({
			root: component.root,
			store: component.store,
			data: table_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!table_updating.checked && changed.checked) {
					newState.checked = childState.checked;
				}
				component._set(newState);
				table_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			table._bind({ checked: 1 }, table.get());
		});

		var if_block5 = (ctx.error) && create_if_block_2$4(component, ctx);

		function select_block_type_1(ctx) {
			if (ctx.report) { return create_if_block_1$4; }
			return create_else_block$2;
		}

		var current_block_type_1 = select_block_type_1(ctx);
		var if_block6 = current_block_type_1(component, ctx);

		return {
			c: function c() {
				div16 = createElement("div");
				div0 = createElement("div");
				text0 = createText("Ввод информации\r\n\t\t\t\t");
				if (if_block0) { if_block0.c(); }
				text1 = createText("\r\n\t\t\t");
				div8 = createElement("div");
				div7 = createElement("div");
				div2 = createElement("div");
				div1 = createElement("div");
				text2 = createText(text2_value);
				text3 = createText("\r\n\t\t\t\t\t\t");
				select0 = createElement("select");
				if_block1.c();
				text4 = createText("\r\n");
				if (if_block2) { if_block2.c(); }
				text5 = createText("\r\n\t\t\t\t\t");
				selectinput0._fragment.c();
				text6 = createText("\r\n\t\t\t\t\t");
				selectinput1._fragment.c();
				text7 = createText("\r\n\t\t\t\t\t");
				selectinput2._fragment.c();
				text8 = createText("\r\n\t\t\t\t\t");
				selectinput3._fragment.c();
				text9 = createText("\r\n\t\t\t\t\t");
				selectinput4._fragment.c();
				text10 = createText("\r\n\t\t\t\t\t");
				selectinput5._fragment.c();
				text11 = createText("\r\n\t\t\t\t\t");
				selectinput6._fragment.c();
				text12 = createText("\r\n\t\t\t\t\t");
				selectinput7._fragment.c();
				text13 = createText("\r\n\t\t\t\t\t");
				selectinput8._fragment.c();
				text14 = createText("\r\n");
				if (if_block3) { if_block3.c(); }
				text15 = createText("\r\n\t\t\t\t\t");
				selectinput9._fragment.c();
				text16 = createText("\r\n\r\n\t\t\t\t\t");
				div4 = createElement("div");
				div3 = createElement("div");
				text17 = createText(text17_value);
				text18 = createText("\r\n\t\t\t\t\t\t");
				select1 = createElement("select");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				text19 = createText("\r\n\t\t\t\t\t");
				div6 = createElement("div");
				div5 = createElement("div");
				text20 = createText(text20_value);
				text21 = createText("\r\n\t\t\t\t\t\t");
				select2 = createElement("select");
				option = createElement("option");
				if (if_block4) { if_block4.c(); }
				text22 = createText("\r\n\r\n\t\t\t");
				div9 = createElement("div");
				span0 = createElement("span");
				input0 = createElement("input");
				text23 = createText("\r\n\t\t\t\t\t");
				label0 = createElement("label");
				label0.textContent = "+PDF";
				text25 = createText("\r\n\t\t\t\t");
				span1 = createElement("span");
				input1 = createElement("input");
				text26 = createText("\r\n\t\t\t\t\t");
				label1 = createElement("label");
				label1.textContent = "+координаты точек";
				text28 = createText("\r\n\t\t\t\t");
				span2 = createElement("span");
				input2 = createElement("input");
				text29 = createText("\r\n\t\t\t\t\t");
				label2 = createElement("label");
				label2.textContent = "+привязочный ход";
				text31 = createText("\r\n\r\n\t\t\t");
				div10 = createElement("div");
				div10.textContent = "Список объектов";
				text33 = createText("\r\n\t\t\t");
				div14 = createElement("div");
				div13 = createElement("div");
				div11 = createElement("div");
				button = createElement("button");
				text34 = createText(text34_value);
				text35 = createText("\r\n\t\t\t\t\t");
				div12 = createElement("div");
				text36 = createText("Выделено: ");
				text37 = createText(text37_value);
				text38 = createText(" / ");
				text39 = createText(text39_value);
				text40 = createText("\r\n\t\t\t\t\t");
				table._fragment.c();
				text41 = createText("\r\n\r\n\t\t\t");
				if (if_block5) { if_block5.c(); }
				text42 = createText("\r\n\t\t\t");
				div15 = createElement("div");
				if_block6.c();
				div0.className = "gmx-sidebar-label-medium svelte-c1dd6u";
				div1.className = "gmx-sidebar-label svelte-c1dd6u";
				addListener(select0, "change", change_handler);
				select0.name = "reportType";
				select0.className = "reportType gmx-sidebar-select-large svelte-c1dd6u";
				div2.className = "gmx-sidebar-labeled-block svelte-c1dd6u";
				div3.className = "gmx-sidebar-label svelte-c1dd6u";
				addListener(select1, "change", change_handler_1);
				select1.name = "scale";
				select1.className = "scale gmx-sidebar-select-large svelte-c1dd6u";
				div4.className = "gmx-sidebar-labeled-block svelte-c1dd6u";
				div5.className = "gmx-sidebar-label svelte-c1dd6u";
				option.__value = "";
				option.value = option.__value;
				option.className = "svelte-c1dd6u";
				addListener(select2, "change", change_handler_2);
				select2.name = "quadrantLayerId";
				select2.className = "quadrantLayerId gmx-sidebar-select-large svelte-c1dd6u";
				div6.className = "gmx-sidebar-labeled-block svelte-c1dd6u";
				addListener(div7, "mousedown", mousedown_handler);
				addListener(input0, "change", change_handler_3);
				setAttribute(input0, "type", "checkbox");
				input0.className = "custom-control-input";
				input0.name = "pdf";
				label0.className = "custom-control-label";
				label0.htmlFor = "pdf";
				span0.className = "left svelte-c1dd6u";
				addListener(input1, "change", change_handler_4);
				setAttribute(input1, "type", "checkbox");
				input1.className = "custom-control-input";
				input1.name = "numPoints";
				label1.className = "custom-control-label";
				label1.htmlFor = "numPoints";
				span1.className = "center svelte-c1dd6u";
				addListener(input2, "change", change_handler_5);
				setAttribute(input2, "type", "checkbox");
				input2.className = "custom-control-input";
				input2.name = "drawSnap";
				label2.className = "custom-control-label";
				label2.htmlFor = "drawSnap";
				span2.className = "right svelte-c1dd6u";
				div9.className = "labeled-block svelte-c1dd6u";
				div10.className = "gmx-sidebar-label-medium svelte-c1dd6u";
				addListener(button, "click", click_handler);
				button.className = "gmx-sidebar-button svelte-c1dd6u";
				div11.className = "gmx-geometry-select-container svelte-c1dd6u";
				div12.className = "gmx-sidebar-label-medium svelte-c1dd6u";
				div14.className = "forest-features-block svelte-c1dd6u";
				div15.className = "gmx-button-container svelte-c1dd6u";
				div16.className = "leftContent forest-plugin-content svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, div16, anchor);
				append(div16, div0);
				append(div0, text0);
				if (if_block0) { if_block0.m(div0, null); }
				append(div16, text1);
				append(div16, div8);
				append(div8, div7);
				append(div7, div2);
				append(div2, div1);
				append(div1, text2);
				append(div2, text3);
				append(div2, select0);
				if_block1.m(select0, null);
				component.refs.reportType = select0;
				append(div7, text4);
				if (if_block2) { if_block2.m(div7, null); }
				append(div7, text5);
				selectinput0._mount(div7, null);
				append(div7, text6);
				selectinput1._mount(div7, null);
				append(div7, text7);
				selectinput2._mount(div7, null);
				append(div7, text8);
				selectinput3._mount(div7, null);
				append(div7, text9);
				selectinput4._mount(div7, null);
				append(div7, text10);
				selectinput5._mount(div7, null);
				append(div7, text11);
				selectinput6._mount(div7, null);
				append(div7, text12);
				selectinput7._mount(div7, null);
				append(div7, text13);
				selectinput8._mount(div7, null);
				append(div7, text14);
				if (if_block3) { if_block3.m(div7, null); }
				append(div7, text15);
				selectinput9._mount(div7, null);
				append(div7, text16);
				append(div7, div4);
				append(div4, div3);
				append(div3, text17);
				append(div4, text18);
				append(div4, select1);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(select1, null);
				}

				component.refs.scale = select1;
				append(div7, text19);
				append(div7, div6);
				append(div6, div5);
				append(div5, text20);
				append(div6, text21);
				append(div6, select2);
				append(select2, option);
				if (if_block4) { if_block4.m(select2, null); }
				component.refs.quadrantLayerId = select2;
				append(div16, text22);
				append(div16, div9);
				append(div9, span0);
				append(span0, input0);
				append(span0, text23);
				append(span0, label0);
				append(div9, text25);
				append(div9, span1);
				append(span1, input1);
				append(span1, text26);
				append(span1, label1);
				append(div9, text28);
				append(div9, span2);
				append(span2, input2);
				append(span2, text29);
				append(span2, label2);
				append(div16, text31);
				append(div16, div10);
				append(div16, text33);
				append(div16, div14);
				append(div14, div13);
				append(div13, div11);
				append(div11, button);
				append(button, text34);
				append(div13, text35);
				append(div13, div12);
				append(div12, text36);
				append(div12, text37);
				append(div12, text38);
				append(div12, text39);
				append(div13, text40);
				table._mount(div13, null);
				append(div16, text41);
				if (if_block5) { if_block5.m(div16, null); }
				append(div16, text42);
				append(div16, div15);
				if_block6.m(div15, null);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				if (ctx.stateSave) {
					if (!if_block0) {
						if_block0 = create_if_block_7(component, ctx);
						if_block0.c();
						if_block0.m(div0, null);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if ((!current || changed.params) && text2_value !== (text2_value = ctx.params.reportType.title)) {
					setData(text2, text2_value);
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
					if_block1.p(changed, ctx);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type(component, ctx);
					if_block1.c();
					if_block1.m(select0, null);
				}

				if (ctx.reportType !== 'о воспроизводстве лесов') {
					if (if_block2) {
						if_block2.p(changed, ctx);
					} else {
						if_block2 = create_if_block_5$2(component, ctx);
						if (if_block2) { if_block2.c(); }
					}

					if_block2.i(div7, text5);
				} else if (if_block2) {
					if_block2.o(function() {
						if_block2.d(1);
						if_block2 = null;
					});
				}

				var selectinput0_changes = {};
				if (!selectinput0_updating.recheckFlag && changed.recheckFlag) {
					selectinput0_changes.recheckFlag = ctx.recheckFlag ;
					selectinput0_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput0_updating.params && changed.params) {
					selectinput0_changes.params = ctx.params  ;
					selectinput0_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput0_updating.cols && changed.cols) {
					selectinput0_changes.cols = ctx.cols ;
					selectinput0_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput0_updating.changedParams && changed.changedParams) {
					selectinput0_changes.changedParams = ctx.changedParams ;
					selectinput0_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput0._set(selectinput0_changes);
				selectinput0_updating = {};

				var selectinput1_changes = {};
				if (!selectinput1_updating.recheckFlag && changed.recheckFlag) {
					selectinput1_changes.recheckFlag = ctx.recheckFlag ;
					selectinput1_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput1_updating.params && changed.params) {
					selectinput1_changes.params = ctx.params  ;
					selectinput1_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput1_updating.cols && changed.cols) {
					selectinput1_changes.cols = ctx.cols ;
					selectinput1_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput1_updating.changedParams && changed.changedParams) {
					selectinput1_changes.changedParams = ctx.changedParams ;
					selectinput1_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput1._set(selectinput1_changes);
				selectinput1_updating = {};

				var selectinput2_changes = {};
				if (!selectinput2_updating.recheckFlag && changed.recheckFlag) {
					selectinput2_changes.recheckFlag = ctx.recheckFlag ;
					selectinput2_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput2_updating.params && changed.params) {
					selectinput2_changes.params = ctx.params  ;
					selectinput2_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput2_updating.cols && changed.cols) {
					selectinput2_changes.cols = ctx.cols ;
					selectinput2_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput2_updating.changedParams && changed.changedParams) {
					selectinput2_changes.changedParams = ctx.changedParams ;
					selectinput2_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput2._set(selectinput2_changes);
				selectinput2_updating = {};

				var selectinput3_changes = {};
				if (changed.meta) { selectinput3_changes.meta = ctx.meta; }
				if (!selectinput3_updating.recheckFlag && changed.recheckFlag) {
					selectinput3_changes.recheckFlag = ctx.recheckFlag ;
					selectinput3_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput3_updating.params && changed.params) {
					selectinput3_changes.params = ctx.params  ;
					selectinput3_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput3_updating.cols && changed.cols) {
					selectinput3_changes.cols = ctx.cols ;
					selectinput3_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput3_updating.changedParams && changed.changedParams) {
					selectinput3_changes.changedParams = ctx.changedParams ;
					selectinput3_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput3._set(selectinput3_changes);
				selectinput3_updating = {};

				var selectinput4_changes = {};
				if (!selectinput4_updating.recheckFlag && changed.recheckFlag) {
					selectinput4_changes.recheckFlag = ctx.recheckFlag ;
					selectinput4_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput4_updating.params && changed.params) {
					selectinput4_changes.params = ctx.params  ;
					selectinput4_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput4_updating.cols && changed.cols) {
					selectinput4_changes.cols = ctx.cols ;
					selectinput4_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput4_updating.changedParams && changed.changedParams) {
					selectinput4_changes.changedParams = ctx.changedParams ;
					selectinput4_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput4._set(selectinput4_changes);
				selectinput4_updating = {};

				var selectinput5_changes = {};
				if (!selectinput5_updating.recheckFlag && changed.recheckFlag) {
					selectinput5_changes.recheckFlag = ctx.recheckFlag ;
					selectinput5_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput5_updating.params && changed.params) {
					selectinput5_changes.params = ctx.params  ;
					selectinput5_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput5_updating.cols && changed.cols) {
					selectinput5_changes.cols = ctx.cols ;
					selectinput5_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput5_updating.changedParams && changed.changedParams) {
					selectinput5_changes.changedParams = ctx.changedParams ;
					selectinput5_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput5._set(selectinput5_changes);
				selectinput5_updating = {};

				var selectinput6_changes = {};
				if (!selectinput6_updating.recheckFlag && changed.recheckFlag) {
					selectinput6_changes.recheckFlag = ctx.recheckFlag ;
					selectinput6_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput6_updating.params && changed.params) {
					selectinput6_changes.params = ctx.params  ;
					selectinput6_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput6_updating.cols && changed.cols) {
					selectinput6_changes.cols = ctx.cols ;
					selectinput6_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput6_updating.changedParams && changed.changedParams) {
					selectinput6_changes.changedParams = ctx.changedParams ;
					selectinput6_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput6._set(selectinput6_changes);
				selectinput6_updating = {};

				var selectinput7_changes = {};
				if (!selectinput7_updating.recheckFlag && changed.recheckFlag) {
					selectinput7_changes.recheckFlag = ctx.recheckFlag ;
					selectinput7_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput7_updating.params && changed.params) {
					selectinput7_changes.params = ctx.params  ;
					selectinput7_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput7_updating.cols && changed.cols) {
					selectinput7_changes.cols = ctx.cols ;
					selectinput7_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput7_updating.changedParams && changed.changedParams) {
					selectinput7_changes.changedParams = ctx.changedParams ;
					selectinput7_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput7._set(selectinput7_changes);
				selectinput7_updating = {};

				var selectinput8_changes = {};
				if (!selectinput8_updating.recheckFlag && changed.recheckFlag) {
					selectinput8_changes.recheckFlag = ctx.recheckFlag ;
					selectinput8_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput8_updating.params && changed.params) {
					selectinput8_changes.params = ctx.params  ;
					selectinput8_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput8_updating.cols && changed.cols) {
					selectinput8_changes.cols = ctx.cols ;
					selectinput8_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput8_updating.changedParams && changed.changedParams) {
					selectinput8_changes.changedParams = ctx.changedParams ;
					selectinput8_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput8._set(selectinput8_changes);
				selectinput8_updating = {};

				if (ctx.reportType === 'о воспроизводстве лесов') {
					if (if_block3) {
						if_block3.p(changed, ctx);
					} else {
						if_block3 = create_if_block_4$2(component, ctx);
						if (if_block3) { if_block3.c(); }
					}

					if_block3.i(div7, text15);
				} else if (if_block3) {
					if_block3.o(function() {
						if_block3.d(1);
						if_block3 = null;
					});
				}

				var selectinput9_changes = {};
				if (!selectinput9_updating.recheckFlag && changed.recheckFlag) {
					selectinput9_changes.recheckFlag = ctx.recheckFlag ;
					selectinput9_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput9_updating.params && changed.params) {
					selectinput9_changes.params = ctx.params  ;
					selectinput9_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput9_updating.cols && changed.cols) {
					selectinput9_changes.cols = ctx.cols ;
					selectinput9_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput9_updating.changedParams && changed.changedParams) {
					selectinput9_changes.changedParams = ctx.changedParams ;
					selectinput9_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput9._set(selectinput9_changes);
				selectinput9_updating = {};

				if ((!current || changed.params) && text17_value !== (text17_value = ctx.params.scale.title || ctx.params.scale.value)) {
					setData(text17, text17_value);
				}

				if (changed.scales || changed.params) {
					each_value_2 = ctx.scales;

					for (var i = 0; i < each_value_2.length; i += 1) {
						var child_ctx = get_each_context_2$2(ctx, each_value_2, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_1$2(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select1, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_2.length;
				}

				if ((!current || changed.params) && text20_value !== (text20_value = ctx.params.quadrantLayerId.title || ctx.params.quadrantLayerId.value)) {
					setData(text20, text20_value);
				}

				if (ctx.quadrantIds) {
					if (if_block4) {
						if_block4.p(changed, ctx);
					} else {
						if_block4 = create_if_block_3$3(component, ctx);
						if_block4.c();
						if_block4.m(select2, null);
					}
				} else if (if_block4) {
					if_block4.d(1);
					if_block4 = null;
				}

				if ((!current || changed.drawstart) && text34_value !== (text34_value = ctx.drawstart ? 'Полигон рисуется' :'Выделите участки полигоном')) {
					setData(text34, text34_value);
				}

				if ((!current || changed.Object || changed.checked) && text37_value !== (text37_value = ctx.Object.keys(ctx.checked).length)) {
					setData(text37, text37_value);
				}

				if ((!current || changed.layerItems) && text39_value !== (text39_value = ctx.layerItems.length)) {
					setData(text39, text39_value);
				}

				var table_changes = {};
				if (changed.layerItems) { table_changes.items = ctx.layerItems; }
				if (changed.hashCols) { table_changes.hashCols = ctx.hashCols; }
				if (changed.reverse) { table_changes.reverse = ctx.reverse; }
				if (!table_updating.checked && changed.checked) {
					table_changes.checked = ctx.checked ;
					table_updating.checked = ctx.checked  !== void 0;
				}
				table._set(table_changes);
				table_updating = {};

				if (ctx.error) {
					if (if_block5) {
						if_block5.p(changed, ctx);
					} else {
						if_block5 = create_if_block_2$4(component, ctx);
						if_block5.c();
						if_block5.m(div16, text42);
					}
				} else if (if_block5) {
					if_block5.d(1);
					if_block5 = null;
				}

				if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block6) {
					if_block6.p(changed, ctx);
				} else {
					if_block6.d(1);
					if_block6 = current_block_type_1(component, ctx);
					if_block6.c();
					if_block6.m(div15, null);
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				outrocallback = callAfter(outrocallback, 13);

				if (if_block2) { if_block2.o(outrocallback); }
				else { outrocallback(); }

				if (selectinput0) { selectinput0._fragment.o(outrocallback); }
				if (selectinput1) { selectinput1._fragment.o(outrocallback); }
				if (selectinput2) { selectinput2._fragment.o(outrocallback); }
				if (selectinput3) { selectinput3._fragment.o(outrocallback); }
				if (selectinput4) { selectinput4._fragment.o(outrocallback); }
				if (selectinput5) { selectinput5._fragment.o(outrocallback); }
				if (selectinput6) { selectinput6._fragment.o(outrocallback); }
				if (selectinput7) { selectinput7._fragment.o(outrocallback); }
				if (selectinput8) { selectinput8._fragment.o(outrocallback); }

				if (if_block3) { if_block3.o(outrocallback); }
				else { outrocallback(); }

				if (selectinput9) { selectinput9._fragment.o(outrocallback); }
				if (table) { table._fragment.o(outrocallback); }
				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div16);
				}

				if (if_block0) { if_block0.d(); }
				if_block1.d();
				removeListener(select0, "change", change_handler);
				if (component.refs.reportType === select0) { component.refs.reportType = null; }
				if (if_block2) { if_block2.d(); }
				selectinput0.destroy();
				selectinput1.destroy();
				selectinput2.destroy();
				selectinput3.destroy();
				selectinput4.destroy();
				selectinput5.destroy();
				selectinput6.destroy();
				selectinput7.destroy();
				selectinput8.destroy();
				if (if_block3) { if_block3.d(); }
				selectinput9.destroy();

				destroyEach(each_blocks, detach);

				removeListener(select1, "change", change_handler_1);
				if (component.refs.scale === select1) { component.refs.scale = null; }
				if (if_block4) { if_block4.d(); }
				removeListener(select2, "change", change_handler_2);
				if (component.refs.quadrantLayerId === select2) { component.refs.quadrantLayerId = null; }
				removeListener(div7, "mousedown", mousedown_handler);
				removeListener(input0, "change", change_handler_3);
				removeListener(input1, "change", change_handler_4);
				removeListener(input2, "change", change_handler_5);
				removeListener(button, "click", click_handler);
				table.destroy();
				if (if_block5) { if_block5.d(); }
				if_block6.d();
			}
		};
	}

	// (304:4) {#if stateSave}
	function create_if_block_7(component, ctx) {
		var i;

		function click_handler(event) {
			component.loadState();
		}

		return {
			c: function c() {
				i = createElement("i");
				addListener(i, "click", click_handler);
				i.className = "material-icons loadState disabled svelte-c1dd6u";
				i.title = "Загрузить выбор полей предыдущего отчета";
			},

			m: function m(target, anchor) {
				insert(target, i, anchor);
				component.refs.loadState = i;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(i);
				}

				removeListener(i, "click", click_handler);
				if (component.refs.loadState === i) { component.refs.loadState = null; }
			}
		};
	}

	// (315:0) {:else}
	function create_else_block_1$1(component, ctx) {
		var each_anchor;

		var each_value_1 = ctx.params.reportType.options;

		var each_blocks = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_2$2(component, get_each_context_1$2(ctx, each_value_1, i));
		}

		return {
			c: function c() {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_anchor = createComment();
			},

			m: function m(target, anchor) {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if (changed.params) {
					each_value_1 = ctx.params.reportType.options;

					for (var i = 0; i < each_value_1.length; i += 1) {
						var child_ctx = get_each_context_1$2(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block_2$2(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_anchor.parentNode, each_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_1.length;
				}
			},

			d: function d(detach) {
				destroyEach(each_blocks, detach);

				if (detach) {
					detachNode(each_anchor);
				}
			}
		};
	}

	// (313:0) {#if metaTypeReport}
	function create_if_block_6(component, ctx) {
		var option, text;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(ctx.metaTypeReport);
				option.__value = ctx.metaTypeReport;
				option.value = option.__value;
				option.className = "svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if (changed.metaTypeReport) {
					setData(text, ctx.metaTypeReport);
					option.__value = ctx.metaTypeReport;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (316:0) {#each params.reportType.options as it}
	function create_each_block_2$2(component, ctx) {
		var option, text_value = ctx.it, text, option_value_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it;
				option.value = option.__value;
				option.className = "svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.params) && text_value !== (text_value = ctx.it)) {
					setData(text, text_value);
				}

				if ((changed.params) && option_value_value !== (option_value_value = ctx.it)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (323:0) {#if reportType !== 'о воспроизводстве лесов'}
	function create_if_block_5$2(component, ctx) {
		var div, selectinput0_updating = {}, text, selectinput1_updating = {}, current;

		var selectinput0_initial_data = { key: "fellingForm" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput0_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput0_updating.recheckFlag = true;
		}
		if (ctx.params  !== void 0) {
			selectinput0_initial_data.params = ctx.params ;
			selectinput0_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput0_initial_data.cols = ctx.cols ;
			selectinput0_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput0_initial_data.changedParams = ctx.changedParams ;
			selectinput0_updating.changedParams = true;
		}
		var selectinput0 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput0_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput0_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput0_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput0_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput0_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput0_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput0._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput0.get());
		});

		var selectinput1_initial_data = { key: "fellingType" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput1_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput1_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput1_initial_data.params = ctx.params  ;
			selectinput1_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput1_initial_data.cols = ctx.cols ;
			selectinput1_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput1_initial_data.changedParams = ctx.changedParams ;
			selectinput1_updating.changedParams = true;
		}
		var selectinput1 = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput1_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput1_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput1_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput1_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput1_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput1_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput1._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput1.get());
		});

		return {
			c: function c() {
				div = createElement("div");
				selectinput0._fragment.c();
				text = createText("\r\n\t\t\t\t\t\t");
				selectinput1._fragment.c();
			},

			m: function m(target, anchor) {
				insert(target, div, anchor);
				selectinput0._mount(div, null);
				append(div, text);
				selectinput1._mount(div, null);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				var selectinput0_changes = {};
				if (!selectinput0_updating.recheckFlag && changed.recheckFlag) {
					selectinput0_changes.recheckFlag = ctx.recheckFlag ;
					selectinput0_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput0_updating.params && changed.params) {
					selectinput0_changes.params = ctx.params ;
					selectinput0_updating.params = ctx.params  !== void 0;
				}
				if (!selectinput0_updating.cols && changed.cols) {
					selectinput0_changes.cols = ctx.cols ;
					selectinput0_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput0_updating.changedParams && changed.changedParams) {
					selectinput0_changes.changedParams = ctx.changedParams ;
					selectinput0_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput0._set(selectinput0_changes);
				selectinput0_updating = {};

				var selectinput1_changes = {};
				if (!selectinput1_updating.recheckFlag && changed.recheckFlag) {
					selectinput1_changes.recheckFlag = ctx.recheckFlag ;
					selectinput1_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput1_updating.params && changed.params) {
					selectinput1_changes.params = ctx.params  ;
					selectinput1_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput1_updating.cols && changed.cols) {
					selectinput1_changes.cols = ctx.cols ;
					selectinput1_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput1_updating.changedParams && changed.changedParams) {
					selectinput1_changes.changedParams = ctx.changedParams ;
					selectinput1_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput1._set(selectinput1_changes);
				selectinput1_updating = {};
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				outrocallback = callAfter(outrocallback, 2);

				if (selectinput0) { selectinput0._fragment.o(outrocallback); }
				if (selectinput1) { selectinput1._fragment.o(outrocallback); }
				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div);
				}

				selectinput0.destroy();
				selectinput1.destroy();
			}
		};
	}

	// (338:0) {#if reportType === 'о воспроизводстве лесов'}
	function create_if_block_4$2(component, ctx) {
		var selectinput_updating = {}, current;

		var selectinput_initial_data = { key: "recoveryEventType" };
		if (ctx.recheckFlag  !== void 0) {
			selectinput_initial_data.recheckFlag = ctx.recheckFlag ;
			selectinput_updating.recheckFlag = true;
		}
		if (ctx.params   !== void 0) {
			selectinput_initial_data.params = ctx.params  ;
			selectinput_updating.params = true;
		}
		if (ctx.cols  !== void 0) {
			selectinput_initial_data.cols = ctx.cols ;
			selectinput_updating.cols = true;
		}
		if (ctx.changedParams  !== void 0) {
			selectinput_initial_data.changedParams = ctx.changedParams ;
			selectinput_updating.changedParams = true;
		}
		var selectinput = new SelectInput({
			root: component.root,
			store: component.store,
			data: selectinput_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!selectinput_updating.recheckFlag && changed.recheckFlag) {
					newState.recheckFlag = childState.recheckFlag;
				}

				if (!selectinput_updating.params && changed.params) {
					newState.params = childState.params;
				}

				if (!selectinput_updating.cols && changed.cols) {
					newState.cols = childState.cols;
				}

				if (!selectinput_updating.changedParams && changed.changedParams) {
					newState.changedParams = childState.changedParams;
				}
				component._set(newState);
				selectinput_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			selectinput._bind({ recheckFlag: 1, params: 1, cols: 1, changedParams: 1 }, selectinput.get());
		});

		return {
			c: function c() {
				selectinput._fragment.c();
			},

			m: function m(target, anchor) {
				selectinput._mount(target, anchor);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				var selectinput_changes = {};
				if (!selectinput_updating.recheckFlag && changed.recheckFlag) {
					selectinput_changes.recheckFlag = ctx.recheckFlag ;
					selectinput_updating.recheckFlag = ctx.recheckFlag  !== void 0;
				}
				if (!selectinput_updating.params && changed.params) {
					selectinput_changes.params = ctx.params  ;
					selectinput_updating.params = ctx.params   !== void 0;
				}
				if (!selectinput_updating.cols && changed.cols) {
					selectinput_changes.cols = ctx.cols ;
					selectinput_updating.cols = ctx.cols  !== void 0;
				}
				if (!selectinput_updating.changedParams && changed.changedParams) {
					selectinput_changes.changedParams = ctx.changedParams ;
					selectinput_updating.changedParams = ctx.changedParams  !== void 0;
				}
				selectinput._set(selectinput_changes);
				selectinput_updating = {};
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (selectinput) { selectinput._fragment.o(outrocallback); }
				current = false;
			},

			d: function d(detach) {
				selectinput.destroy(detach);
			}
		};
	}

	// (346:0) {#each scales as it}
	function create_each_block_1$2(component, ctx) {
		var option, text_value = ctx.it.title, text, option_value_value, option_selected_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it.value;
				option.value = option.__value;
				option.selected = option_selected_value = ctx.it.value == ctx.params.scale.value;
				option.className = "svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.scales) && text_value !== (text_value = ctx.it.title)) {
					setData(text, text_value);
				}

				if ((changed.scales) && option_value_value !== (option_value_value = ctx.it.value)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
				if ((changed.scales || changed.params) && option_selected_value !== (option_selected_value = ctx.it.value == ctx.params.scale.value)) {
					option.selected = option_selected_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (355:0) {#if quadrantIds}
	function create_if_block_3$3(component, ctx) {
		var each_anchor;

		var each_value_3 = ctx.quadrantIds;

		var each_blocks = [];

		for (var i = 0; i < each_value_3.length; i += 1) {
			each_blocks[i] = create_each_block$6(component, get_each_context_3$1(ctx, each_value_3, i));
		}

		return {
			c: function c() {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_anchor = createComment();
			},

			m: function m(target, anchor) {
				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(target, anchor);
				}

				insert(target, each_anchor, anchor);
			},

			p: function p(changed, ctx) {
				if (changed.quadrantIds) {
					each_value_3 = ctx.quadrantIds;

					for (var i = 0; i < each_value_3.length; i += 1) {
						var child_ctx = get_each_context_3$1(ctx, each_value_3, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
						} else {
							each_blocks[i] = create_each_block$6(component, child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_anchor.parentNode, each_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}
					each_blocks.length = each_value_3.length;
				}
			},

			d: function d(detach) {
				destroyEach(each_blocks, detach);

				if (detach) {
					detachNode(each_anchor);
				}
			}
		};
	}

	// (356:1) {#each quadrantIds as it}
	function create_each_block$6(component, ctx) {
		var option, text_value = ctx.it.title, text, option_value_value;

		return {
			c: function c() {
				option = createElement("option");
				text = createText(text_value);
				option.__value = option_value_value = ctx.it.id;
				option.value = option.__value;
				option.className = "svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, option, anchor);
				append(option, text);
			},

			p: function p(changed, ctx) {
				if ((changed.quadrantIds) && text_value !== (text_value = ctx.it.title)) {
					setData(text, text_value);
				}

				if ((changed.quadrantIds) && option_value_value !== (option_value_value = ctx.it.id)) {
					option.__value = option_value_value;
				}

				option.value = option.__value;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(option);
				}
			}
		};
	}

	// (389:3) {#if error}
	function create_if_block_2$4(component, ctx) {
		var div1, div0, text_value = ctx.error || '', text;

		return {
			c: function c() {
				div1 = createElement("div");
				div0 = createElement("div");
				text = createText(text_value);
				div0.className = "error svelte-c1dd6u";
				div1.className = "errorParent svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div0, text);
			},

			p: function p(changed, ctx) {
				if ((changed.error) && text_value !== (text_value = ctx.error || '')) {
					setData(text, text_value);
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div1);
				}
			}
		};
	}

	// (397:0) {:else}
	function create_else_block$2(component, ctx) {
		var button, text, button_class_value;

		function click_handler(event) {
			component.sendReport(this);
		}

		return {
			c: function c() {
				button = createElement("button");
				text = createText("Создать отчеты");
				addListener(button, "click", click_handler);
				button.className = button_class_value = "gmx-sidebar-button" + (ctx.Object.keys(ctx.checked).length ? '' : '-disabled') + " svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, button, anchor);
				append(button, text);
				component.refs.submitButton = button;
			},

			p: function p(changed, ctx) {
				if ((changed.Object || changed.checked) && button_class_value !== (button_class_value = "gmx-sidebar-button" + (ctx.Object.keys(ctx.checked).length ? '' : '-disabled') + " svelte-c1dd6u")) {
					button.className = button_class_value;
				}
			},

			d: function d(detach) {
				if (detach) {
					detachNode(button);
				}

				removeListener(button, "click", click_handler);
				if (component.refs.submitButton === button) { component.refs.submitButton = null; }
			}
		};
	}

	// (395:0) {#if report}
	function create_if_block_1$4(component, ctx) {
		var button;

		return {
			c: function c() {
				button = createElement("button");
				button.innerHTML = "<div class=\"lds-ellipsis svelte-c1dd6u\"><div class=\"svelte-c1dd6u\"></div><div class=\"svelte-c1dd6u\"></div><div class=\"svelte-c1dd6u\"></div><div class=\"svelte-c1dd6u\"></div></div>";
				button.className = "gmx-sidebar-button-disabled svelte-c1dd6u";
			},

			m: function m(target, anchor) {
				insert(target, button, anchor);
			},

			p: noop,

			d: function d(detach) {
				if (detach) {
					detachNode(button);
				}
			}
		};
	}

	function Report(options) {
		var this$1 = this;

		init(this, options);
		this.refs = {};
		this._state = assign(assign({ Object : Object }, data$6()), options.data);

		this._recompute({ meta: 1 }, this._state);
		this._intro = !!options.intro;

		this._handlers.state = [onstate$4];

		onstate$4.call(this, { changed: assignTrue({}, this._state), current: this._state });

		this._fragment = create_main_fragment$6(this, this._state);

		this.root._oncreate.push(function () {
			this$1.fire("update", { changed: assignTrue({}, this$1._state), current: this$1._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(Report.prototype, proto);
	assign(Report.prototype, methods$6);

	Report.prototype._recompute = function _recompute(changed, state) {
		if (changed.meta) {
			if (this._differs(state.metaTypeReport, (state.metaTypeReport = metaTypeReport(state)))) { changed.metaTypeReport = true; }
			if (this._differs(state.isTypeRecovery, (state.isTypeRecovery = isTypeRecovery(state)))) { changed.isTypeRecovery = true; }
		}
	};

	/* src\App.html generated by Svelte v2.16.1 */

	//const stateStorage = Requests.getState();

	function data$7() {
		return {
			showGrid: 1,
			gmxMap: null,
			quadrantIds: [],
			layerIds: [],
			layerID: '',
			tab: 'sites'
		}
	}
	var methods$7 = {
		viewItem: function viewItem(id, layerItems, hashCols) {
			var ref = this.get();
			var map = ref.map;

			for (var i = 0, len = layerItems.length; i < len; i++) {
				var it = layerItems[i];
				if (id === it[hashCols.gmx_id]) {
					var geo = it[hashCols.geomixergeojson],
						bbox = L.gmxUtil.getGeometryBounds(geo),
						latlngBbox = L.latLngBounds([[bbox.min.y, bbox.min.x], [bbox.max.y, bbox.max.x]]);
					map.fitBounds(latlngBbox);
					break;
				}
			}
		},

		clearLayer: function clearLayer(ev) {
			var ref = this.get();
			var layerID = ref.layerID;
			var layerIds = ref.layerIds;
			var quadrantIds = ref.quadrantIds;
			var ph = {},
				delID = ev.layer.options.layerID;
			if (delID === layerID) {
				ph.layerID = '';
			}
			for (var i = 0, len = layerIds.length; i < len; i++) {
				if (layerIds[i].id === delID) {
					layerIds.splice(i, 1);
					ph.layerIds = layerIds;
					break;
				}
			}
			for (var i$1 = 0, len$1 = quadrantIds.length; i$1 < len$1; i$1++) {
				if (quadrantIds[i$1].id === delID) {
					quadrantIds.splice(i$1, 1);
					ph.quadrantIds = quadrantIds;
					break;
				}
			}
	 // console.log('clearLayer', ph, quadrantIds);
			this.set(ph);
		}
	};

	function onstate$5(ref) {
		var changed = ref.changed;
		var current = ref.current;
		var previous = ref.previous;

		if (changed.gmxMap) {
			if (!this._eventOn && current.gmxMap._events) {
				this._eventOn = true;
				current.gmxMap.on('layerremove', this.clearLayer.bind(this));
			}
	// console.log('App onstate', changed, current);

	// addPopupHook(key, callback:function(properties, div, node, hooksCount))
			// Requests.getLayersIds(current.meta, current.gmxMap).then(json => { this.set(json); });
		}
	}//	Report

	function create_main_fragment$7(component, ctx) {
		var div, ul, li0, a0, text0, a0_class_value, text1, li1, a1, text2, a1_class_value, text3, current_block_type_index, if_block, current;

		function click_handler(event) {
			component.set({tab: 'sites', layerID: ''});
		}

		function click_handler_1(event) {
			component.set({tab: 'reports', layerID: ''});
		}

		var if_block_creators = [
			create_if_block$6,
			create_else_block$3
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (ctx.tab === 'reports') { return 0; }
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](component, ctx);

		return {
			c: function c() {
				div = createElement("div");
				ul = createElement("ul");
				li0 = createElement("li");
				a0 = createElement("a");
				text0 = createText("Делянки");
				text1 = createText("\r\n\t\t");
				li1 = createElement("li");
				a1 = createElement("a");
				text2 = createText("Отчеты");
				text3 = createText("\r\n\r\n");
				if_block.c();
				addListener(a0, "click", click_handler);
				a0.className = a0_class_value = "nav-link show " + (ctx.tab === 'sites' ? 'active' : '-') + " svelte-1uz6huw";
				a0.href = "#tab1";
				li0.className = "nav-item svelte-1uz6huw";
				addListener(a1, "click", click_handler_1);
				a1.className = a1_class_value = "nav-link " + (ctx.tab === 'reports' ? 'active' : '-') + " svelte-1uz6huw";
				a1.href = "#tab2";
				a1.dataset.toggle = "tab";
				li1.className = "nav-item svelte-1uz6huw";
				ul.className = "nav nav-tabs svelte-1uz6huw";
				div.className = "forest-plugin-container svelte-1uz6huw";
			},

			m: function m(target, anchor) {
				insert(target, div, anchor);
				append(div, ul);
				append(ul, li0);
				append(li0, a0);
				append(a0, text0);
				append(ul, text1);
				append(ul, li1);
				append(li1, a1);
				append(a1, text2);
				append(div, text3);
				if_blocks[current_block_type_index].m(div, null);
				current = true;
			},

			p: function p(changed, ctx) {
				if ((!current || changed.tab) && a0_class_value !== (a0_class_value = "nav-link show " + (ctx.tab === 'sites' ? 'active' : '-') + " svelte-1uz6huw")) {
					a0.className = a0_class_value;
				}

				if ((!current || changed.tab) && a1_class_value !== (a1_class_value = "nav-link " + (ctx.tab === 'reports' ? 'active' : '-') + " svelte-1uz6huw")) {
					a1.className = a1_class_value;
				}

				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					if_block.o(function() {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](component, ctx);
						if_block.c();
					}
					if_block.m(div, null);
				}
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (if_block) { if_block.o(outrocallback); }
				else { outrocallback(); }

				current = false;
			},

			d: function d(detach) {
				if (detach) {
					detachNode(div);
				}

				removeListener(a0, "click", click_handler);
				removeListener(a1, "click", click_handler_1);
				if_blocks[current_block_type_index].d();
			}
		};
	}

	// (91:0) {:else}
	function create_else_block$3(component, ctx) {
		var sites_updating = {}, current;

		var sites_initial_data = {};
		if (ctx.gmxMap  !== void 0) {
			sites_initial_data.gmxMap = ctx.gmxMap ;
			sites_updating.gmxMap = true;
		}
		if (ctx.map  !== void 0) {
			sites_initial_data.map = ctx.map ;
			sites_updating.map = true;
		}
		if (ctx.layerID  !== void 0) {
			sites_initial_data.layerID = ctx.layerID ;
			sites_updating.layerID = true;
		}
		if (ctx.layerIds  !== void 0) {
			sites_initial_data.layerIds = ctx.layerIds ;
			sites_updating.layerIds = true;
		}
		if (ctx.quadrantIds  !== void 0) {
			sites_initial_data.quadrantIds = ctx.quadrantIds ;
			sites_updating.quadrantIds = true;
		}
		var sites = new Sites({
			root: component.root,
			store: component.store,
			data: sites_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!sites_updating.gmxMap && changed.gmxMap) {
					newState.gmxMap = childState.gmxMap;
				}

				if (!sites_updating.map && changed.map) {
					newState.map = childState.map;
				}

				if (!sites_updating.layerID && changed.layerID) {
					newState.layerID = childState.layerID;
				}

				if (!sites_updating.layerIds && changed.layerIds) {
					newState.layerIds = childState.layerIds;
				}

				if (!sites_updating.quadrantIds && changed.quadrantIds) {
					newState.quadrantIds = childState.quadrantIds;
				}
				component._set(newState);
				sites_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			sites._bind({ gmxMap: 1, map: 1, layerID: 1, layerIds: 1, quadrantIds: 1 }, sites.get());
		});

		return {
			c: function c() {
				sites._fragment.c();
			},

			m: function m(target, anchor) {
				sites._mount(target, anchor);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				var sites_changes = {};
				if (!sites_updating.gmxMap && changed.gmxMap) {
					sites_changes.gmxMap = ctx.gmxMap ;
					sites_updating.gmxMap = ctx.gmxMap  !== void 0;
				}
				if (!sites_updating.map && changed.map) {
					sites_changes.map = ctx.map ;
					sites_updating.map = ctx.map  !== void 0;
				}
				if (!sites_updating.layerID && changed.layerID) {
					sites_changes.layerID = ctx.layerID ;
					sites_updating.layerID = ctx.layerID  !== void 0;
				}
				if (!sites_updating.layerIds && changed.layerIds) {
					sites_changes.layerIds = ctx.layerIds ;
					sites_updating.layerIds = ctx.layerIds  !== void 0;
				}
				if (!sites_updating.quadrantIds && changed.quadrantIds) {
					sites_changes.quadrantIds = ctx.quadrantIds ;
					sites_updating.quadrantIds = ctx.quadrantIds  !== void 0;
				}
				sites._set(sites_changes);
				sites_updating = {};
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (sites) { sites._fragment.o(outrocallback); }
				current = false;
			},

			d: function d(detach) {
				sites.destroy(detach);
			}
		};
	}

	// (89:0) {#if tab === 'reports'}
	function create_if_block$6(component, ctx) {
		var report_updating = {}, current;

		var report_initial_data = {};
		if (ctx.gmxMap  !== void 0) {
			report_initial_data.gmxMap = ctx.gmxMap ;
			report_updating.gmxMap = true;
		}
		if (ctx.map  !== void 0) {
			report_initial_data.map = ctx.map ;
			report_updating.map = true;
		}
		if (ctx.layerID  !== void 0) {
			report_initial_data.layerID = ctx.layerID ;
			report_updating.layerID = true;
		}
		if (ctx.layerIds  !== void 0) {
			report_initial_data.layerIds = ctx.layerIds ;
			report_updating.layerIds = true;
		}
		if (ctx.quadrantIds  !== void 0) {
			report_initial_data.quadrantIds = ctx.quadrantIds ;
			report_updating.quadrantIds = true;
		}
		if (ctx.showGrid  !== void 0) {
			report_initial_data.showGrid = ctx.showGrid ;
			report_updating.showGrid = true;
		}
		var report = new Report({
			root: component.root,
			store: component.store,
			data: report_initial_data,
			_bind: function _bind(changed, childState) {
				var newState = {};
				if (!report_updating.gmxMap && changed.gmxMap) {
					newState.gmxMap = childState.gmxMap;
				}

				if (!report_updating.map && changed.map) {
					newState.map = childState.map;
				}

				if (!report_updating.layerID && changed.layerID) {
					newState.layerID = childState.layerID;
				}

				if (!report_updating.layerIds && changed.layerIds) {
					newState.layerIds = childState.layerIds;
				}

				if (!report_updating.quadrantIds && changed.quadrantIds) {
					newState.quadrantIds = childState.quadrantIds;
				}

				if (!report_updating.showGrid && changed.showGrid) {
					newState.showGrid = childState.showGrid;
				}
				component._set(newState);
				report_updating = {};
			}
		});

		component.root._beforecreate.push(function () {
			report._bind({ gmxMap: 1, map: 1, layerID: 1, layerIds: 1, quadrantIds: 1, showGrid: 1 }, report.get());
		});

		return {
			c: function c() {
				report._fragment.c();
			},

			m: function m(target, anchor) {
				report._mount(target, anchor);
				current = true;
			},

			p: function p(changed, _ctx) {
				ctx = _ctx;
				var report_changes = {};
				if (!report_updating.gmxMap && changed.gmxMap) {
					report_changes.gmxMap = ctx.gmxMap ;
					report_updating.gmxMap = ctx.gmxMap  !== void 0;
				}
				if (!report_updating.map && changed.map) {
					report_changes.map = ctx.map ;
					report_updating.map = ctx.map  !== void 0;
				}
				if (!report_updating.layerID && changed.layerID) {
					report_changes.layerID = ctx.layerID ;
					report_updating.layerID = ctx.layerID  !== void 0;
				}
				if (!report_updating.layerIds && changed.layerIds) {
					report_changes.layerIds = ctx.layerIds ;
					report_updating.layerIds = ctx.layerIds  !== void 0;
				}
				if (!report_updating.quadrantIds && changed.quadrantIds) {
					report_changes.quadrantIds = ctx.quadrantIds ;
					report_updating.quadrantIds = ctx.quadrantIds  !== void 0;
				}
				if (!report_updating.showGrid && changed.showGrid) {
					report_changes.showGrid = ctx.showGrid ;
					report_updating.showGrid = ctx.showGrid  !== void 0;
				}
				report._set(report_changes);
				report_updating = {};
			},

			i: function i(target, anchor) {
				if (current) { return; }

				this.m(target, anchor);
			},

			o: function o(outrocallback) {
				if (!current) { return; }

				if (report) { report._fragment.o(outrocallback); }
				current = false;
			},

			d: function d(detach) {
				report.destroy(detach);
			}
		};
	}

	function App(options) {
		var this$1 = this;

		init(this, options);
		this._state = assign(data$7(), options.data);
		this._intro = !!options.intro;

		this._handlers.state = [onstate$5];

		onstate$5.call(this, { changed: assignTrue({}, this._state), current: this._state });

		this._fragment = create_main_fragment$7(this, this._state);

		this.root._oncreate.push(function () {
			this$1.fire("update", { changed: assignTrue({}, this$1._state), current: this$1._state });
		});

		if (options.target) {
			this._fragment.c();
			this._mount(options.target, options.anchor);

			flush(this);
		}

		this._intro = true;
	}

	assign(App.prototype, proto);
	assign(App.prototype, methods$7);

	exports.App = App;

	return exports;

}({}));
//# sourceMappingURL=gmxForest_dev2.js.map
