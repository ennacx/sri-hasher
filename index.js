/**
 * An object defining the templates for embedding external resources (JavaScript, CSS, WASM) into a web page.
 *
 * Properties:
 * - `js`: Defines the template for JavaScript resources, including attributes for source, integrity, and crossorigin.
 * - `css`: Defines the template for CSS resources, including attributes for source, integrity, and crossorigin.
 *
 * Each template uses placeholders (`{{source}}`, `{{sri}}`) for dynamic values to be replaced at runtime.
 */
const EXT_MASTER = {
	js: {
		tag: '<script src="{{source}}" integrity="{{sri}}" crossorigin="anonymous"></script>'
	},
	css: {
		tag: '<link rel="stylesheet" href="{{source}}" integrity="{{sri}}" crossorigin="anonymous">'
	}
};

/**
 * A constant that holds an array of strings representing the allowed file extensions.
 *
 * The `ALLOWED_EXTENSIONS` variable is derived from the keys of the `EXT_MASTER` object.
 * Each key in `EXT_MASTER` represents a file extension that is permitted for use.
 */
const ALLOWED_EXTENSIONS = Object.keys(EXT_MASTER);

/**
 * Represents an object containing Subresource Integrity (SRI) information.
 * This structure is used to manage SRI values, SRI tags, and related file extensions.
 *
 * @typedef {Object} sriSet
 * @property {string|undefined} sri - The Subresource Integrity hash value. Typically used for verifying resource integrity.
 * @property {string|undefined} sriTag - The HTML tag or identifier associated with the SRI, used to apply the integrity attribute to a resource.
 * @property {string|undefined} extension - The file extension associated with the resource, used for identifying specific file types.
 */
const sriSet = {
	sri: undefined,
	sriTag: undefined,
	extension: undefined
};

/**
 * An object that represents validation settings and properties.
 *
 * @property {boolean} isValid - Indicates whether the validation has passed or not. Defaults to false.
 * @property {string|undefined} extension - Represents the file extension or additional information for validation. Can be undefined if not specified.
 */
const validationSet = {
	isValid: false,
	extension: undefined
};

/**
 * Initializes the `sriSet` object by setting all its properties to `undefined`.
 * This method iterates over each property of the `sriSet` object and resets its value.
 *
 * @return {void} Does not return a value.
 */
function initSriSet() {
	for(const key in sriSet){
		sriSet[key] = undefined;
	}
}

/**
 * Extracts the file extension from the given target, which can be a string or a URL object.
 *
 * @param {string | URL} target - The target from which to extract the file extension. This can be a string representing a file path, or a URL object.
 * @return {string} The file extension if found (in lowercase), or an empty string if no valid extension is present.
 */
function getExtension(target) {

	/**
	 * Extracts and returns the extension part of a given string, typically used to retrieve file extensions.
	 * If the input string does not contain a period (.), an empty string is returned.
	 *
	 * @param {string} str - The input string from which the extension is to be extracted.
	 * @returns {string} The extracted extension in lowercase, or an empty string if no extension exists.
	 */
	const yieldExt = (str) => {
		const s = str ?? '';
		if(!s.includes('.')){
			return '';
		}

		return s.split('.').pop().toLowerCase();
	}

	if(target instanceof URL){
		const path = target.pathname;
		const queries = target.searchParams;
		const last = path.split('/').pop();
		if(!last){
			return '';
		} else if(last.includes('.')){
			// pathname優先で`/download?file=lib.js`のようにGETクエリにつかない場合
			const fromPath = yieldExt(last);
			if(fromPath && fromPath !== path.toLowerCase()){
				return fromPath;
			}
		} else{
			// クエリの許可キー名から取得を試みる
			const allowedKeys = ['file', 'filename'];

			let candidate;
			for(const k of allowedKeys){
				candidate = queries.get(k);
				if(candidate){
					break;
				}
			}

			if(candidate){
				return yieldExt(candidate);
			}
		}

		return '';
	} else if(typeof target === 'string'){
		return yieldExt(target);
	}

	return '';
}

/**
 * Validates a given URL and checks for its protocol and allowed extensions.
 *
 * @param {string} u - The URL string to be validated.
 * @return {Object} An object containing the validation results:
 *  - isValid: A boolean indicating whether the URL is valid.
 *  - extension: The file extension of the URL, if valid.
 */
function validateURL(u) {
	const ret = structuredClone(validationSet);

	try {
		const url = new URL(u);
		if(!url.protocol.match(/^https?:$/)){
			ret.isValid = false;
		} else{
			const ext = getExtension(url);
			if(!ALLOWED_EXTENSIONS.includes(ext)){
				ret.isValid = false;

				return ret;
			}

			ret.isValid = true;
			ret.extension = ext;
		}
	} catch(e){
		console.error(e);

		ret.isValid = false;
	}

	return ret;
}

/**
 * Fetches the content from the provided URL and returns it as an ArrayBuffer.
 *
 * @param {string} url The URL to fetch content from.
 * @return {Promise<ArrayBuffer>} A promise that resolves to the content in ArrayBuffer format.
 * @throws {Error} If the fetch operation fails or the response is not successful.
 */
async function fetchContent(url) {
	const response = await fetch(url);

	if(!response.ok){
		throw new Error(`Fetch failed: ${response.status} - ${response.statusText}`);
	}

	return await response.arrayBuffer();
}

/**
 * Probes the given URL for CORS (Cross-Origin Resource Sharing) accessibility and readability.
 * It attempts to send HEAD and GET requests with CORS mode, and checks the response status,
 * content type, and other details to determine if the resource is readable.
 *
 * @param {string} url - The URL to be probed for CORS readability.
 * @return {Promise<Object>} A promise that resolves to an object containing:
 * - `readable` (boolean): Whether the URL is accessible and readable.
 * - `status` (number): The HTTP status code of the response (only when successful).
 * - `contentType` (string): The content type of the response (only when successful).
 * - `reason` (string): The error message in case the URL is not readable (only when unsuccessful).
 * - `error` (Error): The error object in case the URL is not readable (only when unsuccessful).
 */
async function probeCorsReadable(url) {
	const tryFetch = async (method) => await fetch(url, { method, mode: 'cors', cache: 'no-store' });

	try {
		let res;
		try {
			res = await tryFetch('HEAD');
		} catch {
			res = await tryFetch('GET');
		}

		return { readable: true, status: res.status, contentType: res.headers.get('content-type') };
	} catch(e){
		return { readable: false, reason: e.message, error: e };
	}
}

/**
 * Validates a file object to ensure it meets certain criteria.
 *
 * @param {Object} file - The file object to be validated.
 * @param {string} file.name - The name of the file, used to check its extension.
 * @return {Object} An object containing the validation result:
 * - `isValid` {boolean} - Indicates if the file is valid.
 * - `extension` {string} [optional] - The file extension if the file is valid.
 */
function validateFile(file) {
	const ret = structuredClone(validationSet);

	if(!file || !file.name){
		ret.isValid = false;

		return ret;
	}

	const ext = getExtension(file.name);
	if(!ALLOWED_EXTENSIONS.includes(ext)){
		ret.isValid = false;

		return ret;
	}

	ret.isValid = true;
	ret.extension = ext;

	return ret;
}

/**
 * Converts a given hashing algorithm to its corresponding Subresource Integrity (SRI) prefix.
 *
 * @param {string} algo - The hashing algorithm name (e.g., 'SHA-256', 'SHA-384', 'SHA-512') to be converted.
 * @return {string} The SRI prefix in the format 'shaXXX-' where XXX represents the bit length of the algorithm.
 */
function algoToSriPrefix(algo) {
	const algoBit = algo.replace(/^SHA\-(256|384|512)$/i, '$1');

	return `sha${algoBit}-`;
}

/**
 * Converts an ArrayBuffer into a Base64-encoded string.
 *
 * @param {ArrayBuffer} buf - The ArrayBuffer to convert.
 * @return {string} The Base64-encoded representation of the input ArrayBuffer.
 */
function arrayBufferToBase64(buf) {
	const bytes = new Uint8Array(buf);
	const chunk = 0x8000;

	let bin = '';
	for(let i = 0; i < bytes.length; i += chunk){
		bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}

	return btoa(bin);
}

/**
 * Generates a Subresource Integrity (SRI) string from an ArrayBuffer using the specified hashing algorithm.
 *
 * @param {ArrayBuffer} arrayBuffer - The input ArrayBuffer to generate the SRI string from.
 * @param {string} algo - The hashing algorithm to use (e.g., "SHA-256", "SHA-384", "SHA-512").
 * @return {Promise<string>} A promise that resolves to the generated SRI string.
 */
async function sriFromArrayBuffer(arrayBuffer, algo) {
	const digest = await crypto.subtle.digest(algo, arrayBuffer);
	const base64 = arrayBufferToBase64(digest);

	return algoToSriPrefix(algo) + base64;
}

/**
 * Generates an HTML tag string based on the provided source, SRI (Subresource Integrity) hash, and file extension.
 *
 * @param {string} source - The URL or path of the resource being referenced in the HTML tag.
 * @param {string} sri - The Subresource Integrity hash for the resource to ensure secure loading.
 * @return {string} The appropriately constructed HTML tag string for the given file type or an error if the extension is unknown.
 * @throws {Error} Throws an error if the file extension is not supported.
 */
function makeHtmlTag(source, sri) {
	if(!EXT_MASTER[sriSet.extension]){
		throw new Error(`Unknown extension: ${sriSet.extension}`);
	}

	const tag = EXT_MASTER[sriSet.extension].tag;

	return tag.replace('{{source}}', source).replace('{{sri}}', sri);
}

/**
 * Copies the provided text to the system clipboard. Uses the Clipboard API when available
 * and falls back to a manual method for environments without secure context capabilities.
 *
 * @param {string} text - The text string to be copied to the clipboard.
 * @return {Promise<void>} A promise that resolves when the text has been successfully copied to the clipboard.
 */
function copyToClipboard(text) {
	if(navigator.clipboard && window.isSecureContext){
		return navigator.clipboard.writeText(text);
	} else{
		// フォールバック処理
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed'; // iOS対策
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		try {
			document.execCommand('copy');
		} catch(e){
			console.error("クリップボードコピー失敗:", e);
			alert("コピーできませんでした。手動で選択してください。");
		} finally{
			document.body.removeChild(textarea);
		}

		return Promise.resolve();
	}
}

$(() => {
	const $errorAlert = $('#error-alert');
	const $resultCard = $('#result');
	const $urlForm    = $('input[name="url"]');
	const $uploadForm = $('input[name="upload-file"]')[0];

	// 初回モードはCDN
	let mode = 'fetch';
	$('ul#selectMode').find(`#mode-${mode}-tab`).addClass('active');
	$('div#selectModeContent').find(`#mode-${mode}-tab-pane`).addClass('show active');

	$('input[name="upload-file"]').attr('accept', ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(','));
	$('p.allow-ext > span.ext').html(`<span class="mono-font">${ALLOWED_EXTENSIONS.join(',')}</span>`);

	const showAlert = (msg) => {
		$errorAlert.text(msg);
		$errorAlert.show();
	};
	const hideAlert = () => {
		$errorAlert.hide();
		$errorAlert.empty();
	};

	/*
	 * タブ切り替えによるモード変更
	 */
	$('#selectMode button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e){
		const $active   = $(e.target);
		const $previous = $(e.relatedTarget);

		const id = $active.attr('id');
		const activeMode = id.replace(/^mode-(.+)-tab$/, '$1');
		if(mode !== activeMode){
			mode = activeMode;
		}
	});

	/*
	 * ハッシュ化ボタン押下
	 */
	$('button[name="generate-hash"]').click(async () => {
		// 結果オブジェクトの初期化
		initSriSet();

		// 結果コンテンツの隠蔽
		hideAlert();
		$resultCard.hide();

		const url     = $urlForm.val().trim();
		const file    = $uploadForm.files[0] ?? null;
		const sriHash = $('select[name="sri-hash"] option:selected').val();

		let errMsg;

		// CDN URL
		if(mode === 'fetch'){
			if(!url){
				errMsg = 'URL is required';
			} else{
				const validate = validateURL(url);
				if(!validate.isValid){
					errMsg = 'Invalid URL';
				} else{
					// フェッチとCORSチェック
					const proveRes = await probeCorsReadable(url);
					if(!proveRes.readable){
						errMsg = 'May not be found or violates CORS policy. Please check URL or download the file and try uploading it.';

						$('button#mode-upload-tab').click();
					} else{
						sriSet.extension = validate.extension;
					}
				}
			}
		}
		// アップロード
		else if(mode === 'upload'){
			if(!file || file.size === 0){
				errMsg = 'Upload file is required';
			} else{
				const validate = validateFile(file);
				if(!validate.isValid){
					errMsg = 'Invalid upload file type';
				} else{
					sriSet.extension = validate.extension;
				}
			}
		}
		// 不正
		else{
			showAlert('URL or file is required');

			return false;
		}

		if(errMsg){
			showAlert(errMsg);

			return false;
		}

		try {
			let resBuffer;
			let src;

			if(mode === 'fetch'){
				resBuffer = await fetchContent(url);
				src       = url;
			} else if(mode === 'upload'){
				resBuffer = await file.arrayBuffer();
				src       = file.name;
			}

			sriSet.sri    = await sriFromArrayBuffer(resBuffer, sriHash);
			sriSet.sriTag = makeHtmlTag(src, sriSet.sri);

			$('#sri > pre').text(sriSet.sri);
			$('#sri-tag > pre').text(sriSet.sriTag);

			$resultCard.show();
		} catch(e){
			console.error(e);

			showAlert(e.message);
		}
	});

	const copyBtnTimeoutIds = {};
	$('button.copy-btn').click(function(){
		const $this = $(this);
		const attribute = $this.attr('id').replace(/^copy-/, '');

		// 再度ボタンが有効化になるまでの時間 (ms)
		const enableDuration = 3000;

		let text;
		if(attribute === 'sri'){
			text = sriSet.sri;
		} else if(attribute === 'sri-tag'){
			text = sriSet.sriTag;
		} else{
			throw new Error(`Invalid attribute: ${attribute}`);
		}

		copyToClipboard(text)
			.then(() => {
				const btnLabelHtml = $this.html();
				const $iFind = () => $this.find('i');

				$this.prop('disabled', true);
				$this.html('<i class="bi bi-check2"></i> Copied!');
				$iFind().addClass('btn-fade');

				// 1秒後にフェードアウト開始
				setTimeout(() => {
					$iFind().addClass('fade-out');
				}, enableDuration - 300); // 残り0.3秒でフェード開始

				// 完全に消えたらリセット
				copyBtnTimeoutIds[attribute] = setTimeout(() => {
					$this.html(btnLabelHtml);
					$this.prop('disabled', false);

					copyBtnTimeoutIds[attribute] = null;
				}, enableDuration);
			})
			.catch((e) => {
				console.error(e);

				window.alert('Copy to clipboard failed. Please try again later.');
			})
		;
	});
})