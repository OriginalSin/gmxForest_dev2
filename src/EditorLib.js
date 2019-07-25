import * as Config from './Config.js';

const serverBase = window.serverBase || '//maps.kosmosnimki.ru/';
const ext = {
	_gtxt: window._gtxt,
	// _mapHelper: window._mapHelper,
	_queryMapLayers: window._queryMapLayers,
	nsGmx: window.nsGmx
};

const _getParentByClassName = (node, name) => {
	while(node) {
		if (node.classList && node.classList.contains(name)) {
			return node;
		}
		node = node.parentNode;
	}
	return null;
};

const _getFirstChildByClassName = (node, name) => {
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

const _chkHiddenFields = (key, str, node) => {
	var prnt = _getParentByClassName(node, 'edit-obj'),
		pars = Config.fields[key];

	pars.onValue[str].show.forEach((it) => {
		let pn = _getFirstChildByClassName(prnt, 'field-name-' + it);
		if (pn && pn.classList) { pn.classList.remove('hidden'); }
	});
	pars.onValue[str].hide.forEach((it) => {
		let pn = _getFirstChildByClassName(prnt, 'field-name-' + it);
		if (pn && pn.classList) { pn.classList.add('hidden'); }
	});
};

const _getFieldsTitle = (params) => {
	var fields = params.fields || [],
		dFields = params.dFields || {},
		hashCols = params.hashCols || {},
		kvKey = hashCols['Квартал'] ? 'Квартал' : (hashCols.kv ? 'kv' : 'kvartal'),
		skipKeys = fields.reduce((a, v) => { a[v.name] = true; return a; }, {});

	Object.keys(hashCols).map(fk => {
		if (fk !== 'geomixergeojson' && fk !== 'gmx_id' && !(fk in skipKeys)) {
			var keyHash = Config.fields[fk],
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
				fields.push({ name: fk, hide: true });

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
			fields.push(out);
		}
	});
	return fields;
};

const editObject = (layerId, objectId, params) => {
	params.fields = _getFieldsTitle(params);

	let editControl = new window.nsGmx.EditObjectControl(layerId, objectId, params);
	editControl.initPromise.then(function(pNode) {
		 // console.log('editObject1', pNode, editControl);
		_chkHiddenFields('report_t', 'ИЛ', pNode);
		if (pNode && params.del) {
			let node = pNode.getElementsByClassName('obj-edit-canvas')[0];
			if (node) { pNode.parentNode.style.height = node.style.height = 'auto'; }
		}

	});
	return editControl;
};

const saveLayer = (properties) => {
	let layerProperties = new nsGmx.LayerProperties();
	layerProperties.initFromViewer('Vector', null, properties);

	return layerProperties.save().then(function(response) {
		if (response.Result) {
			let props = response.Result.properties;
			window._layersTree.addLayerToTree(props.name);
			setTimeout(ext._queryMapLayers.saveMap, 1000);
			return props;
		}
	});
};

const createLayer = (flag) => {
	let prnt = nsGmx.Utils._div(null, [['attr','id','new' + 'Vector' + 'Layer'], ['css', 'height', '100%']]),
		dialogDiv = nsGmx.Utils.showDialog(flag ? 'Создать слой квартальной сети' : 'Создать группу делянок', prnt, 340, 340, false, false);

	return nsGmx.createLayerEditor(false, 'Vector', prnt, {}, {
		doneCallback: function(res) {
			res.then(json => {
				ext._queryMapLayers.saveMap();
			});
			ext.nsGmx.Utils.removeDialog(dialogDiv);
		}
	});

};

const editLayer = (layerId) => {
	window._mapHelper.createLayerEditor(layerId, 'Vector', undefined, nsGmx.gmxMap.layersByID[layerId].getGmxProperties());
};

export {
	editLayer,
	createLayer,
	editObject,
	saveLayer
};