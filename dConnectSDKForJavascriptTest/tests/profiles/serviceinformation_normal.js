module('Service Information Profile Normal Test', {
  setup: function() {
    init();
  }
});

/**
 * ServiceInformationプロファイルの正常系テストを行うクラス。
 * @class
 */
var ServiceInformationProfileNormalTest = {};

/**
 * serviceinformationの対応プロファイル情報を取得する。
 * <p id="test">
 * 【HTTP通信】<br/>
 * Method: GET<br/>
 * Path: /serviceinformation?serviceId=xxxx<br/>
 * </p>
 * <p id="expected">
 * 【期待する動作】<br/>
 * ・resultに0が返ってくること。<br/>
 * </p>
 */
ServiceInformationProfileNormalTest.serviceInformationTest001 = function(assert) {
  if (EXPECTED_APIS === undefined) {
    assert.ok(false, 'Test bug: EXPECTED_APIS is undefined.');
    QUnit.start();
  }
  searchTestService(function(accessToken, serviceId) {
    var builder = new dConnect.URIBuilder();
    builder.setProfile(dConnect.constants.serviceinformation.PROFILE_NAME);
    builder.setServiceId(serviceId);
    builder.setAccessToken(accessToken);
    var uri = builder.build();
    dConnect.get(uri, null, function(json) {
      assert.ok(true, 'result=' + json.result);
      assert.ok(true, 'version=' + json.version);
      assert.ok(json.connect !== undefined, 'connect is defined.');
      assert.ok(json.supports !== undefined, 'supports is defined.');
      assert.ok(json.supportApis !== undefined, 'supportApis is defined.');

      // API仕様を過不足なく取得できていること
      for (var name in EXPECTED_APIS) {
        var spec = json.supportApis[name];
        for (var path in EXPECTED_APIS[name]) {
          for (var methodIndex in EXPECTED_APIS[name][path]) {
            var method = EXPECTED_APIS[name][path][methodIndex];
            assert.ok(spec.paths[path] !== undefined, method.toUpperCase() + ' /gotapi/' + name + ((path === '/') ? '' : path));
          }
        }
      }
      QUnit.start();
    }, function(errorCode, errorMessage) {
      assert.ok(checkErrorCode(errorCode), 'errorCode=' + errorCode + ' errorMessage=' + errorMessage);
      QUnit.start();
    });
  }, function(errorCode, errorMessage) {
    assert.ok(false, 'errorCode=' + errorCode + ', errorMessage=' + errorMessage);
    QUnit.start();
  });
};
QUnit.asyncTest('serviceInformationTest001(get)', ServiceInformationProfileNormalTest.serviceInformationTest001);