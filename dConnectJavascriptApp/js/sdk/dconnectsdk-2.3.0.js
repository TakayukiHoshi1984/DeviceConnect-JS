/**
 @preserve Device Connect SDK Library v2.3.0
 Copyright (c) 2020 NTT DOCOMO,INC.
 Released under the MIT license
 http://opensource.org/licenses/mit-license.php
 */

/**
 * @file
 */

/**
 * @class dConnectSDK
 * @constructor
 * @classdesc Device Connect SDK
 * @param {{sslEnabled: boolean,
 *          uriSchemeName: boolean,
 *          host: string,
 *          port: int,
 *          extendedOrigin: string,
 *          isEnabledAntiSpoofing: boolean}} settings リクエストの設定値.以下の値が設定できる.値は省略可能.
 * @example
 * const sdk = new dConnectSDK({
 *  sslEnabled: false,
 *  uriSchemeName: 'gotapi',
 *  host: '192.168.0.24',
 *  port: 4035,
 *  extendedOrigin: 'http://localhost:4035/',
 *  isEnabledAntiSpoofing: false
 * });
 *
 * sslEnabled: HTTPおよびWebSocket通信でSSLを使用するかどうかを指定するフラグ.
 * uriSchemeName: Manager起動用URIスキームの名前.
 * host: ホスト名.
 * port: ポート番号.
 * extendedOrigin: ハイブリッドアプリとしてのオリジン.
 * isEnabledAntiSpoofing: HMACによるサーバ認証を行うかどうかのフラグ.
 * appName: LocalOAuth用のアプリケーション名.
 * scopes: LocalOAuthで許可を得たいプロファイル名の配列.
 */
let dConnectSDK = function(settings) {

  /**
   * HTTPおよびWebSocket通信でSSLを使用するかどうかを指定するフラグ.
   * @private
   * @type {Boolean}
   * @default false
   * @see setSSLEnabled
   */
  this.sslEnabled = (settings && Boolean(settings.sslEnabled));
  /**
   * Manager起動用URIスキームの名前.
   * @private
   * @type {String}
   * @default gotapi
   * @see setURISchemeName
   */
  this.uriSchemeName = (settings && settings.api) ? settings.api : 'gotapi';
  /**
   * ホスト名.
   * @private
   * @type {String}
   * @default localhost
   * @see setHost
   */
  this.host = (settings && settings.host) ? settings.host : 'localhost';

  /**
   * ポート番号.
   * @private
   * @type {String}
   * @default 4035
   * @see setPort
   */
  this.port = (settings && settings.port >= 0 && settings.port <= 65535) ? settings.port : 4035;
  /**
   * ハイブリッドアプリとしてのオリジン.
   * @private
   * @type {String}
   * @see setExtendedOrigin
   */
  this.extendedOrigin = (settings && settings.extendedOrigin) ? settings.extendedOrigin : location.origin;
  /**
   * イベント通知用のリスナーを格納するオブジェクト.
   * @type {Object}
   * @private
   * @see addEventListener
   * @see removeEventListener
   */
  this.eventListener = {};
  this.websocketListener = {}
  /**
   * WebSocketのインスタンス.
   * @type {Object}
   * @private
   */
  this.websocket;

  /**
   * WebSocketが開いているかどうかを示すフラグ.
   *
   * 注意: 開いている場合でも、isEstablishedWebSocketがfalseの場合は、
   * イベントを受信できない.
   * @type {Boolean}
   * @private
   */
  this.isOpenedWebSocket = false;
  /**
   * WebSocketでイベントを受信可能な状態であるかどうかを示すフラグ.
   * @type {Boolean}
   * @private
   */
  this.isEstablishedWebSocket = false;
  /**
   * WebSocketを再接続するタイマー.
   * @type {Object}
   * @private
   */
  this.reconnectingTimerId;

  /**
   * HMACによるサーバ認証を行うかどうかのフラグ.
   * @type {Boolean}
   * @private
   */
  this._isEnabledAntiSpoofing = (settings && Boolean(settings.isEnabledAntiSpoofing));

  /**
   * アプリケーションからサーバの起動要求を送信したかどうかのフラグ.
   * @type {Boolean}
   * @private
   */
  this._isStartedManager = false;

  /**
   * Device Connect Managerの起動通知を受信するリスナー.
   */
  this._launchListener = function() {
  };

  /**
   * 現在設定されているHMAC生成キー.
   * 空文字の場合はレスポンスのHMACを検証しない.
   */
  this._currentHmacKey = '';

  /**
  * accessTokenとclientId、appNameとscopesを保存するDBを管理するオブジェクト.
  * 例えば、localStorageが設定される.
  */
  this.storage = {};

  /**
  * SDK側が保持するデータをJSON形式で持つオブジェクト.
  */
  this.data = '';

  /**
  * LocalOAuth用のアプリ名.
  * @type {String}
  * @private
  */
  this.appName = (settings && settings.appName) ? settings.appName : 'dConnectSDK JavaScript';

  /**
  * LocalOAuthで許可を与えるプロファイル名の配列.
  * @type {Array}
  * @private
  */
  this.scopes = (settings && settings.scopes) ? settings.scopes : dConnectSDK.INIT_SCOPES;

  /**
  * 循環参照を防ぐためのself
  */
  let self = this;

  // どのストレージを使用するか
  if (localStorage) {
    self.storage = localStorage;
  } else if (document.cookie) {
    self.storage = document.cookie;
  } else {
    self.storage = {};
  }
  self.data = JSON.parse(localStorage[self.appName] || '{}');

  /**
   * scopesにプロファイルを追加する.
   * @memberOf dConnectSDK
   */
  this.appendScope = function(uri) {
    let elm = document.createElement('a');
    elm.href = uri;

    let p = elm.pathname.split('/');
    if (p.length < 3) {
      return;
    }
    if (!this.containsScope(p[2])) {
      this.scopes.push(p[2]);
    }
  }
  /**
   * scopesにすでに指定したプロファイルが追加されているか.
   * @memberOf dConnectSDK
   * @return {Boolean} true:すでにscopesに指定したプロファイルが追加されている.<br>
   *                   false: プロファイルが追加されていない.
   */
  this.containsScope = function(profile) {
    for (let i = 0; i < this.scopes.length; i++) {
      if (this.scopes[i] == profile) {
        return true;
      }
    }
    return false;
  }
  /**
   * Publicなクラスとしては非推奨.
   * URIを作成するためのユーティリティクラス。
   * コンストラクタの引数には、オブジェクトを指定することもできる.
   * <p>
   * ホスト名やポート番号は、省略された場合にはdConnectSDK.setHost()、
   * dConnectSDK.setPort()で指定された値が設定される。
   * </p>
   * @memberOf dConnectSDK
   * @class
   * @private
   * @example
   * let builder = new dConnect.URIBuilder();
   * builder.setProfile('battery');
   * builder.setAttribute('level');
   * builder.setServiceId(serviceId);
   * builder.setAccessToken(accessToken);
   * builder.addParameter('key', 'value');
   *
   * const uri = builder.build();
   *
   * uriは'http://localhost:4035/gotapi/battery/level?serviceId=serviceId&accessToken=accessToken&key=value'に変換される。
   */
  let URIBuilder = function(request) {
    this.scheme = self.sslEnabled ? 'https' : 'http';
    this.host = self.host;
    this.port = self.port;
    if (request && request.api) {
      this.api = request.api;
    } else {
      this.api = 'gotapi';
    }

    if (request && request.profile) {
      this.profile = request.profile;
    } else {
      this.profile = null;
    }
    if (request && request.interface) {
      this.interface = request.interface;
    } else {
      this.interface = null;
    }
    if (request && request.attribute) {
      this.attribute = request.attribute;
    } else {
      this.attribute = null;
    }
    self.data = JSON.parse(localStorage[self.appName] || '{}');
    if (self.data['accessToken']) {
      this.params = {
        accessToken: self.data['accessToken']
      };
    } else {
      this.params = {};
    }
    if (request) {
      for (let key in request) {
          if (key === 'api' || key === 'profile' || key === 'inter' || key === 'attribute') {
            continue;
          }
          this.params[key] = request[key];
      }
    }
  };
  this.URIBuilder = URIBuilder;
  /**
   * スキーム名を設定する。
   * <p>
   * デフォルトでは、dConnectSDK.isSSLEnabled()が真の場合にhttps、そうでない場合にはhttpが設定されている。<br/>
   * </p>
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} scheme スキーム名
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setScheme = function(scheme) {
    this.scheme = scheme;
    return this;
  };
  /**
   * スキーマ名を取得する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} スキーマ名
   */
   URIBuilder.prototype.getScheme = function() {
    return this.scheme;
  };

  /**
   * APIを取得する。
   * デフォルトではgotapiが指定される。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} API
   */
  URIBuilder.prototype.getApi = function() {
    return this.api;
  };

  /**
   * APIを設定する。
   * <p>
   * デフォルトではgotapiが指定される。
   * </p>
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} api API
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setApi = function(api) {
    this.api = api;
    return this;
  }
  /**
   * ホスト名を設定する。
   * <p>
   * デフォルトでは、dConnectSDK.setHost()で設定された値が設定される。<br/>
   * 何も設定していない場合にはlocalhostが設定される。
   * </p>
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} host ホスト名
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setHost = function(host) {
    this.host = host;
    return this;
  };
  /**
   * ホスト名を取得する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} ホスト名
   */
  URIBuilder.prototype.getHost = function() {
    return this.host;
  };

  /**
   * ポート番号を設定する。
   * <p>
   * デフォルトでは、dConnectSDK.setPort()で設定された値が設定される。<br/>
   * 何も設定していない場合には4035が設定される。
   * </p>
   * @memberOf dConnectSDK.URIBuilder
   * @param {Number} port ポート番号
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setPort = function(port) {
    this.port = port;
    return this;
  };

  /**
   * ポート番号を取得する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {Number} ポート番号
   */
  URIBuilder.prototype.getPort = function() {
    return this.port;
  };

  /**
   * プロファイル名を設定する。
   * <p>
   * Device Connectで定義してあるプロファイル名を指定すること。<br/>
   * <ul>
   * <li>servicediscovery</li>
   * <li>system</li>
   * <li>battery</li>
   * <li>mediastreamrecording</li>
   * </ul>
   * などなど。
   * </p>
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} profile プロファイル名
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setProfile = function(profile)  {
    this.profile = profile;
    return this;
  };

  /**
   * プロファイル名を取得する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} プロファイル名
   */
  URIBuilder.prototype.getProfile = function() {
    return this.profile;
  };

  /**
   * インターフェース名を設定する。
   *
   * @param {String} interface インターフェース名
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setInterface = function(inter) {
    this.interface = inter;
    return this;
  };

  /**
   * インターフェース名を取得する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} インターフェース名
   */
  URIBuilder.prototype.getInterface = function() {
    return this.interface;
  };

  /**
   * アトリビュート名を設定する。
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} attribute アトリビュート名
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setAttribute = function(attribute) {
    this.attribute = attribute;
    return this;
  };

  /**
   * アトリビュート名を取得する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} アトリビュート名
   */
  URIBuilder.prototype.getAttribute = function() {
    return this.attribute;
  };

  /**
   * サービスIDを設定する。
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} serviceId サービスID
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setServiceId = function(serviceId) {
    this.params['serviceId'] = serviceId;
    return this;
  };

  /**
   * アクセストークンを設定する。
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} accessToken アクセストークン
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.setAccessToken = function(accessToken) {
    this.params['accessToken'] = accessToken;
    return this;
  };

  /**
   * セッションキーを設定する。
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} sessionKey セッションキー
   * @return {URIBuilder} 自分自身のインスタンス
   * @deprecated
   */
  URIBuilder.prototype.setSessionKey = function(sessionKey) {
    this.params['sessionKey'] = sessionKey;
    return this;
  };

  /**
   * パラメータを追加する。
   * @memberOf dConnectSDK.URIBuilder
   * @param {String} key キー
   * @param {Object.<String, String>} value バリュー
   * @return {URIBuilder} 自分自身のインスタンス
   */
  URIBuilder.prototype.addParameter = function(key, value) {
    this.params[key] = value;
    return this;
  };

  /**
   * URIに変換する。
   * @memberOf dConnectSDK.URIBuilder
   * @return {String} uri
   */
  URIBuilder.prototype.build = function() {
    let uri = this.scheme + '://' + this.host + ':' + this.port;
    if (this.api) {
      uri += '/' + encodeURIComponent(this.api);
    }
    if (this.profile) {
      uri += '/' + encodeURIComponent(this.profile);
    }
    if (this.inter) {
      uri += '/' + encodeURIComponent(this.inter);
    }
    if (this.attribute) {
      uri += '/' + encodeURIComponent(this.attribute);
    }
    if (this.params) {
      let p = '';
      let param;
      for (let key in this.params) {
          param = this.params[key]
          if (param !== null && param !== undefined) {
            p += (p.length == 0) ? '?' : '&';
            p += encodeURIComponent(key) + '=' + encodeURIComponent(param);
          }
      }
      uri += p;
    }
    return uri;
  };


  /**
   * カスタムURIスキームを作成するための抽象的なユーティリティクラス.
   * @private
   * @class
   */
  let AndroidURISchemeBuilder = function() {
    this.scheme = self.uriSchemeName;
    this.path = '';
    this.params = {};
  };
  this.AndroidURISchemeBuilder = AndroidURISchemeBuilder;
  /**
   * URIスキームのスキーム名を設定する.
   * @private
   * @return {URISchemeBuilder} 自分自身のインスタンス
   */
  AndroidURISchemeBuilder.prototype.setScheme = function(scheme) {
    this.scheme = scheme;
    return this;
  };

  /**
   * URIスキームのパスを設定する.
   * @private
   * @return {URISchemeBuilder} 自分自身のインスタンス
   */
  AndroidURISchemeBuilder.prototype.setPath = function(path) {
    this.path = path;
    return this;
  };

  /**
   * URIスキームにパラメータを追加する.
   * @private
   * @param key パラメータキー
   * @param value パラメータ値
   * @return {URISchemeBuilder} 自分自身のインスタンス
   */
  AndroidURISchemeBuilder.prototype.addParameter = function(key, value) {
    this.params[key] = value;
    return this;
  };

  /**
   * URIスキームを作成する.
   * @private
   * @return {String} URIスキームの文字列表現
   */
  AndroidURISchemeBuilder.prototype.build = function() {
    let urlScheme = 'intent://' + this.path + '#Intent;scheme=' +
                            this.scheme + ';';
    for (let key in this.params) {
      urlScheme += key + '=' + this.params[key] + ';';
    }
    urlScheme += 'end';
    return urlScheme;
  };



  /**
   * ランダムな16進文字列を生成する.
   * @private
   * @param {Number} byteSize 生成する文字列の長さ
   * @return ランダムな16進文字列
   */
  this.generateRandom = function(byteSize)  {
    let min = 0;   // 0x00
    let max = 255; // 0xff
    let bytes = [];

    for (let i = 0; i < byteSize; i++) {
      let random = (Math.floor(Math.random() *
                    (max - min + 1)) + min).toString(16);
      if (random.length < 2) {
        random = '0' + random;
      }
      bytes[i] = random.toString(16);
    }
    return bytes.join('');
  };

  /**
   * Device Connect Managerから受信したHMACを検証する.
   * @private
   * @param {String} nonce 使い捨て乱数
   * @param {String} hmac Device Connect Managerから受信したHMAC
   * @return 指定されたHMACが正常であればtrue、そうでない場合はfalse
   */
  this.checkHmac = function(nonce, hmac) {
    let hmacKey = this._currentHmacKey;
    if (hmacKey === '') {
      return true;
    }
    if (!hmac) {
      return false;
    }
    let shaObj = new jsSHA(nonce, 'HEX');
    let expectedHmac = shaObj.getHMAC(hmacKey, 'HEX', 'SHA-256', 'HEX');
    return hmac === expectedHmac;
  };

  /**
   * サーバからのレスポンス受信時にサーバの認証を行うかどうかを設定する.
   * @memberOf dConnectSDK
   * @param enable サーバの認証を行う場合はtrue、そうでない場合はfalse
   */
  this.setAntiSpoofing = function(enable) {
    this._isEnabledAntiSpoofing = enable;
  };

  /**
   * サーバからのレスポンス受信時にサーバの認証を行うかどうかのフラグを取得する.
   * @memberOf dConnectSDK
   * @return サーバの認証を行う場合はtrue、そうでない場合はfalse
   */
  this.isEnabledAntiSpoofing = function() {
    return this._isEnabledAntiSpoofing;
  };

  /**
   * Device Connect Managerの起動通知を受信するリスナーを設定する.
   * <p>
   * 注意: Device Connect Managerの起動はアプリケーションの表示状態が非表示から表示へ
   * 遷移したタイミングで確認される.
   * </p>
   * @memberOf dConnectSDK
   * @param listener リスナー
   */
  this.setLaunchListener = function(listener) {
    listener = listener || function() {
    };
    this._launchListener = listener;
  }

  /**
   * ブラウザがFirefoxかどうかを判定する.
   * @private
   * @returns ブラウザがFirefoxの場合はtrue、そうでない場合はfalse
   */
  this.isFirefox = function() {
    return (navigator.userAgent.indexOf("Firefox") != -1);
  }
  /**
   * 指定されたURIにリクエストパラメータを追加する.
   * @private
   * @param uri URI
   * @param key URIに追加するパラメータのキー
   * @param value URIに追加するパラメータの値
   * @return リクエストパラメータを追加されたURI文字列
   */
  this.addRequestParameter = function(uri, key, value) {
    let array = uri.split('?');
    let sep = (array.length == 2) ? '&' : '?';
    uri += sep + key + '=' + value;
    return uri;
  };

  /**
   * DeviceConnect用のエラーオブジェクトを生成する.
   * @private
   * @param {int} code エラーコード
   * @param {string} message エラーメッセージ
   * @return {object} エラーオブジェクト
   */
  this.makeErrorObject = function(code, message) {
    let e = {};
    e.errorCode = code;
    e.errorMessage = message;
    return e;
  }
  /**
   * HTTPおよびWebSocket通信でSSLを使用するかどうかを設定する.
   * <p>
   * デフォルト設定ではSSLは使用しない。
   * </p>
   * @memberOf dConnectSDK
   * @param {String} enabled SSLを使用する場合はtrue、使用しない場合はfalse
   */
  this.setSSLEnabled = function(enabled) {
    this.sslEnabled = enabled;
  }

  /**
   * HTTPおよびWebSocket通信でSSLを使用するかどうかを取得する.
   * <p>
   * デフォルト設定ではSSLは使用しない。
   * </p>
   * @memberOf dConnectSDK
   * @return SSLを使用する場合はtrue、使用しない場合はfalse
   */
  this.isSSLEnabled = function() {
    return this.sslEnabled;
  }

  /**
   * Manager起動用URIスキームの名前を設定する.
   * @memberOf dConnectSDK
   * @param {String} name Manager起動用URIスキームの名前
   */
  this.setURISchemeName = function(name) {
    this.uriSchemeName = name;
  };

  /**
   * ホスト名を設定する.
   * @memberOf dConnect
   * @param {String} h ホスト名
   */
  this.setHost = function(h) {
    this.host = h;
  };

  /**
   * オリジンを設定する.
   * ハイブリッドアプリとして動作させる場合には本メソッドでオリジンを設定する.
   * @memberOf dConnectSDK
   * @param {String} o オリジン
   */
  this.setExtendedOrigin = function(o) {
    this.extendedOrigin = o;
  };

  /**
   * ポート番号を設定する.
   * @memberOf dConnectSDK
   * @param {Number} p ポート番号
   */
  this.setPort = function(p) {
    this.port = p;
  };

  /**
   * ベースとなるドメイン名を取得する.
   * @memberOf dConnectSDK
   * @return {String} ドメイン名
   */
  this.getBaseDomain = function() {
    return 'http://' + host + ':' + port;
  };
  /**
   * アクセストークンを取得する.
   * @memberOf dConnectSDK
   * @return {String} アクセストークン
   */
  this.getAccessToken = function() {
    return this.data['accessToken'];
  };
  /**
   * オブジェクトの引数をURIBuilderに変換する.
   * @memberOf dConnectSDK
   * @return {object} パラメータ
   */
  this.converObjToUri = function(uri) {
    if (uri && uri instanceof Object) {
      let builder = new this.URIBuilder(uri);
      uri = builder.build();
    }
    return uri;
  }
  /**
   * Device Connect RESTful APIを実行する.
   * <p>
   + レスポンスの受信に成功した場合でも、サーバの認証に失敗した場合はエラーコールバックを実行する.
   * </p>
   * @memberOf dConnectSDK
   * @param {String} method メソッド
   * @param {Object} uri URI
   * @param {Object.<String, String>} header リクエストヘッダー。Key-Valueマップで渡す。
   * @param {} body コンテンツデータ
   * @return {Promise<object>}
   */
  this.sendRequest = (method, uri, header, body) => {
    uri = this.converObjToUri(uri);
    body = this.converObjToUri(body);
    return new Promise((resolve, reject) => {
      self.execute(method, uri, header, body)
        .then(result => {
            resolve(result);
        }).catch(error => {
          if (error.errorCode >= dConnectSDK.constants.errorCode.AUTHORIZATION
              && error.errorCode <= dConnectSDK.constants.errorCode.NOT_FOUND_CLIENT_ID) {
                // 呼ばれたURIのプロファイルが追加されているかを確認し、
                // 追加されていない場合は追加する。
                self.appendScope(uri);
                self.authorization(self.scopes, self.appName)
                .then(accessToken => {
                  // 古いアクセストークンを削除する
                  let newUri = uri.replace(/accessToken=(.*?)(&|$)/,"");
                  // 新しいアクセストークンを付加する
                  uri = self.addRequestParameter(uri, 'accessToken', accessToken);
                  // アクセストークンを保存する
                  self.data['accessToken'] = accessToken;
                  self.storage[self.appName] = JSON.stringify(self.data);
                  // もう一度リクエストを実行する
                  self.sendRequest(method, uri, header, body)
                    .then(result => {
                      resolve(result);
                    }).catch(e => {
                      reject(e);
                    });
                }).catch(e => {
                  reject(e);
                });
          } else {
            reject(this.makeErrorObject(dConnectSDK.constants.errorCode.ACCESS_FAILED,
              'Failed to access to the server.'));
          }
        });
    });
  }

  /**
   * REST API呼び出し.
   * @see {@link sendRequest}
   * @memberOf dConnectSDK
   * @param {String} method HTTPメソッド
   * @param {String} uri URI
   * @param {Object.<String, String>} header HTTPリクエストヘッダー。Key-Valueマップで渡す。
   * @param {} body コンテンツデータ
   * @return {Promise<object>}
   */
  this.execute = (method, uri, header, body) => {
    let hmacKey = this._currentHmacKey;
    let nonce = hmacKey !== '' ? this.generateRandom(this.NONCE_BYTES) : null;
    if (nonce !== null) {
      uri = this.addRequestParameter(uri, 'nonce', nonce);
    }
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.onreadystatechange = () => {
        // OPENED: open()が呼び出されて、まだsend()が呼び出されてない。
        let isExistContentType = false;
        if (xhr.readyState === 1) {
          for (let key in header) {
            try {
              xhr.setRequestHeader(key.toLowerCase(), header[key]);
              if (key.toLowerCase() === 'content-type') {
                isExistContentType = true;
              }
            } catch (e) {
              reject(this.makeErrorObject(xhr.readyState, xhr.status));
              return;
            }
          }
          if (this.extendedOrigin !== undefined) {
            try {
              xhr.setRequestHeader(dConnectSDK.HEADER_EXTENDED_ORIGIN.toLowerCase(),
                this.extendedOrigin);
            } catch (e) {
              reject(this.makeErrorObject(xhr.readyState, xhr.status));
              return;
            }
          }
          // content-typeヘッダーが存在する場合には追加しない
          // dataが FormDataの場合にはマルチパートになるので、ヘッダーを付加しない。
          if (!isExistContentType && !(body instanceof FormData)) {
            xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
          }

          // PC版のChromeブラウザにおいて、DELETEでボディにnullやundefinedを
          // 指定するとレスポンスが返ってこないことがあったので、空文字を入れる。
          if (method.toUpperCase() === 'DELETE'
              && (body === undefined || body === null)) {
            body = '';
          }
          xhr.send(body);
        }
        // HEADERS_RECEIVED: send() が呼び出され、ヘッダーとステータスが通った。
        else if (xhr.readyState === 2) {
          // console.log('### 2');
        }
        // LOADING: ダウンロード中
        else if (xhr.readyState === 3) {
          // console.log('### 3');
        }
        // DONE: 一連の動作が完了した。
        else if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            let headerMap = {};
            let headerArr = xhr.getAllResponseHeaders().split('\r\n');
            for (let key in headerArr) {
              let delimIdx = headerArr[key].indexOf(':');
              let hKey = headerArr[key].substr(0, delimIdx).toLowerCase();
              let hVal = headerArr[key].substr(delimIdx + 1).trim();
              if (hKey.length != 0) {
                headerMap[hKey] = hVal;
              }
            }
            let json = JSON.parse(xhr.responseText);
            // HMACの検証
            if (hmacKey !== '' && !this.checkHmac(nonce, json.hmac)) {
              reject(this.makeErrorObject(dConnectSDK.constants.errorCode.INVALID_SERVER,
                'The response was received from the invalid server.'));
              return;
            }

            if (json.result == dConnectSDK.constants.RESULT_OK) {
              resolve(json);
            } else {
              reject(json);
            }
          } else {
            reject(this.makeErrorObject(xhr.readyState, xhr.status));
          }
        }
      };
      xhr.onerror = () => {
        // console.log('### error');
      };
      xhr.timeout = 60000;
      try {
        xhr.open(method, uri, true);
      } catch (e) {
        reject(this.makeErrorObject(-1, e.toString()));
      }
    });
  };
  /**
   * HTTPリクエストのGETメソッドへの簡易アクセスを提供する。
   * @memberOf dConnectSDK
   * @param {object} uri リクエストパラメータのJavaScriptのオブジェクト.
   * @param {object} header HTTPリクエストのヘッダーに含める項目
   * @return {Promise<object>}
   *
   * @example
   * // デバイスの検索
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.get({
   *   profile: "test",
   *   inter: "test",
   *   attribute: "test",
   *   serviceId: "testId"
   * })
   * .then(json => {
   *
   * }).catch(e => {
   *
   * });
   */
  this.get = function(uri, header) {
    return this.sendRequest('GET', uri, header, null);
  }

  /**
   * HTTPリクエストのPOSTメソッドへの簡易アクセスを提供する。
   * @memberOf dConnectSDK
   * @param {object} uri リクエストパラメータのJavaScriptのオブジェクト(URIにパラメータを付加する場合).
   * @param {object} body リクエストパラメータのJavaScriptのオブジェクト(Bodyにパラメータを付加する場合).
   * @param {object} header HTTPリクエストのヘッダーに含める項目
   * @return {Promise<object>}
   *
   * @example
   * // デバイスの検索
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.post({
   *   profile: "test",
   *   inter: "test",
   *   attribute: "test"
   * },{
   *   serviceId: "testId"
   * })
   * .then(json => {
   *
   * }).catch(e => {
   *
   * });
   */
  this.post = function(uri, body, header) {
    return this.sendRequest('POST', uri, header, body);
  }

  /**
   * HTTPリクエストのPUTメソッドへの簡易アクセスを提供する。
   * @memberOf dConnectSDK
   * @param {object} uri リクエストパラメータのJavaScriptのオブジェクト(URIにパラメータを付加する場合).
   * @param {object} body リクエストパラメータのJavaScriptのオブジェクト(Bodyにパラメータを付加する場合).
   * @param {object} header HTTPリクエストのヘッダーに含める項目
   * @return {Promise<object>}
   *
   * @example
   * // デバイスの検索
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.put({
   *   profile: "test",
   *   inter: "test",
   *   attribute: "test"
   * },{
   *   serviceId: "testId"
   * })
   * .then(json => {
   *
   * }).catch(e => {
   *
   * });
   */
  this.put = function(uri, body, header) {
    return this.sendRequest('PUT', uri, header, body);
  }

  /**
   * HTTPリクエストのDELETEメソッドへの簡易アクセスを提供する。
   * @memberOf dConnectSDK
   * @param {object} uri リクエストパラメータのJavaScriptのオブジェクト.
   * @param {object} header HTTPリクエストのヘッダーに含める項目
   * @return {Promise<object>}
   *
   * @example
   * // 初期化
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.delete({
   *   profile: "test",
   *   inter: "test",
   *   attribute: "test",
   *   serviceId: "testId"
   * })
   * .then(json => {
   *
   * }).catch(e => {
   *
   * });
   */
  this.delete = function(uri, header) {
    return this.sendRequest('DELETE', uri, header, null);
  }

  /**
   * Device Connect Managerが起動しているチェックする。そもそもインストールされていなければ、インストール
   * 画面へと進ませる。
   * @memberOf dConnectSDK
   * @return {Promise<object>}
   */
  this.checkDeviceConnect = function() {
      let builder = new this.URIBuilder();
      builder.setProfile(dConnectSDK.constants.availability.PROFILE_NAME);
      return new Promise((resolve, reject) => {
        this.get(builder.build())
        .then(json => {
          // localhost:4035でGotAPIが利用可能
          resolve(json.version);
        }).catch(e => {
          reject(e);
        });
      });
  };
  /**
   * Service Discovery APIへの簡易アクセスを提供する。
   * アクセストークンが取得されていない場合は自動で取得処理を行います。
   * @memberOf dConnectSDK
   * @return {Promise<object>}
   *
   * @example
   * // 初期化
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.discoverDevices()
   *     .then(json => {
   *         let devices = json.services;
   *     }).catch(e => {
   *     });
   */
  this.discoverDevices = function() {
        let builder = new this.URIBuilder();
        builder.setProfile(dConnectSDK.constants.serviceDiscovery.PROFILE_NAME);

        return new Promise((resolve, reject) => {
          this.get(builder.build())
          .then(json => {
            // localhost:4035でGotAPIが利用可能
            resolve(json);
          }).catch(e => {
            reject(e);
          });
        });
    };

    /**
     * Service Information APIへの簡易アクセスを提供する。
     * @memberOf dConnectSDK
     * @param {String} serviceId サービスID
     * @return {Promise<object>}
     *
     * @example
     * // 初期化
     * const sdk = new dConnectSDK({
     *   host:"192.168.0.xx",
     *   port: 4035
     * });
     * sdk.getSystemDeviceInfo()
     *     .then(json => {
     *
     *     }).catch(e => {
     *     });
     */
    this.getSystemDeviceInfo = function(serviceId) {
        let builder = new this.URIBuilder();
        builder.setProfile(dConnectSDK.constants.serviceInformation.PROFILE_NAME);
        builder.setServiceId(serviceId);
        return new Promise((resolve, reject) => {
          this.get(builder.build())
          .then(json => {
            // localhost:4035でGotAPIが利用可能
            resolve(json);
          }).catch(e => {
            reject(e);
          });
        });
    };

    /**
     * System APIへの簡易アクセスを提供する。
     * @memberOf dConnectSDK
     * @return {Promise<object>}
     *
     * @example
     * // 初期化
     * const sdk = new dConnectSDK({
     *   host:"192.168.0.xx",
     *   port: 4035
     * });
     * sdk.getSystemInfo()
     *     .then(json => {
     *
     *     }).catch(e => {
     *     });
     */
    this.getSystemInfo = function() {
        let builder = new this.URIBuilder();
        builder.setProfile(dConnectSDK.constants.system.PROFILE_NAME);
        return new Promise((resolve, reject) => {
          this.get(builder.build())
          .then(json => {
            // localhost:4035でGotAPIが利用可能
            resolve(json);
          }).catch(e => {
            reject(e);
          });
        });
    };

    /**
     * プロファイル名からサービス一覧を取得するためのAPIを提供する。
     * @memberOf dConnectSDK
     * @param {String} profileName プロファイル名
     * @return {Promise<object>}
     *
     * @example
     * // 初期化
     * const sdk = new dConnectSDK({
     *   host:"192.168.0.xx",
     *   port: 4035
     * });
     * // サービスの検索
     * sdk.discoverDevicesFromProfile('battery')
     *     .then(json => {
     *         let services = json.services;
     *     }.catch(e => {
     *     });
     */
    this.discoverDevicesFromProfile = function(profileName) {
        let result = {
            "result" : dConnectSDK.constants.RESULT_OK,
            "services" : new Array()
        };
        return new Promise((resolve, reject) => {
          this.discoverDevices().then(json => {
            let devices = json.services;
            let func = (count) => {
              if (count == devices.length) {
                resolve(result);
              } else {
                this.getSystemDeviceInfo(devices[count].id).then(json => {
                    if (json.supports) {
                      for (let i = 0; i < json.supports.length; i++) {
                        if (json.supports[i] === profileName) {
                          result.services.push(devices[count]);
                          break;
                        }
                      }
                    }
                    func(count + 1);
                  }).catch(e => {
                    reject(e);
                  });
              }
            }
            func(0);
          }).catch(e => {
            reject(e);
          });
      })
    };


    /**
     * dConnectManagnerに認可を求める.
     * @memberOf dConnectSDK
     * @param scopes 使用するスコープの配列
     * @param applicationName アプリ名
     * @return {Promise<object>}
     *
     * @example
     * // 初期化
     * const sdk = new dConnectSDK({
     *   host:"192.168.0.xx",
     *   port: 4035
     * });
     * // アクセスするプロファイル一覧を定義
     * const scopes = Array('servicediscovery', 'sysytem', 'battery');
     * // 認可を実行
     * sdk.authorization(scopes, 'サンプル')
     *      .then(accessToken => {
     *         // accessTokenを保存して、プロファイルにアクセス
     *     }).catch(e => {
     *         alert('Failed to get accessToken.');
     *     });
     */
  this.authorization = function(scopes, applicationName) {
      // scopesが設定されていない場合は、SDKが用意したスコープを設定する.
      if (!scopes || scopes.length === 0) {
        scopes = dConnectSDK.INIT_SCOPES;
      }
      // Application名が設定されていない場合は、SDKが用意したアプリケーション名を設定する.
      if (!applicationName || applicationName.length === 0) {
        applicationName = 'dConnectSDK JavaScript';
      }
      if (!self.data) {
        self.data = JSON.parse(self.storage[applicationName] || '{}');
      }
      return new Promise((resolve, reject) => {
        this.createClient().then(clientId => {
          this.requestAccessToken(clientId, scopes, applicationName)
          .then(accessToken => {
            self.data['accessToken'] = accessToken;
            self.storage[applicationName] = JSON.stringify(self.data);
            if (self.isConnectedWebSocket()) {
              let cb = this.websocketListener;

              self.disconnectWebSocket();
              self.connectWebSocket(cb);
            }
            resolve(accessToken);
          }).catch(e => {
            if (e.errorCode == dConnectSDK.constants.errorCode.NOT_SUPPORT_PROFILE) {
              // NOT_SUPPORT_PROFILEエラーが出た場合は、LocalOAuthがOFFになっているので、
              // dummyのAccessTokenを設定する。
              self.data['accessToken'] = 'dummy';
              self.storage[applicationName] = JSON.stringify(self.data);
              if (self.isConnectedWebSocket()) {
                let cb = this.websocketListener;
                self.disconnectWebSocket();
                self.connectWebSocket(cb);
              }
              resolve('dummy');
            } else {
              reject(e);
            }
          })
        }).catch(e => {
          reject(e);
        });
      });
  };

  /**
   * クライアントを作成する.
   * @memberOf dConnectSDK
   * @return {Promise<object>}
   *
   * @example
   * // 初期化
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.createClient()
   *     .then(clientId => {
   *         // clientIdを保存して、アクセストークンの取得に使用する
   *     }).catch(e => {
   *     }
   * );
   */
  this.createClient = function() {
    let builder = new this.URIBuilder();
    builder.setProfile(dConnectSDK.constants.authorization.PROFILE_NAME);
    builder.setAttribute(dConnectSDK.constants.authorization.ATTR_GRANT);
    return new Promise((resolve, reject) => {
      this.get(builder.build()).then(json => {
        self.data['clientId'] = json.clientId;
        self.storage[self.appName] = JSON.stringify(self.data);
        resolve(json.clientId);
      }).catch(e => {
        reject(this.makeErrorObject(e.errorCode, 'Failed to create client.'));
      });
    });
  };

  /**
   * アクセストークンを要求する.
   * @memberOf dConnectSDK
   * @param clientId クライアントID
   * @param scopes スコープ一覧(配列)
   * @param applicationName アプリ名
   * @return {Promise<object>}
   *
   * @example
   * // 初期化
   * const sdk = new dConnectSDK({
   *   host:"192.168.0.xx",
   *   port: 4035
   * });
   * sdk.requestAccessToken(clientId, scopes, 'アプリ名')
   *     .then(accessToken => {
   *         // アクセストークンの保存して、プロファイルのアクセスを行う
   *     }).catch(e => {
   *     }
   * );
   */
  this.requestAccessToken = function(clientId, scopes, applicatonName) {
    // uri作成
    let builder = new this.URIBuilder();
    builder.setProfile(dConnectSDK.constants.authorization.PROFILE_NAME);
    builder.setAttribute(dConnectSDK.constants.authorization.ATTR_ACCESS_TOKEN);
    builder.addParameter(dConnectSDK.constants.authorization.PARAM_CLIENT_ID,
                          clientId);
    builder.addParameter(dConnectSDK.constants.authorization.PARAM_SCOPE,
                          this.combineScope(scopes));
    builder.addParameter(dConnectSDK.constants.authorization.PARAM_APPLICATION_NAME,
                          applicatonName);
    return new Promise((resolve, reject) => {
      this.get(builder.build()).then(json => {
        resolve(json.accessToken);
      }).catch(e => {
        reject(this.makeErrorObject(e.errorCode, 'Failed to get access token.'));
      });
    });
  };

  /**
   * スコープの配列を文字列に置換する.
   * @memberOf dConnectSDK
   * @param {Array.<String>} scopes スコープ一覧
   * @return <String> 連結されたスコープ一覧
   */
  this.combineScope = function(scopes) {
    let scope = '';
    if (Array.isArray(scopes)) {
      for (let i = 0; i < scopes.length; i++) {
        if (i > 0) {
          scope += ',';
        }
        scope += scopes[i];
      }
    }
    return scope;
  };

  /**
   * 指定されたDevice Connect Event APIにイベントリスナーを登録する。
   * @memberOf dConnect
   * @param {Object} uri 特定のDevice Connect Event APIを表すURI(オブジェクト)
   * @param {Function} onmessage 登録したいイベント受領用コールバック。
   * @return {Promise<object>}
   *
   * @example
   * const sdk = new dConnectSDK({
   *  host: '192.168.0.24',
   *   port: 4035
   * });
   * sdk.addEventListener({
   *   profile: 'deviceorientation',
   *   attribute: 'ondeviceorientation',
   *   serviceId: 'Host.xxxxxxx.localhost.deviceconnect.org'
   * }, message => {
   *    // イベントのメッセージを受け取る
   * }).then(json => {
   *   sdk.connectWebSocket(uri, (message) => {
   *
   *      })  // WebSocketの接続
   *      .then(s => {
   *          // WebSocketとの接続状況を返す
   *       }).catch(e => {
   *       });
   * }).catch (e => {
   *
   * });
   */
  this.addEventListener = function(uri, onmessage) {
    uri = this.converObjToUri(uri);
    return new Promise((resolve, reject) => {
      this.put(uri).then(json => {
        this.eventListener[uri.toLowerCase()] = onmessage;
        resolve(json);
      }).catch(e => {
        reject(e);
      });
    });
  };

  /**
   * 指定されたDevice Connect Event APIからイベントリスナーを削除する。
   * @memberOf dConnectSDK
   * @param {Object} uri 特定のDevice Connect Event APIを表すURI（オブジェクト）
   * @return {Promise<object>}
   *
   * @example
   * const sdk = new dConnectSDK({
   *  host: '192.168.0.24',
   *   port: 4035
   * });
   * sdk.removeEventListener({
   *   profile: 'deviceorientation',
   *   attribute: 'ondeviceorientation',
   *   serviceId: 'Host.xxxxxxx.localhost.deviceconnect.org'
   * }).then(json => {
   *   sdk.disconnectWebSocket(); //WebSocketの切断
   * }).catch (e => {
   *
   * });
   */
  this.removeEventListener = function(uri) {
    uri = this.converObjToUri(uri);

    return new Promise((resolve, reject) => {
      this.delete(uri).then(json => {
          delete this.eventListener[uri.toLowerCase()];
          resolve(json);
      }).catch(e => {
        reject(e);
      });
    });
  };

  /**
   * WebSocketを開く.
   * <p>
   * WebSocketは、一つしか接続することができない。
   * sdk.isConnectedWebSocket()を用いて、接続確認はできるので、
   * 接続されている場合には、一度、sdk.disconnectWebSocket()で
   * 切断してから、再度接続処理を行って下さい。
   * </p>
   * @memberOf dConnectSDK
   * @param cb WebSocketの開閉イベントを受け取るコールバック関数
   * @return {Promise<object>}
   *
   * @example
   * // Websocketを開く
   * sdk.connectWebSocket()
   * .then(s => {
   *   // WebSocketの接続状態のオブジェクトが返ってくる.
   * }).catch(e => {
   *   // エラーコードを返す.
   * });
   *
   */
  this.connectWebSocket = function(cb) {
      if (this.websocket) {
        cb(2, 'error: already open websocket.');
      }
      if (!self.data['accessToken']) {
        self.authorization(self.scopes, self.appName)
        .then(accessToken => {
          // アクセストークンを保存する
          self.data['accessToken'] = accessToken;
          self.storage[self.appName] = JSON.stringify(self.data);
          self.initWebSocket(cb);
        }).catch(e => {
          if (e.errorCode == dConnectSDK.constants.errorCode.NOT_SUPPORT_PROFILE
            || e.errorMessage === 'Failed to create client.') {
            // NOT_SUPPORT_PROFILEエラーが出た場合は、LocalOAuthがOFFになっているので、
            // dummyのAccessTokenを設定する。
            self.data['accessToken'] = 'dummy';
            self.storage[self.appName] = JSON.stringify(self.data);
            self.initWebSocket(cb);
          } else {
            cb(2, e.getMessage);
          }
        });
        return;
      }
      self.initWebSocket(cb);
  };
  this.initWebSocket = function (cb) {
    this.websocketListener = cb;
    const scheme = this.sslEnabled ? 'wss' : 'ws';
    this.websocket = new WebSocket(scheme + '://' + this.host + ':' +
                              this.port + '/gotapi/websocket');
    this.websocket.onopen = (e) => {
      self.isOpenedWebSocket = true;
      // 本アプリのイベント用WebSocketと1対1で紐づいたセッションキーをDevice Connect Managerに登録してもらう。
      this.websocket.send('{"accessToken":"' + self.data['accessToken'] + '"}');

      cb(0, 'open');
    };
    this.websocket.onmessage = (msg) => {
      let json = JSON.parse(msg.data);

      // console.log("json: " + JSON.stringify(json));
      // console.log("list:" + JSON.parse(this.eventListener));
      if (!self.isEstablishedWebSocket) {
        if (json.result === 0) {
          self.isEstablishedWebSocket = true;
          self.startMonitoringWebsocket(cb);
          cb(-1, 'established');
        } else {
          cb(json.errorCode, json.errorMessage);
        }
        return;
      }

      let uri = '/gotapi/';
      if (json.profile) {
        uri += json.profile;
      }
      if (json.interface) {
        uri += '/';
        uri += json.interface;
      }
      if (json.attribute) {
        uri += '/';
        uri += json.attribute;
      }
      uri = uri.toLowerCase();
      for (let key in this.eventListener) {
        if (key.lastIndexOf(uri) > 0) {
          if (this.eventListener[key] != null) {
            this.eventListener[key](msg.data);
          }
        }
      }
    };
    this.websocket.onerror = (error) => {
      console.log("close:" + error.toString());
      cb(2, 'error:' + JSON.stringify(error));
    }
    this.websocket.onclose = (e) => {
      console.log("close:" + e.toString());
      cb(1, 'close');
    };
  }
  this.startMonitoringWebsocket = function(cb) {
    if (this.reconnectingTimerId === undefined) {
      this.reconnectingTimerId = setInterval(() => {
        if (!this.isConnectedWebSocket()) {
          this.connectWebSocket(cb);
        }
      }, 1000);
    }
  };

  this.stopMonitoringWebsocket = function() {
    if (this.reconnectingTimerId !== undefined) {
      clearInterval(this.reconnectingTimerId);
      this.reconnectingTimerId = undefined;
    }
  };

  /**
   * WebSocketを切断する.
   * @memberOf dConnectSDK
   */
  this.disconnectWebSocket = function() {
    if (this.websocket) {
      this.stopMonitoringWebsocket();
      delete this.websocketListener;
      this.isOpenedWebSocket = false;
      this.isEstablishedWebSocket = false;
      this.websocket.close();
    }
  };

  /**
   * Websocketが接続されているかチェックする.
   * @return 接続している場合にはtrue、それ以外はfalse
   */
  this.isConnectedWebSocket = function() {
    return this.websocket != undefined && this.isOpenedWebSocket;
  }

  /**
   * Websocketでイベントを受信可能な状態かチェックする.
   * @return 可能な場合にはtrue、それ以外はfalse
   */
  this.isWebSocketReady = function() {
    return this.isConnectedWebSocket() && this.isEstablishedWebSocket;
  }
  /**
   * Android端末上でDevice Connect Managerを起動する.
   * <p>
   * 注意: 起動に成功した場合、起動用Intentを受信するためのActivity起動する.
   * つまり、このときWebブラウザがバックグラウンドに移動するので注意.
   * そのActivityの消えるタイミング(自動的に消えるか、もしくはユーザー操作で消すのか)は
   * Activityの実装依存とする.
   * </p>
   * @private
   * @param state 起動画面を出すか出さないか
   */
  this.startManagerForAndroid = function(state) {
    this._currentHmacKey = this.isEnabledAntiSpoofing() ?
                        this.generateRandom(dConnectSDK.HMAC_KEY_BYTES) : '';
    let urlScheme = new this.AndroidURISchemeBuilder();
    let url;
    let origin = encodeURIComponent(location.origin);
    if (state === undefined) {
        state = '';
    }
    if (this.isFirefox()) {
        url = this.uriSchemeName + '://start/' + state
                  + '?origin=' + origin
                  + '&key=' + this._currentHmacKey;
    } else {
      urlScheme.setPath('start/' + state);
      urlScheme.addParameter('package', 'org.deviceconnect.android.manager');
      urlScheme.addParameter('S.origin', origin);
      urlScheme.addParameter('S.key', this._currentHmacKey);
      url = urlScheme.build();
    }
    location.href = url;
  };

  /**
   * iOS端末上でDevice Connect Managerを起動する.
   * @private
   */
  this.startManagerForIOS = function() {
    window.location.href = uriSchemeName + '://start?url=' +
                  encodeURIComponent(window.location.href);
  };

  /**
   * Device Connect Managerを起動する.
   * @memberOf dConnectSDK
   * @param state 起動画面を出すか出さないか
   */
  this.startManager = function(state) {
    let userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('android') > -1) {
      this.startManagerForAndroid(state);
    } else if (userAgent.search(/iphone|ipad|ipod/) > -1) {
      this.startManagerForIOS();
    }
  };

  /**
   * Android端末上でDevice Connect Managerを停止する.
   * <p>
   * 注意: 停止に成功した場合、停止用Intentを受信するためのActivity起動する.
   * つまり、このときWebブラウザがバックグラウンドに移動するので注意.
   * そのActivityの消えるタイミング(自動的に消えるか、もしくはユーザー操作で消すのか)は
   * Activityの実装依存とする.
   * </p>
   * @private
   * @param state 起動画面を出すか出さないか
   */
  this.stopManagerForAndroid = function(state) {
    this._currentHmacKey = isEnabledAntiSpoofing() ?
                        generateRandom(HMAC_KEY_BYTES) : '';
    let urlScheme = new this.AndroidURISchemeBuilder();
    let url;
    let origin = encodeURIComponent(location.origin);
    if (state === undefined) {
        state = '';
    }
    if (isFirefox()) {
        url = uriSchemeName + '://stop/' + state
              + '?origin=' + origin
              + '&key=' + this._currentHmacKey;
    } else {
      urlScheme.setPath('stop/' + state);
      urlScheme.addParameter('package', 'org.deviceconnect.android.manager');
      urlScheme.addParameter('S.origin', origin);
      urlScheme.addParameter('S.key', this._currentHmacKey);
      url = urlScheme.build();
    }
    location.href = url;
  };

  /**
   * iOS端末上でDevice Connect Managerを停止する.
   * @private
   */
  this.stopManagerForIOS = function() {
    window.location.href = uriSchemeName + '://stop';
  };

  /**
   * Device Connect Managerを停止する.
   * @memberOf dConnectSDK
   * @param state 停止画面を出すか出さないか
   */
  this.stopManager = function(state) {
    let userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('android') > -1) {
      this.stopManagerForAndroid(state);
    } else if (userAgent.search(/iphone|ipad|ipod/) > -1) {
      this.stopManagerForIOS();
    }
  };


};
/**
 * ハイブリッドアプリのオリジンを指定するリクエストヘッダ名.
 */
dConnectSDK.HEADER_EXTENDED_ORIGIN = "X-GotAPI-Origin";
/**
 * Device Connect Managerへ送信するリクエストのnonceの長さ. 単位はバイト.
 */
dConnectSDK.NONCE_BYTES = 16;

/**
 * Device Connect Managerへ送信するHMAC生成キーの長さ. 単位はバイト.
 */
dConnectSDK.HMAC_KEY_BYTES = 16;

/**
 * Device Connectでサポートしているすべてのプロファイル.
 */
dConnectSDK.INIT_SCOPES = Array('servicediscovery', 'serviceinformation', 'system',
            'battery', 'connection', 'deviceorientation', 'filedescriptor',
            'file', 'mediaplayer', 'mediastreamrecording', 'notification',
            'phone', 'proximity', 'setting', 'vibration', 'light',
            'remotecontroller', 'drivecontroller', 'mhealth', 'sphero',
            'dice', 'temperature', 'camera', 'canvas', 'health',
            'touch', 'humandetection', 'keyevent', 'omnidirectionalimage',
             'tv', 'powermeter','humidity','illuminance', 'videochat',
             'airconditioner','gpio', 'ecg', 'stressEstimation', 'poseEstimation',
             'walkState', 'messagehook', 'atmosphericPressure', 'geolocation',
             'echonetLite', 'power', 'fabo', 'mouse', 'keyboard', 'device');
/**
 * Device Connectで用いられる定数.
 * @memberOf dConnectSDK
 * @namespace
 * @type {Object.<String, (Number|Object)>}
 */
dConnectSDK.constants = {
  /**
   * Device Connectからの処理結果で成功を表す定数.
   * @const
   * @type {Number}
   */
  RESULT_OK: 0,
  /**
   * Device Connectからの処理結果で失敗を表す定数.
   * @const
   * @type {Number}
   */
  RESULT_ERROR: 1,

  /**
   * エラーコードを定義する列挙型.
   * @readonly
   * @enum {Number}
   */
  errorCode: {
    /** エラーコード: Device Connectへのアクセスに失敗した. */
    ACCESS_FAILED: -1,
    /** エラーコード: 不正なサーバからのレスポンスを受信した. */
    INVALID_SERVER: -2,
    /** エラーコード: 原因不明のエラー. */
    UNKNOWN: 1,
    /** エラーコード: サポートされていないプロファイルにアクセスされた. */
    NOT_SUPPORT_PROFILE: 2,
    /** エラーコード: サポートされていないアクションが指定された. */
    NOT_SUPPORT_ACTION: 3,
    /** エラーコード: サポートされていない属性・インターフェースが指定された. */
    NOT_SUPPORT_ATTRIBUTE: 4,
    /** エラーコード: serviceIdが設定されていない. */
    EMPTY_SERVICE_ID: 5,
    /** エラーコード: サービスが発見できなかった. */
    NOT_FOUND_SERVICE: 6,
    /** エラーコード: タイムアウトが発生した. */
    TIMEOUT: 7,
    /** エラーコード: 未知の属性・インターフェースにアクセスされた. */
    UNKNOWN_ATTRIBUTE: 8,
    /** エラーコード: バッテリー低下で操作不能. */
    LOW_BATTERY: 9,
    /** エラーコード: 不正なパラメータを受信した. */
    INVALID_REQUEST_PARAMETER: 10,
    /** エラーコード: 認証エラー. */
    AUTHORIZATION: 11,
    /** エラーコード: アクセストークンの有効期限切れ. */
    EXPIRED_ACCESS_TOKEN: 12,
    /** エラーコード: アクセストークンが設定されていない. */
    EMPTY_ACCESS_TOKEN: 13,
    /** エラーコード: スコープ外にアクセス要求がなされた. */
    SCOPE: 14,
    /** エラーコード: 認証時にclientIdが発見できなかった. */
    NOT_FOUND_CLIENT_ID: 15,
    /** エラーコード: デバイスの状態異常エラー. */
    ILLEGAL_DEVICE_STATE: 16,
    /** エラーコード: サーバの状態異常エラー. */
    ILLEGAL_SERVER_STATE: 17,
    /** エラーコード: 不正オリジンエラー. */
    INVALID_ORIGIN: 18,
    /** エラーコード: 不正URLエラー. */
    INVALID_URL: 19,
    /** エラーコード: 不正Profileエラー. */
    INVALID_PROFILE: 20

  },

  /**
   * Device Connectの各種定数.
   * @namespace
   * @type {Object.<String, String>}
   */
  common: {
    /** 共通パラメータ: action。*/
    PARAM_ACTION: 'action',
    /** 共通パラメータ: serviceId。 */
    PARAM_SERVICE_ID: 'serviceId',
    /** 共通パラメータ: pluginId。 */
    PARAM_PLUGIN_ID: 'pluginId',
    /** 共通パラメータ: profile。 */
    PARAM_PROFILE: 'profile',
    /** 共通パラメータ: interface。 */
    PARAM_INTERFACE: 'interface',
    /** 共通パラメータ: attribute。 */
    PARAM_ATTRIBUTE: 'attribute',
    /** 共通パラメータ: sessionKey。 */
    PARAM_SESSION_KEY: 'sessionKey',
    /** 共通パラメータ: accessToken。 */
    PARAM_ACCESS_TOKEN: 'accessToken',
    /** 共通パラメータ: websocket。 */
    PARAM_WEB_SOCKET: 'websocket',
    /** 共通パラメータ: result。 */
    PARAM_RESULT: 'result',
    /** 共通パラメータ: errorCode。 */
    PARAM_ERROR_CODE: 'errorCode',
    /** 共通パラメータ: errorMessage。 */
    PARAM_ERROR_MESSAGE: 'errorMessage'
  },

  /**
   * Authorizationプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  authorization: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'authorization',

    // Atttribute
    /** アトリビュート: grant。*/
    ATTR_GRANT: 'grant',
    /** アトリビュート: accesstoken。 */
    ATTR_ACCESS_TOKEN: 'accesstoken',

    // Parameter
    /** パラメータ: clientId。 */
    PARAM_CLIENT_ID: 'clientId',
    /** パラメータ: scope。 */
    PARAM_SCOPE: 'scope',
    /** パラメータ: scopes。 */
    PARAM_SCOPES: 'scopes',
    /** パラメータ: applicationName。 */
    PARAM_APPLICATION_NAME: 'applicationName',
    /** パラメータ: accessToken。 */
    PARAM_ACCESS_TOKEN: 'accessToken',
    /** パラメータ: expirePeriod。 */
    PARAM_EXPIRE_PERIOD: 'expirePeriod',
    /** パラメータ: expire。 */
    PARAM_EXPIRE: 'expire',
  },

  /**
   * Availabilityプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  availability: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'availability'
  },

  /**
   * Batteryプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  battery: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'battery',

    // Atttribute
    /** アトリビュート: charging */
    ATTR_CHARGING: 'charging',
    /** アトリビュート: chargingTime */
    ATTR_CHARGING_TIME: 'chargingTime',
    /** アトリビュート: dischargingTime */
    ATTR_DISCHARGING_TIME: 'dischargingTime',
    /** アトリビュート: level */
    ATTR_LEVEL: 'level',
    /** アトリビュート: onchargingchange */
    ATTR_ON_CHARGING_CHANGE: 'onchargingchange',
    /** アトリビュート: onbatterychange */
    ATTR_ON_BATTERY_CHANGE: 'onbatterychange',

    // Parameter
    /** パラメータ: charging */
    PARAM_CHARGING: 'charging',
    /** パラメータ: chargingTime */
    PARAM_CHARGING_TIME: 'chargingTime',
    /** パラメータ: dischargingTime */
    PARAM_DISCHARGING_TIME: 'dischargingTime',
    /** パラメータ: level */
    PARAM_LEVEL: 'level',
    /** パラメータ: battery */
    PARAM_BATTERY: 'battery',
  },

  /**
   * Connectionプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  connection: {
    // Profile Name
    /** プロファイル名。 */
    PROFILE_NAME: 'connection',

    // Interface
    /** インターフェース: bluetooth */
    INTERFACE_BLUETOOTH: 'bluetooth',

    // Attribute
    /** アトリビュート: wifi */
    ATTR_WIFI: 'wifi',
    /** アトリビュート: bluetooth */
    ATTR_BLUETOOTH: 'bluetooth',
    /** アトリビュート: discoverable */
    ATTR_DISCOVERABLE: 'discoverable',
    /** アトリビュート: ble */
    ATTR_BLE: 'ble',
    /** アトリビュート: nfc */
    ATTR_NFC: 'nfc',
    /** アトリビュート: onwifichange */
    ATTR_ON_WIFI_CHANGE: 'onwifichange',
    /** アトリビュート: onbluetoothchange */
    ATTR_ON_BLUETOOTH_CHANGE: 'onbluetoothchange',
    /** アトリビュート: onblechange */
    ATTR_ON_BLE_CHANGE: 'onblechange',
    /** アトリビュート: onnfcchange */
    ATTR_ON_NFC_CHANGE: 'onnfcchange',

    // Parameter
    /** パラメータ: enable */
    PARAM_ENABLE: 'enable',
    /** パラメータ: connectStatus */
    PARAM_CONNECT_STATUS: 'connectStatus'
  },

  /**
   * Device Orientationプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  deviceOrientation: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'deviceorientation',

    // Attribute
    /** アトリビュート: ondeviceorientation */
    ATTR_ON_DEVICE_ORIENTATION: 'ondeviceorientation',

    // Parameter
    /** パラメータ: orientation */
    PARAM_ORIENTATION: 'orientation',
    /** パラメータ: acceleration */
    PARAM_ACCELERATION: 'acceleration',
    /** パラメータ: x */
    PARAM_X: 'x',
    /** パラメータ: y */
    PARAM_Y: 'y',
    /** パラメータ: z */
    PARAM_Z: 'z',
    /** パラメータ: rotationRate */
    PARAM_ROTATION_RATE: 'rotationRate',
    /** パラメータ: alpha */
    PARAM_ALPHA: 'alpha',
    /** パラメータ: beta */
    PARAM_BETA: 'beta',
    /** パラメータ: gamma */
    PARAM_GAMMA: 'gamma',
    /** パラメータ: interval */
    PARAM_INTERVAL: 'interval',
    /** パラメータ: accelerationIncludingGravity */
    PARAM_ACCELERATION_INCLUDEING_GRAVITY: 'accelerationIncludingGravity'
  },


  /**
   * Fileプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  file: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'file',

    // Attribute
    /** アトリビュート: list */
    ATTR_LIST: 'list',
    /** アトリビュート: directory */
    ATTR_DIRECTORY: 'directory',

    // Parameter
    /** パラメータ: mimeType */
    PARAM_MIME_TYPE: 'mimeType',
    /** パラメータ: fileName */
    PARAM_FILE_NAME: 'fileName',
    /** パラメータ: fileSize */
    PARAM_FILE_SIZE: 'fileSize',
    /** パラメータ: media */
    PARAM_MEDIA: 'media',
    /** パラメータ: path */
    PARAM_PATH: 'path',
    /** パラメータ: fileType */
    PARAM_FILE_TYPE: 'fileType',
    /** パラメータ: order */
    PARAM_ORDER: 'order',
    /** パラメータ: offset */
    PARAM_OFFSET: 'offset',
    /** パラメータ: limit */
    PARAM_LIMIT: 'limit',
    /** パラメータ: count */
    PARAM_COUNT: 'count',
    /** パラメータ: updateDate */
    PARAM_UPDATE_DATE: 'updateDate',
    /** パラメータ: files */
    PARAM_FILES: 'files'
  },

  /**
   * Key Eventプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  keyEvent: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'keyevent',

    // Attribute
    /** アトリビュート: ondown */
    ATTR_ON_DOWN: 'ondown',
    /** アトリビュート: onup */
    ATTR_ON_UP: 'onup',
    /** アトリビュート: onkeychange */
    ATTR_ON_KEY_CHANGE: 'onkeychange',
    // Parameter
    /** パラメータ: keyevent */
    PARAM_KEY_EVENT: 'keyevent',
    /** パラメータ: id */
    PARAM_ID: 'id',
    /** パラメータ: config */
    PARAM_CONFIG: 'config',

    // Key Types
    /** キータイプ: Standard Keyboard */
    KEYTYPE_STD_KEY: 0,
    /** キータイプ: Media Control */
    KEYTYPE_MEDIA_CTRL: 512,
    /** キータイプ:  Directional Pad / Button */
    KEYTYPE_DPAD_BUTTON: 1024,
    /** キータイプ: User defined */
    KEYTYPE_USER: 32768
  },

  /**
   * Media Playerプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  mediaPlayer: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'mediaplayer',

    // Attribute
    /** アトリビュート: media */
    ATTR_MEDIA: 'media',
    /** アトリビュート: medialist */
    ATTR_MEDIA_LIST: 'medialist',
    /** アトリビュート: playstatus */
    ATTR_PLAY_STATUS: 'playstatus',
    /** アトリビュート: play */
    ATTR_PLAY: 'play',
    /** アトリビュート: stop */
    ATTR_STOP: 'stop',
    /** アトリビュート: pause */
    ATTR_PAUSE: 'pause',
    /** アトリビュート: resume */
    ATTR_RESUME: 'resume',
    /** アトリビュート: seek */
    ATTR_SEEK: 'seek',
    /** アトリビュート: volume */
    ATTR_VOLUME: 'volume',
    /** アトリビュート: mute */
    ATTR_MUTE: 'mute',
    /** アトリビュート: onstatuschange */
    ATTR_ON_STATUS_CHANGE: 'onstatuschange',

    // Parameter
    /** パラメータ: media */
    PARAM_MEDIA: 'media',
    /** パラメータ: mediaId */
    PARAM_MEDIA_ID: 'mediaId',
    /** パラメータ: mediaPlayer */
    PARAM_MEDIA_PLAYER: 'mediaPlayer',
    /** パラメータ: mimeType */
    PARAM_MIME_TYPE: 'mimeType',
    /** パラメータ: title */
    PARAM_TITLE: 'title',
    /** パラメータ: type */
    PARAM_TYPE: 'type',
    /** パラメータ: language */
    PARAM_LANGUAGE: 'language',
    /** パラメータ: description */
    PARAM_DESCRIPTION: 'description',
    /** パラメータ: imageUri */
    PARAM_IMAGE_URI: 'imageUri',
    /** パラメータ: duration */
    PARAM_DURATION: 'duration',
    /** パラメータ: creators */
    PARAM_CREATORS: 'creators',
    /** パラメータ: creator */
    PARAM_CREATOR: 'creator',
    /** パラメータ: role */
    PARAM_ROLE: 'role',
    /** パラメータ: keywords */
    PARAM_KEYWORDS: 'keywords',
    /** パラメータ: genres */
    PARAM_GENRES: 'genres',
    /** パラメータ: query */
    PARAM_QUERY: 'query',
    /** パラメータ: order */
    PARAM_ORDER: 'order',
    /** パラメータ: offset */
    PARAM_OFFSET: 'offset',
    /** パラメータ: limit */
    PARAM_LIMIT: 'limit',
    /** パラメータ: count */
    PARAM_COUNT: 'count',
    /** パラメータ: status */
    PARAM_STATUS: 'status',
    /** パラメータ: pos */
    PARAM_POS: 'pos',
    /** パラメータ: volume */
    PARAM_VOLUME: 'volume',
    /** パラメータ: mute */
    PARAM_MUTE: 'mute',

    // ===== play_statusで指定するステータスを定義 =====
    /** play_statusで指定するステータス: Play */
    PLAY_STATUS_PLAY: 'play',
    /** play_statusで指定するステータス: Stop */
    PLAY_STATUS_STOP: 'stop',
    /** play_statusで指定するステータス: Pause */
    PLAY_STATUS_PAUSE: 'pause',

    // ===== onstatuschangeで受け取るステータス =====
    /** onstatuschangeで受け取るステータス: Play */
    ON_STATUS_CHANGE_PLAY: 'play',
    /** onstatuschangeで受け取るステータス: Stop */
    ON_STATUS_CHANGE_STOP: 'stop',
    /** onstatuschangeで受け取るステータス: Pause */
    ON_STATUS_CHANGE_PAUSE: 'pause',
    /** onstatuschangeで受け取るステータス: Resume */
    ON_STATUS_CHANGE_RESUME: 'resume',
    /** onstatuschangeで受け取るステータス: Mute */
    ON_STATUS_CHANGE_MUTE: 'mute',
    /** onstatuschangeで受け取るステータス: Unmute */
    ON_STATUS_CHNAGE_UNMUTE: 'unmute',
    /** onstatuschangeで受け取るステータス: Media */
    ON_STATUS_CHANGE_MEDIA: 'media',
    /** onstatuschangeで受け取るステータス: Volume */
    ON_STATUS_CHANGE_VOLUME: 'volume',
    /** onstatuschangeで受け取るステータス: complete */
    ON_STATUS_CHANGE_COMPLETE: 'complete',

    // ===== 並び順 =====
    /** 並び順: 昇順 */
    ORDER_ASC: 'asc',
    /** 並び順: 降順 */
    ORDER_DSEC: 'desc'
  },

  /**
   * Media Stream Recordingプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  mediaStreamRecording: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'mediastreamrecording',

    // Attribute
    /** アトリビュート: mediarecorder */
    ATTR_MEDIARECORDER: 'mediarecorder',
    /** アトリビュート: takephoto */
    ATTR_TAKE_PHOTO: 'takephoto',
    /** アトリビュート: record */
    ATTR_RECORD: 'record',
    /** アトリビュート: pause */
    ATTR_PAUSE: 'pause',
    /** アトリビュート: resume */
    ATTR_RESUME: 'resume',
    /** アトリビュート: stop */
    ATTR_STOP: 'stop',
    /** アトリビュート: mutetrack */
    ATTR_MUTETRACK: 'mutetrack',
    /** アトリビュート: unmutetrack */
    ATTR_UNMUTETRACK: 'unmutetrack',
    /** アトリビュート: options */
    ATTR_OPTIONS: 'options',
    /** アトリビュート: preview */
    ATTR_PREVIEW: 'preview',
    /** アトリビュート: onphoto */
    ATTR_ON_PHOTO: 'onphoto',
    /** アトリビュート: ondataavailable */
    ATTR_ON_DATA_AVAILABLE: 'ondataavailable',
    /** アトリビュート: onrecordingchange */
    ATTR_ON_RECORDING_CHANGE: 'onrecordingchange',

    /** パラメータ: target */
    PARAM_TARGET: 'target',
    /** パラメータ: recorders */
    PARAM_RECORDERS: 'recorders',
    /** パラメータ: id */
    PARAM_ID: 'id',
    /** パラメータ: name */
    PARAM_NAME: 'name',
    /** パラメータ: state */
    PARAM_STATE: 'state',
    /** パラメータ: imageWidth */
    PARAM_IMAGE_WIDTH: 'imageWidth',
    /** パラメータ: imageHeight */
    PARAM_IMAGE_HEIGHT: 'imageHeight',
    /** パラメータ: previewWidth */
    PARAM_PREVIEW_WIDTH: 'previewWidth',
    /** パラメータ: previewHeight */
    PARAM_PREVIEW_HEIGHT: 'previewHeight',
    /** パラメータ: previewMaxFrameRate */
    PARAM_PREVIEW_MAX_FRAME_RATE: 'previewMaxFrameRate',
    /** パラメータ: audio */
    PARAM_AUDIO: 'audio',
    /** パラメータ: channels */
    PARAM_CHANNELS: 'channels',
    /** パラメータ: sampleRate */
    PARAM_SAMPLE_RATE: 'sampleRate',
    /** パラメータ: sampleSize */
    PARAM_SAMPLE_SIZE: 'sampleSize',
    /** パラメータ: blockSize */
    PARAM_BLOCK_SIZE: 'blockSize',
    /** パラメータ: mimeType */
    PARAM_MIME_TYPE: 'mimeType',
    /** パラメータ: config */
    PARAM_CONFIG: 'config',
    /** パラメータ: imageSizes */
    PARAM_IMAGE_SIZES: 'imageSizes',
    /** パラメータ: previewSizes */
    PARAM_PREVIEW_SIZES: 'previewSizes',
    /** パラメータ: width */
    PARAM_WIDTH: 'width',
    /** パラメータ: height */
    PARAM_HEIGHT: 'height',
    /** パラメータ: timeslice */
    PARAM_TIME_SLICE: 'timeslice',
    /** パラメータ: settings */
    PARAM_SETTINGS: 'settings',
    /** パラメータ: photo */
    PARAM_PHOTO: 'photo',
    /** パラメータ: media */
    PARAM_MEDIA: 'media',
    /** パラメータ: status */
    PARAM_STATUS: 'status',
    /** パラメータ: errorMessage */
    PARAM_ERROR_MESSAGE: 'errorMessage',
    /** パラメータ: path */
    PARAM_PATH: 'path',
    /** パラメータ: min */
    PARAM_MIN: 'min',
    /** パラメータ: max */
    PARAM_MAX: 'max',

    // ===== カメラの状態定数 =====
    /** メラの状態定数: 停止中 */
    RECORDER_STATE_INACTIVE: 'inactive',
    /** メラの状態定数: レコーディング中 */
    RECORDER_STATE_RECORDING: 'recording',
    /** メラの状態定数: 一時停止中 */
    RECORDER_STATE_PAUSED: 'paused',

    // ===== 動画撮影、音声録音の状態定数 =====
    /** 動画撮影、音声録音の状態定数: 開始 */
    RECORDING_STATE_RECORDING: 'recording',
    /** 動画撮影、音声録音の状態定数: 終了 */
    RECORDING_STATE_STOP: 'stop',
    /** 動画撮影、音声録音の状態定数: 一時停止 */
    RECORDING_STATE_PAUSE: 'pause',
    /** 動画撮影、音声録音の状態定数: 再開 */
    RECORDING_STATE_RESUME: 'resume',
    /** 動画撮影、音声録音の状態定数: ミュート */
    RECORDING_STATE_MUTETRACK: 'mutetrack',
    /** 動画撮影、音声録音の状態定数: ミュート解除 */
    RECORDING_STATE_UNMUTETRACK: 'unmutetrack',
    /** 動画撮影、音声録音の状態定数: エラー発生 */
    RECORDING_STATE_ERROR: 'error',
    /** 動画撮影、音声録音の状態定数: 警告発生 */
    RECORDING_STATE_WARNING: 'warning'
  },

  /**
   * Service Discoveryプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  serviceDiscovery: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'servicediscovery',

    // Attribute
    /** アトリビュート: onservicechange */
    ATTR_ON_SERVICE_CHANGE: 'onservicechange',

    // Parameter
    /** パラメータ: networkService */
    PARAM_NETWORK_SERVICE: 'networkService',
    /** パラメータ: services */
    PARAM_SERVICES: 'services',
    /** パラメータ: state */
    PARAM_STATE: 'state',
    /** パラメータ: id */
    PARAM_ID: 'id',
    /** パラメータ: name */
    PARAM_NAME: 'name',
    /** パラメータ: type */
    PARAM_TYPE: 'type',
    /** パラメータ: online */
    PARAM_ONLINE: 'online',
    /** パラメータ: config */
    PARAM_CONFIG: 'config',
    /** パラメータ: scopes */
    PARAM_SCOPES: 'scopes',

    // ===== ネットワークタイプ =====
    /** ネットワークタイプ: WiFi */
    NETWORK_TYPE_WIFI: 'WiFi',
    /** ネットワークタイプ: BLE */
    NETWORK_TYPE_BLE: 'BLE',
    /** ネットワークタイプ: NFC */
    NETWORK_TYPE_NFC: 'NFC',
    /** ネットワークタイプ: Bluetooth */
    NETWORK_TYPE_BLUETOOTH: 'Bluetooth'
  },

  /**
   * Service Informationプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  serviceInformation: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'serviceinformation',

    // Parameter
    /** パラメータ: supports */
    PARAM_SUPPORTS: 'supports',
    /** パラメータ: connect */
    PARAM_CONNECT: 'connect',
    /** パラメータ: wifi */
    PARAM_WIFI: 'wifi',
    /** パラメータ: bluetooth */
    PARAM_BLUETOOTH: 'bluetooth',
    /** パラメータ: nfc */
    PARAM_NFC: 'nfc',
    /** パラメータ: ble */
    PARAM_BLE: 'ble'
  },

  /**
   * Notificationプロファイルの定数
   * @namespace
   * @type {Object.<String, (String|Number)>}
   */
  notification: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'notification',

    // Attribute
    /** アトリビュート: notify */
    ATTR_NOTIFY: 'notify',
    /** アトリビュート: onclick */
    ATTR_ON_CLICK: 'onclick',
    /** アトリビュート: onclose */
    ATTR_ON_CLOSE: 'onclose',
    /** アトリビュート: onerror */
    ATTR_ON_ERROR: 'onerror',
    /** アトリビュート: onshow */
    ATTR_ON_SHOW: 'onshow',

    // Parameter
    /** パラメータ: body */
    PARAM_BODY: 'body',
    /** パラメータ: type */
    PARAM_TYPE: 'type',
    /** パラメータ: dir */
    PARAM_DIR: 'dir',
    /** パラメータ: lang */
    PARAM_LANG: 'lang',
    /** パラメータ: tag */
    PARAM_TAG: 'tag',
    /** パラメータ: icon */
    PARAM_ICON: 'icon',
    /** パラメータ: notificationId */
    PARAM_NOTIFICATION_ID: 'notificationId',

    // ===== 通知タイプ定数 =====
    /** 通知タイプ: 音声通話着信 */
    NOTIFICATION_TYPE_PHONE: 0,
    /** 通知タイプ: メール着信 */
    NOTIFICATION_TYPE_MAIL: 1,
    /** 通知タイプ: SMS着信 */
    NOTIFICATION_TYPE_SMS: 2,
    /** 通知タイプ: イベント */
    NOTIFICATION_TYPE_EVENT: 3,

    // ===== 向き =====
    /** 向き: 自動 */
    DIRECTION_AUTO: 'auto',
    /** 向き: 右から左 */
    DIRECTION_RIGHT_TO_LEFT: 'rtl',
    /** 向き: 左から右 */
    DIRECTION_LEFT_TO_RIGHT: 'ltr'
  },

  /**
   * Phoneプロファイルの定数
   * @namespace
   * @type {Object.<String, (String|Number)>}
   */
  phone: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'phone',

    // Attribute
    /** アトリビュート: call */
    ATTR_CALL: 'call',
    /** アトリビュート: set */
    ATTR_SET: 'set',
    /** アトリビュート: onconnect */
    ATTR_ON_CONNECT: 'onconnect',

    // Parameter
    /** パラメータ: phoneNumber */
    PARAM_PHONE_NUMBER: 'phoneNumber',
    /** パラメータ: mode */
    PARAM_MODE: 'mode',
    /** パラメータ: phoneStatus */
    PARAM_PHONE_STATUS: 'phoneStatus',
    /** パラメータ: state */
    PARAM_STATE: 'state',

    // ===== 電話のモード定数 =====
    /** 電話のモード: サイレントモード */
    PHONE_MODE_SILENT: 0,
    /** 電話のモード: マナーモード */
    PHONE_MODE_MANNER: 1,
    /** 電話のモード: 音あり */
    PHONE_MODE_SOUND: 2,

    // ===== 通話状態定数 =====
    /** 通話状態: 通話開始 */
    CALL_STATE_START: 0,
    /** 通話状態: 通話失敗 */
    CALL_STATE_FAILED: 1,
    /** 通話状態: 通話終了 */
    CALL_STATE_FINISHED: 2
  },

  /**
   * Proximityプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  proximity: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'proximity',

    // Attribute
    /** アトリビュート: ondeviceproximity */
    ATTR_ON_DEVICE_PROXIMITY: 'ondeviceproximity',
    /** アトリビュート: onuserproximity */
    ATTR_ON_USER_PROXIMITY: 'onuserproximity',

    // Parameter
    /** パラメータ: value */
    PARAM_VALUE: 'value',
    /** パラメータ: min */
    PARAM_MIN: 'min',
    /** パラメータ: max */
    PARAM_MAX: 'max',
    /** パラメータ: threshold */
    PARAM_THRESHOLD: 'threshold',
    /** パラメータ: proximity */
    PARAM_PROXIMITY: 'proximity',
    /** パラメータ: near */
    PARAM_NEAR: 'near'
  },

  /**
   * Settingプロファイルの定数
   * @namespace
   * @type {Object.<String, (String|Number)>}
   */
  setting: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'setting',

    // Interface
    /** インターフェース: sound */
    INTERFACE_SOUND: 'sound',
    /** インターフェース: display */
    INTERFACE_DISPLAY: 'display',

    // Attribute
    /** アトリビュート: volume */
    ATTR_VOLUME: 'volume',
    /** アトリビュート: date */
    ATTR_DATE: 'date',
    /** アトリビュート: brightness */
    ATTR_BRIGHTNESS: 'brightness',
    /** アトリビュート: sleep */
    ATTR_SLEEP: 'sleep',

    // Parameter
    /** パラメータ: kind */
    PARAM_KIND: 'kind',
    /** パラメータ: level */
    PARAM_LEVEL: 'level',
    /** パラメータ: date */
    PARAM_DATE: 'date',
    /** パラメータ: time */
    PARAM_TIME: 'time',

    // ===== 最大最小 =====
    /** 最大Level */
    MAX_LEVEL: 1.0,
    /** 最小Level */
    MIN_LEVEL: 0,

    // ===== 音量の種別定数 =====
    /** 音量の種別定数: アラーム */
    VOLUME_KIND_ALARM: 1,
    /** 音量の種別定数: 通話音 */
    VOLUME_KIND_CALL: 2,
    /** 音量の種別定数: 着信音 */
    VOLUME_KIND_RINGTONE: 3,
    /** 音量の種別定数: メール着信音 */
    VOLUME_KIND_MAIL: 4,
    /** 音量の種別定数: メディアプレーヤーの音量 */
    VOLUME_KIND_MEDIA_PLAYER: 5,
    /** 音量の種別定数: その他SNS等の着信音 */
    VOLUME_KIND_OTHER: 6
  },

  /**
   * Systemプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  system: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'system',

    // Interface
    /** インターフェース: device */
    INTERFACE_DEVICE: 'device',

    // Attribute
    /** アトリビュート: events */
    ATTRI_EVENTS: 'events',
    /** アトリビュート: keyword */
    ATTRI_KEYWORD: 'keyword',
    /** アトリビュート: wakeup */
    ATTRI_WAKEUP: 'wakeup',

    // Parameter
    /** パラメータ: supports */
    PARAM_SUPPORTS: 'supports',
    /** パラメータ: version */
    PARAM_VERSION: 'version',
    /** パラメータ: id */
    PARAM_ID: 'id',
    /** パラメータ: name */
    PARAM_NAME: 'name',
    /** パラメータ: plugins */
    PARAM_PLUGINS: 'plugins',
    /** パラメータ: pluginId */
    PARAM_PLUGIN_ID: 'pluginId'
  },

  /**
   * Touchプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  touch: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'touch',

    // Attribute
    /** アトリビュート: ontouch */
    ATTR_ON_TOUCH: 'ontouch',
    /** アトリビュート: ontouchstart */
    ATTR_ON_TOUCH_START: 'ontouchstart',
    /** アトリビュート: ontouchend */
    ATTR_ON_TOUCH_END: 'ontouchend',
    /** アトリビュート: ontouchmove */
    ATTR_ON_TOUCH_MOVE: 'ontouchmove',
    /** アトリビュート: ontouchcancel */
    ATTR_ON_TOUCH_CANCEL: 'ontouchcancel',
    /** アトリビュート: ondoubletap */
    ATTR_ON_DOUBLE_TAP: 'ondoubletap',
    /** アトリビュート: ontouchchange */
    ATTR_ON_TOUCH_CHANGE: 'ontouchchange',

    // Parameter
    /** パラメータ: touch */
    PARAM_TOUCH: 'touch',
    /** パラメータ: touches */
    PARAM_TOUCHES: 'touches',
    /** パラメータ: id */
    PARAM_ID: 'id',
    /** パラメータ: x */
    PARAM_X: 'x',
    /** パラメータ: y */
    PARAM_Y: 'y'
  },

  /**
   * Vibrationプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  vibration: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'vibration',

    // Attribute
    /** アトリビュート: vibrate */
    ATTR_VIBRATE: 'vibrate',

    // Parameter
    /** パラメータ: pattern。 */
    PARAM_PATTERN: 'pattern'
  },
  /**
   * Canvasプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  canvas: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'canvas',

    // Attribute
    /** アトリビュート: drawimage */
    ATTR_DRAWIMAGE: 'drawimage',

    // Parameter
    /** パラメータ: mimeType */
    PARAM_MIME_TYPE: 'mimeType',
    /** パラメータ: data */
    PARAM_DATA: 'data',
    /** パラメータ: x */
    PARAM_X: 'x',
    /** パラメータ: y */
    PARAM_Y: 'y',
    /** パラメータ: mode */
    PARAM_MODE: 'mode',

    /** モードフラグ：スケールモード */
    MODE_SCALES: 'scales',

    /** モードフラグ：フィルモード */
    MODE_FILLS: 'fills'
  },
  /**
   * Geolocationプロファイルの定数
   * @namespace
   * @type {Object.<String, String>}
   */
  geolocation: {
    // Profile name
    /** プロファイル名。 */
    PROFILE_NAME: 'geolocation',

    // Attribute
    /** アトリビュート: currentposition */
    ATTR_CURRENT_POSITION: 'currentposition',
    /** アトリビュート: onwatchposition */
    ATTR_ON_WATCH_POSITION: 'onwatchposition',

    // Parameter
    /** パラメータ: position */
    PARAM_POSITION: 'position',
    /** パラメータ: coordinates */
    PARAM_COORDINATES: 'coordinates',
    /** パラメータ: latitude */
    PARAM_LATITUDE: 'latitude',
    /** パラメータ: longitude */
    PARAM_LONGNITUDE: 'longitude',
    /** パラメータ: altitude */
    PARAM_ALTITUDE: 'altitude',
    /** パラメータ: accuracy */
    PARAM_ACCURACY: 'accuracy',
    /** パラメータ: altitudeAccuracy */
    PARAM_ALTITUDE_ACCURACY: 'altitudeAccuracy',
    /** パラメータ: heading */
    PARAM_HEADING: 'heading',
    /** パラメータ: speed */
    PARAM_SPEED: 'speed',
    /** パラメータ: timeStamp */
    PARAM_TIME_STAMP: 'timeStamp',
    /** パラメータ: timeStampString */
    PARAM_TIME_STAMP_STRING: 'timeStampString'
  }
};

// let url = "http://hogege.jp/check.php?age=98&accessToken=120&height=148"
// let new_url = url.replace(/accessToken=(.*?)(&|$)/,"");
// console.log("new :" + new_url);

/*
 A JavaScript implementation of the SHA family of hashes, as
 defined in FIPS PUB 180-2 as well as the corresponding HMAC implementation
 as defined in FIPS PUB 198a

 Copyright Brian Turek 2008-2013
 Distributed under the BSD License
 See http://caligatio.github.com/jsSHA/ for more information

 Several functions taken from Paul Johnston
 */
(function(T) {
  function z(a, c, b) {
    var g = 0, f = [0], h = '', l = null, h = b || 'UTF8';
    if ('UTF8' !== h && 'UTF16' !== h)
      throw 'encoding must be UTF8 or UTF16';
    if ('HEX' === c) {
      if (0 !== a.length % 2)
        throw 'srcString of HEX type must be in byte increments';
      l = B(a);
      g = l.binLen;
      f = l.value
    } else if ('ASCII' === c || 'TEXT' === c)
      l = J(a, h), g = l.binLen, f = l.value;
    else if ('B64' === c)
      l = K(a), g = l.binLen, f = l.value;
    else
      throw 'inputFormat must be HEX, TEXT, ASCII, or B64';
    this.getHash = function(a, c, b, h) {
      let l = null, d = f.slice(), n = g, p;
      3 === arguments.length ? 'number' !== typeof b && ( h = b, b = 1) : 2 === arguments.length && ( b = 1);
      if (b !== parseInt(b, 10) || 1 > b)
        throw 'numRounds must a integer >= 1';
      switch (c) {
        case 'HEX':
          l = L;
          break;
        case 'B64':
          l = M;
          break;
        default:
          throw 'format must be HEX or B64';
      }
      if ('SHA-1' === a)
        for (p = 0; p < b; p++)
          d = y(d, n), n = 160;
      else if ('SHA-224' === a)
        for (p = 0; p < b; p++)
          d = v(d, n, a), n = 224;
      else if ('SHA-256' === a)
        for (p = 0; p < b; p++)
          d = v(d, n, a), n = 256;
      else if ('SHA-384' === a)
        for (p = 0; p < b; p++)
          d = v(d, n, a), n = 384;
      else if ('SHA-512' === a)
        for (p = 0; p < b; p++)
          d = v(d, n, a), n = 512;
      else
        throw 'Chosen SHA variant is not supported';
      return l(d, N(h))
    };
    this.getHMAC = function(a, b, c, l, s) {
      let d, n, p, m, w = [], x = [];
      d = null;
      switch (l) {
        case 'HEX':
          l = L;
          break;
        case 'B64':
          l = M;
          break;
        default:
          throw 'outputFormat must be HEX or B64';
      }
      if ('SHA-1' === c)
        n = 64, m = 160;
      else if ('SHA-224' === c)
        n = 64, m = 224;
      else if ('SHA-256' === c)
        n = 64, m = 256;
      else if ('SHA-384' === c)
        n = 128, m = 384;
      else if ('SHA-512' === c)
        n = 128, m = 512;
      else
        throw 'Chosen SHA variant is not supported';
      if ('HEX' === b)
        d = B(a), p = d.binLen, d = d.value;
      else if ('ASCII' === b || 'TEXT' === b)
        d = J(a, h), p = d.binLen, d = d.value;
      else if ('B64' === b)
        d = K(a), p = d.binLen, d = d.value;
      else
        throw 'inputFormat must be HEX, TEXT, ASCII, or B64';
      a = 8 * n;
      b = n / 4 - 1;
      n < p / 8 ? ( d = 'SHA-1' === c ? y(d, p) : v(d, p, c), d[b] &= 4294967040) : n > p / 8 && (d[b] &= 4294967040);
      for (n = 0; n <= b; n += 1)
        w[n] = d[n] ^ 909522486, x[n] = d[n] ^ 1549556828;
      c = 'SHA-1' === c ? y(x.concat(y(w.concat(f), a + g)), a + m) : v(x.concat(v(w.concat(f), a + g, c)), a + m, c);
      return l(c, N(s))
    }
  }

  function s(a, c) {
    this.a = a;
    this.b = c
  }

  function J(a, c) {
    let b = [], g, f = [], h = 0, l;
    if ('UTF8' === c)
      for (l = 0; l < a.length; l += 1)
        for (g = a.charCodeAt(l), f = [], 2048 < g ? (f[0] = 224 | (g & 61440) >>> 12, f[1] = 128 | (g & 4032) >>> 6, f[2] = 128 | g & 63) : 128 < g ? (f[0] = 192 | (g & 1984) >>> 6, f[1] = 128 | g & 63) : f[0] = g, g = 0; g < f.length; g += 1)
          b[h >>> 2] |= f[g] << 24 - h % 4 * 8, h += 1;
    else if ('UTF16' === c)
      for (l = 0; l < a.length; l += 1)
        b[h >>> 2] |= a.charCodeAt(l) << 16 - h % 4 * 8, h += 2;
    return {
      value: b,
      binLen: 8 * h
    }
  }

  function B(a) {
    let c = [], b = a.length, g, f;
    if (0 !== b % 2)
      throw 'String of HEX type must be in byte increments';
    for (g = 0; g < b; g += 2) {
      f = parseInt(a.substr(g, 2), 16);
      if (isNaN(f))
        throw 'String of HEX type contains invalid characters';
      c[g >>> 3] |= f << 24 - g % 8 * 4
    }
    return {
      value: c,
      binLen: 4 * b
    }
  }

  function K(a) {
    let c = [], b = 0, g, f, h, l, r;
    if (-1 === a.search(/^[a-zA-Z0-9=+\/]+$/))
      throw 'Invalid character in base-64 string';
    g = a.indexOf('=');
    a = a.replace(/\=/g, '');
    if (-1 !== g && g < a.length)
      throw 'Invalid \'=\' found in base-64 string';
    for (f = 0; f < a.length; f += 4) {
      r = a.substr(f, 4);
      for (h = l = 0; h < r.length; h += 1)
        g = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(r[h]), l |= g << 18 - 6 * h;
      for (h = 0; h < r.length - 1; h += 1)
        c[b >> 2] |= (l >>> 16 - 8 * h & 255) << 24 - b % 4 * 8, b += 1
    }
    return {
      value: c,
      binLen: 8 * b
    }
  }

  function L(a, c) {
    let b = '', g = 4 * a.length, f, h;
    for (f = 0; f < g; f += 1)
      h = a[f >>> 2] >>> 8 * (3 - f % 4), b += '0123456789abcdef'.charAt(h >>> 4 & 15) + '0123456789abcdef'.charAt(h & 15);
    return c.outputUpper ? b.toUpperCase() : b
  }

  function M(a, c) {
    let b = '', g = 4 * a.length, f, h, l;
    for (f = 0; f < g; f += 3)
      for (l = (a[f >>> 2] >>> 8 * (3 - f % 4) & 255) << 16 | (a[f + 1 >>> 2] >>> 8 * (3 - (f + 1) % 4) & 255) << 8 | a[f + 2 >>> 2] >>> 8 * (3 - (f + 2) % 4) & 255, h = 0; 4 > h; h += 1)
        b = 8 * f + 6 * h <= 32 * a.length ? b + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.charAt(l >>> 6 * (3 - h) & 63) : b + c.b64Pad;
    return b
  }

  function N(a) {
    let c = {
      outputUpper: !1,
      b64Pad: '='
    };
    try {
      a.hasOwnProperty('outputUpper') && (c.outputUpper = a.outputUpper), a.hasOwnProperty('b64Pad') && (c.b64Pad = a.b64Pad)
    } catch (b) {
    }
    if ('boolean' !== typeof c.outputUpper)
      throw 'Invalid outputUpper formatting option';
    if ('string' !== typeof c.b64Pad)
      throw 'Invalid b64Pad formatting option';
    return c
  }

  function U(a, c) {
    return a << c | a >>> 32 - c
  }

  function u(a, c) {
    return a >>> c | a << 32 - c
  }

  function t(a, c) {
    var b = null, b = new s(a.a, a.b);
    return b = 32 >= c ? new s(b.a >>> c | b.b << 32 - c & 4294967295, b.b >>> c | b.a << 32 - c & 4294967295) : new s(b.b >>> c - 32 | b.a << 64 - c & 4294967295, b.a >>> c - 32 | b.b << 64 - c & 4294967295)
  }

  function O(a, c) {
    let b = null;
    return b = 32 >= c ? new s(a.a >>> c, a.b >>> c | a.a << 32 - c & 4294967295) : new s(0, a.a >>> c - 32)
  }

  function V(a, c, b) {
    return a ^ c ^ b
  }

  function P(a, c, b) {
    return a & c ^ ~a & b
  }

  function W(a, c, b) {
    return new s(a.a & c.a ^ ~a.a & b.a, a.b & c.b ^ ~a.b & b.b)
  }

  function Q(a, c, b) {
    return a & c ^ a & b ^ c & b
  }

  function X(a, c, b) {
    return new s(a.a & c.a ^ a.a & b.a ^ c.a & b.a, a.b & c.b ^ a.b & b.b ^ c.b & b.b)
  }

  function Y(a) {
    return u(a, 2) ^ u(a, 13) ^ u(a, 22)
  }

  function Z(a) {
    let c = t(a, 28), b = t(a, 34);
    a = t(a, 39);
    return new s(c.a ^ b.a ^ a.a, c.b ^ b.b ^ a.b)
  }

  function $(a) {
    return u(a, 6) ^ u(a, 11) ^ u(a, 25)
  }

  function aa(a) {
    let c = t(a, 14), b = t(a, 18);
    a = t(a, 41);
    return new s(c.a ^ b.a ^ a.a, c.b ^ b.b ^ a.b)
  }

  function ba(a) {
    return u(a, 7) ^ u(a, 18) ^ a >>> 3
  }

  function ca(a) {
    let c = t(a, 1), b = t(a, 8);
    a = O(a, 7);
    return new s(c.a ^ b.a ^ a.a, c.b ^ b.b ^ a.b)
  }

  function da(a) {
    return u(a, 17) ^ u(a, 19) ^ a >>> 10
  }

  function ea(a) {
    let c = t(a, 19), b = t(a, 61);
    a = O(a, 6);
    return new s(c.a ^ b.a ^ a.a, c.b ^ b.b ^ a.b)
  }

  function R(a, c) {
    let b = (a & 65535) + (c & 65535);
    return ((a >>> 16) + (c >>> 16) + (b >>> 16) & 65535) << 16 | b & 65535
  }

  function fa(a, c, b, g) {
    let f = (a & 65535) + (c & 65535) + (b & 65535) + (g & 65535);
    return ((a >>> 16) + (c >>> 16) + (b >>> 16) + (g >>> 16) + (f >>> 16) & 65535) << 16 | f & 65535
  }

  function S(a, c, b, g, f) {
    let h = (a & 65535) + (c & 65535) + (b & 65535) + (g & 65535) + (f & 65535);
    return ((a >>> 16) + (c >>> 16) + (b >>> 16) + (g >>> 16) + (f >>> 16) + (h >>> 16) & 65535) << 16 | h & 65535
  }

  function ga(a, c) {
    let b, g, f;
    b = (a.b & 65535) + (c.b & 65535);
    g = (a.b >>> 16) + (c.b >>> 16) + (b >>> 16);
    f = (g & 65535) << 16 | b & 65535;
    b = (a.a & 65535) + (c.a & 65535) + (g >>> 16);
    g = (a.a >>> 16) + (c.a >>> 16) + (b >>> 16);
    return new s((g & 65535) << 16 | b & 65535, f)
  }

  function ha(a, c, b, g) {
    let f, h, l;
    f = (a.b & 65535) + (c.b & 65535) + (b.b & 65535) + (g.b & 65535);
    h = (a.b >>> 16) + (c.b >>> 16) + (b.b >>> 16) + (g.b >>> 16) + (f >>> 16);
    l = (h & 65535) << 16 | f & 65535;
    f = (a.a & 65535) + (c.a & 65535) + (b.a & 65535) + (g.a & 65535) + (h >>> 16);
    h = (a.a >>> 16) + (c.a >>> 16) + (b.a >>> 16) + (g.a >>> 16) + (f >>> 16);
    return new s((h & 65535) << 16 | f & 65535, l)
  }

  function ia(a, c, b, g, f) {
    let h, l, r;
    h = (a.b & 65535) + (c.b & 65535) + (b.b & 65535) + (g.b & 65535) + (f.b & 65535);
    l = (a.b >>> 16) + (c.b >>> 16) + (b.b >>> 16) + (g.b >>> 16) + (f.b >>> 16) + (h >>> 16);
    r = (l & 65535) << 16 | h & 65535;
    h = (a.a & 65535) + (c.a & 65535) + (b.a & 65535) + (g.a & 65535) + (f.a & 65535) + (l >>> 16);
    l = (a.a >>> 16) + (c.a >>> 16) + (b.a >>> 16) + (g.a >>> 16) + (f.a >>> 16) + (h >>> 16);
    return new s((l & 65535) << 16 | h & 65535, r)
  }

  function y(a, c) {
    let b = [], g, f, h, l, r, s, u = P, t = V, v = Q, d = U, n = R, p, m, w = S, x, q = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
    a[c >>> 5] |= 128 << 24 - c % 32;
    a[(c + 65 >>> 9 << 4) + 15] = c;
    x = a.length;
    for (p = 0; p < x; p += 16) {
      g = q[0];
      f = q[1];
      h = q[2];
      l = q[3];
      r = q[4];
      for (m = 0; 80 > m; m += 1)
        b[m] = 16 > m ? a[m + p] : d(b[m - 3] ^ b[m - 8] ^ b[m - 14] ^ b[m - 16], 1), s = 20 > m ? w(d(g, 5), u(f, h, l), r, 1518500249, b[m]) : 40 > m ? w(d(g, 5), t(f, h, l), r, 1859775393, b[m]) : 60 > m ? w(d(g, 5), v(f, h, l), r, 2400959708, b[m]) : w(d(g, 5), t(f, h, l), r, 3395469782, b[m]), r = l, l = h, h = d(f, 30), f = g, g = s;
      q[0] = n(g, q[0]);
      q[1] = n(f, q[1]);
      q[2] = n(h, q[2]);
      q[3] = n(l, q[3]);
      q[4] = n(r, q[4])
    }
    return q
  }

  function v(a, c, b) {
    let g, f, h, l, r, t, u, v, z, d, n, p, m, w, x, q, y, C, D, E, F, G, H, I, e, A = [], B, k = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298];
    d = [3238371032, 914150663, 812702999, 4144912697, 4290775857, 1750603025, 1694076839, 3204075428];
    f = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
    if ('SHA-224' === b || 'SHA-256' === b)
      n = 64, g = (c + 65 >>> 9 << 4) + 15, w = 16, x = 1, e = Number, q = R, y = fa, C = S, D = ba, E = da, F = Y, G = $, I = Q, H = P, d = 'SHA-224' === b ? d : f;
    else if ('SHA-384' === b || 'SHA-512' === b)
      n = 80, g = (c + 128 >>> 10 << 5) + 31, w = 32, x = 2, e = s, q = ga, y = ha, C = ia, D = ca, E = ea, F = Z, G = aa, I = X, H = W, k = [new e(k[0], 3609767458), new e(k[1], 602891725), new e(k[2], 3964484399), new e(k[3], 2173295548), new e(k[4], 4081628472), new e(k[5], 3053834265), new e(k[6], 2937671579), new e(k[7], 3664609560), new e(k[8], 2734883394), new e(k[9], 1164996542), new e(k[10], 1323610764), new e(k[11], 3590304994), new e(k[12], 4068182383), new e(k[13], 991336113), new e(k[14], 633803317), new e(k[15], 3479774868), new e(k[16], 2666613458), new e(k[17], 944711139), new e(k[18], 2341262773), new e(k[19], 2007800933), new e(k[20], 1495990901), new e(k[21], 1856431235), new e(k[22], 3175218132), new e(k[23], 2198950837), new e(k[24], 3999719339), new e(k[25], 766784016), new e(k[26], 2566594879), new e(k[27], 3203337956), new e(k[28], 1034457026), new e(k[29], 2466948901), new e(k[30], 3758326383), new e(k[31], 168717936), new e(k[32], 1188179964), new e(k[33], 1546045734), new e(k[34], 1522805485), new e(k[35], 2643833823), new e(k[36], 2343527390), new e(k[37], 1014477480), new e(k[38], 1206759142), new e(k[39], 344077627), new e(k[40], 1290863460), new e(k[41], 3158454273), new e(k[42], 3505952657), new e(k[43], 106217008), new e(k[44], 3606008344), new e(k[45], 1432725776), new e(k[46], 1467031594), new e(k[47], 851169720), new e(k[48], 3100823752), new e(k[49], 1363258195), new e(k[50], 3750685593), new e(k[51], 3785050280), new e(k[52], 3318307427), new e(k[53], 3812723403), new e(k[54], 2003034995), new e(k[55], 3602036899), new e(k[56], 1575990012), new e(k[57], 1125592928), new e(k[58], 2716904306), new e(k[59], 442776044), new e(k[60], 593698344), new e(k[61], 3733110249), new e(k[62], 2999351573), new e(k[63], 3815920427), new e(3391569614, 3928383900), new e(3515267271, 566280711), new e(3940187606, 3454069534), new e(4118630271, 4000239992), new e(116418474, 1914138554), new e(174292421, 2731055270), new e(289380356, 3203993006), new e(460393269, 320620315), new e(685471733, 587496836), new e(852142971, 1086792851), new e(1017036298, 365543100), new e(1126000580, 2618297676), new e(1288033470, 3409855158), new e(1501505948, 4234509866), new e(1607167915, 987167468), new e(1816402316, 1246189591)], d = 'SHA-384' === b ? [new e(3418070365, d[0]), new e(1654270250, d[1]), new e(2438529370, d[2]), new e(355462360, d[3]), new e(1731405415, d[4]), new e(41048885895, d[5]), new e(3675008525, d[6]), new e(1203062813, d[7])] : [new e(f[0], 4089235720), new e(f[1], 2227873595), new e(f[2], 4271175723), new e(f[3], 1595750129), new e(f[4], 2917565137), new e(f[5], 725511199), new e(f[6], 4215389547), new e(f[7], 327033209)];
    else
      throw 'Unexpected error in SHA-2 implementation';
    a[c >>> 5] |= 128 << 24 - c % 32;
    a[g] = c;
    B = a.length;
    for (p = 0; p < B; p += w) {
      c = d[0];
      g = d[1];
      f = d[2];
      h = d[3];
      l = d[4];
      r = d[5];
      t = d[6];
      u = d[7];
      for (m = 0; m < n; m += 1)
        A[m] = 16 > m ? new e(a[m * x + p], a[m * x + p + 1]) : y(E(A[m - 2]), A[m - 7], D(A[m - 15]), A[m - 16]), v = C(u, G(l), H(l, r, t), k[m], A[m]), z = q(F(c), I(c, g, f)), u = t, t = r, r = l, l = q(h, v), h = f, f = g, g = c, c = q(v, z);
      d[0] = q(c, d[0]);
      d[1] = q(g, d[1]);
      d[2] = q(f, d[2]);
      d[3] = q(h, d[3]);
      d[4] = q(l, d[4]);
      d[5] = q(r, d[5]);
      d[6] = q(t, d[6]);
      d[7] = q(u, d[7])
    }
    if ('SHA-224' === b)
      a = [d[0], d[1], d[2], d[3], d[4], d[5], d[6]];
    else if ('SHA-256' === b)
      a = d;
    else if ('SHA-384' === b)
      a = [d[0].a, d[0].b, d[1].a, d[1].b, d[2].a, d[2].b, d[3].a, d[3].b, d[4].a, d[4].b, d[5].a, d[5].b];
    else if ('SHA-512' === b)
      a = [d[0].a, d[0].b, d[1].a, d[1].b, d[2].a, d[2].b, d[3].a, d[3].b, d[4].a, d[4].b, d[5].a, d[5].b, d[6].a, d[6].b, d[7].a, d[7].b];
    else
      throw 'Unexpected error in SHA-2 implementation';
    return a
  }


  'function' === typeof define && typeof define.amd ? define(function() {
    return z
  }) : 'undefined' !== typeof exports ? 'undefined' !== typeof module && module.exports ? module.exports = exports = z : exports = z : T.jsSHA = z
})(this);
