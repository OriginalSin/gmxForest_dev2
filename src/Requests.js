import * as Config from './Config.js';
import * as EditorLib from './EditorLib.js';
import Popup from './Popup.html';

const	serverBase = window.serverBase || '//maps.kosmosnimki.ru/',
		serverProxy = serverBase + 'Plugins/ForestReport/proxy';
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

const chkLayer = (val) => {
	let map = nsGmx.leafletMap,
		layer = nsGmx.gmxMap.layersByID[val],
		latLngBounds = L.gmxUtil.getGeometryBounds(layer._gmx.geometry).toLatLngBounds(true);
console.log('ddddddddd', layer._gmx.geometry)
	map.fitBounds(latLngBounds);
	if (!layer._map) {
		map.addLayer(layer);
	}
};

const getAngleDist = (latlng, latlngs, dec, delta) => {
	delta = delta || 1;
	let p = latlng;
	let ring = latlngs.map((latlng) => {
		let bearing = L.GeometryUtil.bearing(p, latlng),
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

const getFormBody = function(par) {
	return Object.keys(par).map((key) => {
		return encodeURIComponent(key) + '=' + encodeURIComponent(par[key]);
	}).join('&');
};
const getFormData = function(obj) {
	let formData  = new FormData();
	for(let name in obj) {
		let val  = obj[name];
		formData.append(name, typeof val === 'object' ? JSON.stringify(val) : val);
	}
	return formData;
};

const createVectorLayer = (params) => {
	params.WrapStyle = 'None';

	const url = `${serverBase}VectorLayer/CreateVectorLayer.ashx`;
	L.gmxUtil.loaderStatus(url);
	
	return fetch(url, {
		method: 'post',
		mode: 'cors',
		credentials: 'include',
		body: getFormData(params)	// TODO: сервер почему то не хочет работать так https://googlechrome.github.io/samples/fetch-api/fetch-post.html
	})
		.then(res => { L.gmxUtil.loaderStatus(url, true); return res.json(); })
		.catch(err => console.warn(err));
};

const querySelect = (sql) => {
	// console.log('modifyVectorObjects ____ ', layerId, features);

	const url = `${serverBase}VectorLayer/CreateVectorLayer.ashx`;
	L.gmxUtil.loaderStatus(url);

	return fetch(url, {
		method: 'post',
		mode: 'cors',
		credentials: 'include',
		headers: {'Content-type': 'application/x-www-form-urlencoded'},
		body: getFormBody({
			WrapStyle: 'None',
			sql: sql
		})
	})
		.then(res => { L.gmxUtil.loaderStatus(url, true); return res.json(); })
		.catch(err => console.warn(err));
};

const modifyVectorObjects = (layerId, features) => {
	// console.log('modifyVectorObjects ____ ', layerId, features);
	const url = `${serverBase}VectorLayer/ModifyVectorObjects.ashx`;

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
		.then(res => { L.gmxUtil.loaderStatus(url, true); return res.json(); })
		.catch(err => console.warn(err));
};

const getReq = url => {
	L.gmxUtil.loaderStatus(url);
	return fetch(url, {
			mode: 'cors',
			credentials: 'include'
		})
		.then(res => { L.gmxUtil.loaderStatus(url, true); return res.json(); })
		.catch(err => console.warn(err));
};

const getReportsCount = () => {
	return getReq(serverProxy + '?path=/rest/v1/get-current-user-info');
};

const loadFeature = (layerId, id) => {
	const url = `${serverBase}VectorLayer/Search.ashx?layer=${layerId}&query=gmx_id=${id}&geometry=true&out_cs=EPSG:4326&WrapStyle=None`;
	return getReq(url);
};

const loadFeatures = id => {
	const url = `${serverBase}VectorLayer/Search.ashx?layer=${id}&geometry=true&out_cs=EPSG:4326&WrapStyle=None`;
	return getReq(url);
};

const colsToHash = arr => {
	return arr.reduce((a, v, i) => { a[v] = i; return a; }, {});
};

const loadQuadrantValues = id => {
	return loadFeatures(id)
		.then(json => {
			if (json.Status === 'ok') {
				let res = json.Result,
					cols = res.fields,
					hashCols = colsToHash(cols),
					nm = hashCols.kv,
					nmGeo = hashCols.geomixergeojson;
				return res.values.reduce((a, v, i) => {
					let key = v[nm],
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
}

const selectFeaturesWithDrawing = (id, geometry) => {
	const params = {
		WrapStyle: 'None',
		layer: id,
		columns: '[{"Value":"[gmx_id]"}]',
		page: 0,
		// pagesize: null,
		query: `STIntersects([gmx_geometry], GeometryFromGeoJson('${JSON.stringify(geometry)}', 4326))`
	};

	return fetch(`${serverBase}VectorLayer/Search.ashx?${L.gmxUtil.getFormData(params)}`, {
		mode: 'cors',
		credentials: 'include',
		headers: {
			'Accept': 'application/json'
		}
	})
	.then(res => res.json())
	.then(json => {
		if (json.Status === 'ok' && json.Result) {
			return json.Result.values.reduce((a, v) => {
				a[v] = true;
				return a;
			}, {});
		}
	})
	.catch(err => console.warn(err))
};

const getLayersParams = (gmxMap) => {
	let satLayers = [];

	gmxMap.layers.forEach((it) => {
		if (it.getGmxProperties && it._map) {
			let props = it.getGmxProperties(),
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

const getLayersIds = (gmxMap) => {
	let layerIds = [], quadrantIds = [], limit = 0, layerIdsHash = {}, quadrantIdsHash = {};

	gmxMap.layers.forEach((it) => {
		if (it.getGmxProperties) {
			let props = it.getGmxProperties(),
				metaProps = props.MetaProperties || {};
			if (
				props.type.toLowerCase() === 'vector' &&
				props.GeometryType.toLowerCase() === 'polygon' &&
				!props.IsRasterCatalog &&
				!props.Quicklook
				) {
				let keys = it._gmx.tileAttributeTypes,
					hash = {id: props.name, title: props.title, bounds: it.getBounds(), _layer: it};

				// if (keys.FRSTAT && (keys.kv || keys.kvartal || keys['Квартал'])) {
					// hash.linkKey = keys.kv ? 'kv' : (keys.kvartal ? 'kvartal' : 'Квартал');
				if (keys.FRSTAT && keys.snap) {
					hash.linkKey = 'kvartal';
					layerIds.push(hash);
					layerIdsHash[hash.id] = hash;

					it.addPopupHook('forestCont', (properties, div, node, hooksCount) => {
						let standart = div.innerHTML.replace(/<b>FRSTAT:.+?<br>/, '').replace(/<b>snap:.+?<br>/, '')
						// div.innerHTML = '[forestCont]';
						div.innerHTML = '';
						loadFeature(hash.id, properties.gmx_id).then((json) => {
							if (json.Status === 'ok') {
								let arr = json.Result.values[0],
									geo = arr[arr.length - 1],
									geoJson = L.gmxUtil.geometryToGeoJSON(geo),
									coord = geoJson.coordinates[0][0],
									declination = geoMag(coord[1], coord[0], 0).dec || 0,
									latlngs = geoJson.coordinates[0].map((it) => L.latLng(it[1], it[0])),
									ring = getAngleDist(latlngs[0], latlngs, declination);
								ring.shift();

								let popup = new Popup({
									target: div,
									data: {
										getReverse: () => { latlngs.reverse(); let arr = getAngleDist(latlngs[0], latlngs, declination); arr.shift(); return arr; },
										ring: ring,
										standart: standart,
										properties: properties,
										// declination: geoMag(coord[1], coord[0], 0).dec || 0,
										geoJson: geoJson
									}
								});
								let gmxPopup = nsGmx.leafletMap._gmxPopups[0],
									bbox = L.gmxUtil.getGeometryBounds(geoJson),
									latlng = L.latLng(bbox.max.y, bbox.min.x + (bbox.max.x - bbox.min.x) / 2);

								gmxPopup.setLatLng(latlng);
							}
						});
					});
				} else if (keys.kv) {
					hash.linkKey = 'kv';
					quadrantIds.push(hash);
					quadrantIdsHash[hash.id] = hash;
				}
			}
		}
	});
	return {layerIds, quadrantIds, limit, cols: []};
};

const saveState = (data, key) => {
	key = key || 'gmxForest_';
	window.localStorage.setItem(key, JSON.stringify(data));
};

const getState = key => {
	key = key || 'gmxForest_';
	return JSON.parse(window.localStorage.getItem(key)) || {};
};

const getReportType = (zn) => {
	const pt = Config.fieldsConf.report_t.onValue[zn] || zn;

	return pt ? pt.value : zn;
};

const sendReport = (flag, numPoints, drawSnap, showGrid, pdf, checked, layerItems, hashCols, params, format, layerID, gmxMap, changedParams, num_points, templ, app) => {
	let groupRequest = [],
		features = [],
		satLayers = getLayersParams(gmxMap);

	for (let i = 0, len = layerItems.length; i < len; i++) {
		let it = layerItems[i];
	// layerItems.forEach((it) => {
		let id = it[hashCols.gmx_id];
		if (checked[id]) {
			let data = {featureID: id, num_points: num_points, templ: templ};
			for (let key in params) {
				if (key === 'layerID') {
					data[key] = layerID;
				} else {
					let val = params[key];
					let par = key in changedParams ? changedParams[key] : {};
					data[key] = typeof(par) === 'string' ? par : par.field ? it[hashCols[par.field]] : par.value || val.value;
				}
				let emptyFlag = false;
				if (flag && key !== 'scale' && key !== 'dacha' && key !== 'inn' && data[key] === '') {
					emptyFlag = true;
					let rt = getReportType(data['reportType']);
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
				if (emptyFlag) { return null; }
			}
			data.satLayers = satLayers;
			groupRequest.push(data);
			features.push({action:'update', id:id, properties:{FRSTAT:2}});
		}
	}
	// });

let reparseParams = (arr) => {
	let out = arr.map((it) => {
		let ph = {};
		for (let key in it) {
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
					ph.area = Number(it[key]);
					break;
				case 'scale':
					ph.scale = Number(it[key]) || 0;
					break;
				case 'site':
					ph.delyanka = String(it[key]);
					break;
				case 'satLayers':
					ph.satLayers = it.satLayers.map((pt) => {
						let ps = {};
						for (let key in pt) {
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

let tt = reparseParams(groupRequest);
// console.log('groupRequest1', JSON.stringify(tt));

	return fetch(serverProxy + '', {
			method: 'post',
			mode: 'cors',
			credentials: 'include',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({groupRequest: tt, numPoints: numPoints, drawSnap: drawSnap, pdf: pdf, showGrid: showGrid, path: '/rest/v1/createfile' })
		})
		.then(res => res.json())
		.then(json => {
// console.log('createfile', json);
			if (json.status === 'active') {
				saveState(changedParams);
				return chkTask(json.id)
					.then(json => {
// console.log('chkTask', json);
						if (json.status === 'completed') {
							let downloadFile = json.message;

							//window.open('http://lesfond.tk/rest/v1/' + downloadFile, '_self');
							window.open(serverProxy + '?path=/rest/v1/getfile&' + downloadFile, '_self');

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
					.catch(err => console.warn(err));
			}
		})
		.catch(err => {
			console.warn(err);
			return {report: false};
		});
};

const chkTask = id => {
	const UPDATE_INTERVAL = 2000;
	return new Promise((resolve, reject) => {
		let interval = setInterval(() => {
			fetch(serverProxy + '?path=/rest/v1/checkstatus&id=' + id, {
				// mode: 'cors',
				// credentials: 'include'
			})
				.then(res => res.json())
				.then(json => {
// console.log('chkTask_______', json);
					if (json.status === 'error') {
						clearInterval(interval);
						resolve(json);
					} else if (json.status === 'completed') {
						clearInterval(interval);
						resolve(json);
					}
				})
				.catch(err => console.warn(err));
		}, UPDATE_INTERVAL);
	})
	.catch(err => console.warn(err));
};

const createSiteLayer = (data, columns) => {
	data = data || {};
	let props = {
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
	return EditorLib.saveLayer(props).then(json => {
		L.gmx.loadLayer(nsGmx.gmxMap.options.mapName, json.name, nsGmx.gmxMap.options)
		.then((res) => {
		});
		return json.name;
	});
};

const sendVectorFile = (target, flagNames) => {
	// const url = 'http://10.1.2.20:4000/rest/v1/get-contours',
	const url = serverProxy + '?path=/rest/v1/get-contours',
		formData = new FormData();

	for (let i = 0, len = target.files.length; i < len; i++) {
		formData.append('file' + i, target.files[i]);
	}
	
	L.gmxUtil.loaderStatus(url);

	return fetch(url, {
		method: 'POST',
		body: formData,
	})
		.then(res => res.json())
		.then(json => {
			L.gmxUtil.loaderStatus(url, true);
			if (json.status === 'ok') {
				let features = json.text.features,
					columns = null;
				if (flagNames) {
					// console.log('ddddd', features[0]);
					columns = Object.keys(features[0].properties).map(key => {
						return {
							Name: key,
							ColumnSimpleType: key === 'FRSTAT' ? 'Integer' : 'String'
						};
					})
				}
				return createSiteLayer({
					Title: json.title || ''
				}, columns).then(layerID => {
// console.log('sendImportFile', layerID, features);
					if (features.length) {
						return modifyVectorObjects(layerID, features.map((it) => {
							it.action = 'insert';
							return it;
						})).then((ev) => {
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
		.catch(err => {
			console.warn(err);
			return {report: false};
		});
};

const sendExcel = target => {
	const url = serverProxy + '?path=/rest/v1/create-contours',
	// const url = location.search.indexOf('&test=proxy') !== -1 ? serverProxy + '?path=/rest/v1/create-contours' : 'http://lesfond.tk/rest/v1/create-contours',
		formData = new FormData();

	for (let i = 0, len = target.files.length; i < len; i++) {
		formData.append('file' + i, target.files[i]);
	}
	
	L.gmxUtil.loaderStatus(url);

	return fetch(url, {
		method: 'POST',
		body: formData,
	})
		.then(res => res.json())
		.then(json => {
			L.gmxUtil.loaderStatus(url, true);
			if (json.status === 'ok') {
				let features = json.text.features;
				return createSiteLayer({
					Title: json.title || ''
				}).then(layerID => {
// console.log('sendImportFile', layerID, features);
					if (features.length) {
						return modifyVectorObjects(layerID, features.map((it) => {
							it.action = 'insert';
							return it;
						})).then((ev) => {
console.log('modifyVectorObjects', layerID, ev)
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
		.catch(err => {
			console.warn(err);
			return {report: false};
		});
};

/*jslint plusplus:true */
function Geomag(model) {
	'use strict';
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

var cof = `
    2010.0            WMM-2010        11/20/2009
  1  0  -29496.6       0.0       11.6        0.0
  1  1   -1586.3    4944.4       16.5      -25.9
  2  0   -2396.6       0.0      -12.1        0.0
  2  1    3026.1   -2707.7       -4.4      -22.5
  2  2    1668.6    -576.1        1.9      -11.8
  3  0    1340.1       0.0        0.4        0.0
  3  1   -2326.2    -160.2       -4.1        7.3
  3  2    1231.9     251.9       -2.9       -3.9
  3  3     634.0    -536.6       -7.7       -2.6
  4  0     912.6       0.0       -1.8        0.0
  4  1     808.9     286.4        2.3        1.1
  4  2     166.7    -211.2       -8.7        2.7
  4  3    -357.1     164.3        4.6        3.9
  4  4      89.4    -309.1       -2.1       -0.8
  5  0    -230.9       0.0       -1.0        0.0
  5  1     357.2      44.6        0.6        0.4
  5  2     200.3     188.9       -1.8        1.8
  5  3    -141.1    -118.2       -1.0        1.2
  5  4    -163.0       0.0        0.9        4.0
  5  5      -7.8     100.9        1.0       -0.6
  6  0      72.8       0.0       -0.2        0.0
  6  1      68.6     -20.8       -0.2       -0.2
  6  2      76.0      44.1       -0.1       -2.1
  6  3    -141.4      61.5        2.0       -0.4
  6  4     -22.8     -66.3       -1.7       -0.6
  6  5      13.2       3.1       -0.3        0.5
  6  6     -77.9      55.0        1.7        0.9
  7  0      80.5       0.0        0.1        0.0
  7  1     -75.1     -57.9       -0.1        0.7
  7  2      -4.7     -21.1       -0.6        0.3
  7  3      45.3       6.5        1.3       -0.1
  7  4      13.9      24.9        0.4       -0.1
  7  5      10.4       7.0        0.3       -0.8
  7  6       1.7     -27.7       -0.7       -0.3
  7  7       4.9      -3.3        0.6        0.3
  8  0      24.4       0.0       -0.1        0.0
  8  1       8.1      11.0        0.1       -0.1
  8  2     -14.5     -20.0       -0.6        0.2
  8  3      -5.6      11.9        0.2        0.4
  8  4     -19.3     -17.4       -0.2        0.4
  8  5      11.5      16.7        0.3        0.1
  8  6      10.9       7.0        0.3       -0.1
  8  7     -14.1     -10.8       -0.6        0.4
  8  8      -3.7       1.7        0.2        0.3
  9  0       5.4       0.0       -0.0        0.0
  9  1       9.4     -20.5       -0.1       -0.0
  9  2       3.4      11.5        0.0       -0.2
  9  3      -5.2      12.8        0.3        0.0
  9  4       3.1      -7.2       -0.4       -0.1
  9  5     -12.4      -7.4       -0.3        0.1
  9  6      -0.7       8.0        0.1       -0.0
  9  7       8.4       2.1       -0.1       -0.2
  9  8      -8.5      -6.1       -0.4        0.3
  9  9     -10.1       7.0       -0.2        0.2
 10  0      -2.0       0.0        0.0        0.0
 10  1      -6.3       2.8       -0.0        0.1
 10  2       0.9      -0.1       -0.1       -0.1
 10  3      -1.1       4.7        0.2        0.0
 10  4      -0.2       4.4       -0.0       -0.1
 10  5       2.5      -7.2       -0.1       -0.1
 10  6      -0.3      -1.0       -0.2       -0.0
 10  7       2.2      -3.9        0.0       -0.1
 10  8       3.1      -2.0       -0.1       -0.2
 10  9      -1.0      -2.0       -0.2        0.0
 10 10      -2.8      -8.3       -0.2       -0.1
 11  0       3.0       0.0        0.0        0.0
 11  1      -1.5       0.2        0.0       -0.0
 11  2      -2.1       1.7       -0.0        0.1
 11  3       1.7      -0.6        0.1        0.0
 11  4      -0.5      -1.8       -0.0        0.1
 11  5       0.5       0.9        0.0        0.0
 11  6      -0.8      -0.4       -0.0        0.1
 11  7       0.4      -2.5       -0.0        0.0
 11  8       1.8      -1.3       -0.0       -0.1
 11  9       0.1      -2.1        0.0       -0.1
 11 10       0.7      -1.9       -0.1       -0.0
 11 11       3.8      -1.8       -0.0       -0.1
 12  0      -2.2       0.0       -0.0        0.0
 12  1      -0.2      -0.9        0.0       -0.0
 12  2       0.3       0.3        0.1        0.0
 12  3       1.0       2.1        0.1       -0.0
 12  4      -0.6      -2.5       -0.1        0.0
 12  5       0.9       0.5       -0.0       -0.0
 12  6      -0.1       0.6        0.0        0.1
 12  7       0.5      -0.0        0.0        0.0
 12  8      -0.4       0.1       -0.0        0.0
 12  9      -0.4       0.3        0.0       -0.0
 12 10       0.2      -0.9        0.0       -0.0
 12 11      -0.8      -0.2       -0.1        0.0
 12 12       0.0       0.9        0.1        0.0
999999999999999999999999999999999999999999999999
999999999999999999999999999999999999999999999999
`;
var geoMag = new Geomag(cof).mag;
// var geoMag = newGeomag.mag;

export {
	chkLayer,
	colsToHash,
	getAngleDist,
	geoMag,
	sendExcel,
	sendVectorFile,
	createVectorLayer,
    sendReport,
	getReportsCount,
    getLayersIds,
    getLayersParams,
    selectFeaturesWithDrawing,
    loadFeatures,
	loadQuadrantValues,
    saveState,
    getState,
    chkTask,
	modifyVectorObjects
};