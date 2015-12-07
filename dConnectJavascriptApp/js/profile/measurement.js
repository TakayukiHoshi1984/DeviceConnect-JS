/**
 measurement.js
 Copyright (c) 2015 NTT DOCOMO,INC.
 Released under the MIT license
 http://opensource.org/licenses/mit-license.php
 */

/**
 * Measurement
 */
function showMeasurement(serviceId) {
  initAll();
  setTitle('Measurement Profile');

  var sessionKey = currentClientId;
  var btnStr = getBackButton('Device Top', 'doMeasurementBack', serviceId,
                 sessionKey);
  reloadHeader(btnStr);
  reloadFooter(btnStr);

  var str = '';
  str += '<li><a href="javascript:showGetTest(\'' + serviceId +
            '\');" >Show GET Test</a></li>';
  str += '<li><a href="javascript:showPostTest(\'' + serviceId +
            '\');" >Show POST Test</a></li>';
  str += '<li><a href="javascript:showEventTest(\'' + serviceId +
            '\');" >Show Event Test</a></li>';
  reloadList(str);
}

/**
 * Show GET Test
 *
 * @param {String}serviceId サービスID
 */
function showGetTest(serviceId) {
  initAll();
  setTitle('Show GET Test');

  var sessionKey = currentClientId;

  var btnStr = getBackButton('Measurement Top', 'doGetTestBack', serviceId, sessionKey);
  reloadHeader(btnStr);
  reloadFooter(btnStr);

  var str = '';
  str += '<form name="GetTestForm">';
  str += 'GET Test<br>';
  str += '<input type="button" name="getButton" id="getButton" value="Get"' +
           ' onclick="doGetTest(\'' + serviceId + '\');"/>';
  str += '<input type="text" id="measureG1" width="100%">';
  str += '<input type="text" id="measureG2" width="100%">';
  str += '<input type="text" id="measureG3" width="100%">';
  str += '<input type="text" id="measureG4" width="100%">';
  str += '</form>';
  reloadContent(str);
}

/**
 * Get Test
 *
 * @param {String}serviceId サービスID
 */
function doGetTest(serviceId) {

  var sum_point_gA = 0;
  var sum_point_gB = 0;
  var sum_point_gC = 0;
  var sum_point_gD = 0;
  $('#measureG1').val('');
  $('#measureG2').val('');
  $('#measureG3').val('');
  $('#measureG4').val('');

  for (var i = 0; i < 50; i++) {
    var date = new Date();
    var builder = new dConnect.URIBuilder();
    builder.setProfile('measurement');
    builder.setServiceId(serviceId);
    builder.setAccessToken(accessToken);
    builder.setAttribute('gettest');
    builder.addParameter('request_time', date.getTime());
    var uri = builder.build();
    if (DEBUG) {
      console.log('Uri: ' + uri);
    }

    dConnect.get(uri, null, function(json) {
      date = new Date();
      var now_time = date.getTime();
      
      if (DEBUG) {
        console.log('Response: ', json);
      }

      if (json) {
        var request_time = Number(json.request_time);
        var mgr_request_time = Number(json.mgr_request_time);
        var plugin_response_time = Number(json.plugin_response_time);
        var mgr_response_time = Number(json.mgr_response_time);
        sum_point_gA = sum_point_gA + (mgr_request_time - request_time);
        sum_point_gB = sum_point_gB + (plugin_response_time - mgr_request_time);
        sum_point_gC = sum_point_gC + (mgr_response_time - plugin_response_time);
        sum_point_gD = sum_point_gD + (now_time - mgr_response_time);
        $('#measureG1').val('measure1: ' + (sum_point_gA / (i + 1)));
        $('#measureG2').val('measure2: ' + (sum_point_gB / (i + 1)));
        $('#measureG3').val('measure3: ' + (sum_point_gC / (i + 1)));
        $('#measureG4').val('measure4: ' + (sum_point_gD / (i + 1)));
      }
    }, function(errorCode, errorMessage) {
      showError('GET Test', errorCode, errorMessage);
    });
  }

  closeLoading();

}

/**
 * Show POST Test
 *
 * @param {String}serviceId サービスID
 */
function showPostTest(serviceId) {
  initAll();
  setTitle('Show POST Test');

  var sessionKey = currentClientId;

  var btnStr = getBackButton('Measurement Top', 'doPostTestBack', serviceId, sessionKey);
  reloadHeader(btnStr);
  reloadFooter(btnStr);

  var str = '';
  str += '<form name="PostTestForm">';
  str += 'POST Test<br>';
  str += '<input type="button" name="postButton" id="postButton" value="Post"' +
           ' onclick="doPostTest(\'' + serviceId + '\');"/>';
  str += '<input type="text" id="measureP1" width="100%">';
  str += '<input type="text" id="measureP2" width="100%">';
  str += '<input type="text" id="measureP3" width="100%">';
  str += '<input type="text" id="measureP4" width="100%">';
  str += '</form>';
  reloadContent(str);
}

/**
 * Post Test
 *
 * @param {String}serviceId サービスID
 */
function doPostTest(serviceId) {

  var sum_point_pA = 0;
  var sum_point_pB = 0;
  var sum_point_pC = 0;
  var sum_point_pD = 0;
  $('#measureP1').val('');
  $('#measureP2').val('');
  $('#measureP3').val('');
  $('#measureP4').val('');

  for (var i = 0; i < 50; i++) {
    var date = new Date();
    var builder = new dConnect.URIBuilder();
    builder.setProfile('measurement');
    builder.setServiceId(serviceId);
    builder.setAccessToken(accessToken);
    builder.setAttribute('posttest');
    builder.addParameter('request_time', date.getTime());
    var uri = builder.build();
    if (DEBUG) {
      console.log('Uri: ' + uri);
    }

    dConnect.post(uri, null, null, function(json) {
      date = new Date();
      var now_time = date.getTime();
      
      if (DEBUG) {
        console.log('Response: ', json);
      }

      if (json) {
        var request_time = Number(json.request_time);
        var mgr_request_time = Number(json.mgr_request_time);
        var plugin_response_time = Number(json.plugin_response_time);
        var mgr_response_time = Number(json.mgr_response_time);
        sum_point_pA = sum_point_pA + (mgr_request_time - request_time);
        sum_point_pB = sum_point_pB + (plugin_response_time - mgr_request_time);
        sum_point_pC = sum_point_pC + (mgr_response_time - plugin_response_time);
        sum_point_pD = sum_point_pD + (now_time - mgr_response_time);
        $('#measureP1').val('measure1: ' + (sum_point_pA / (i + 1)));
        $('#measureP2').val('measure2: ' + (sum_point_pB / (i + 1)));
        $('#measureP3').val('measure3: ' + (sum_point_pC / (i + 1)));
        $('#measureP4').val('measure4: ' + (sum_point_pD / (i + 1)));
      }
    }, function(errorCode, errorMessage) {
      showError('POST Test', errorCode, errorMessage);
    });
  }

  closeLoading();

}

/**
 * Show Event Test
 *
 * @param {String}serviceId サービスID
 */
function showEventTest(serviceId) {
  initAll();
  setTitle('Event Test');

  var sessionKey = currentClientId;

  var btnStr = getBackButton('Measurement Top', 'doEventTestBack', serviceId,
                 sessionKey);
  reloadHeader(btnStr);
  reloadFooter(btnStr);

  var str = '';
  str += '<form name="eventtestForm">';
  str += 'Event<br>';
  str += '<input type="text" id="countE" width="100%">';
  str += '<input type="text" id="measureE1" width="100%">';
  str += '<input type="text" id="measureE2" width="100%">';
  str += '</form>';
  reloadContent(str);

  doEventRegist(serviceId, sessionKey);
  dConnect.connectWebSocket(sessionKey, function(errorCode, errorMessage) {});
}

/**
 * Backボタン
 *
 * serviceId サービスID
 * sessionKey セッションKEY
 */
function doMeasurementBack(serviceId, sessionKey) {
  searchSystem(serviceId);
}

/**
 * Backボタン
 *
 * serviceId サービスID
 * sessionKey セッションKEY
 */
function doGetTestBack(serviceId, sessionKey) {
  showMeasurement(serviceId);
}

/**
 * Backボタン
 *
 * serviceId サービスID
 * sessionKey セッションKEY
 */
function doPostTestBack(serviceId, sessionKey) {
  showMeasurement(serviceId);
}

/**
 * Backボタン
 *
 * serviceId サービスID
 * sessionKey セッションKEY
 */
function doEventTestBack(serviceId, sessionKey) {
  doEventUnregister(serviceId, sessionKey);
  showMeasurement(serviceId);
}

/**
 * Event Regist
 */
function doEventRegist(serviceId, sessionKey) {
  var count = 0;
  var sum_point_eA = 0;
  var sum_point_eB = 0;
  $('#countE').val('');
  $('#measureE1').val('');
  $('#measureE2').val('');

  var builder = new dConnect.URIBuilder();
  builder.setProfile('measurement');
  builder.setServiceId(serviceId);
  builder.setAccessToken(accessToken);
  builder.setSessionKey(sessionKey);
  builder.setAttribute('eventtest');
  builder.addParameter('interval', '3');
  var uri = builder.build();
  if (DEBUG) {
    console.log('Uri: ' + uri);
  }

  dConnect.addEventListener(uri, function(message) {
    // イベントメッセージが送られてくる
    var date = new Date();
    var now_time = date.getTime();
    if (DEBUG) {
      console.log('Event-Message:' + message)
    }

    var json = JSON.parse(message);
    if (json) {
      var plugin_event_time = Number(json.plugin_event_time);
      var mgr_event_time = Number(json.mgr_event_time);

      sum_point_eA = sum_point_eA + (mgr_event_time - plugin_event_time);
      sum_point_eB = sum_point_eB + (now_time - mgr_event_time);
      count++;
      $('#countE').val('count: ' + count);
      $('#measureE1').val('measure1: ' + (sum_point_eA / count));
      $('#measureE2').val('measure2: ' + (sum_point_eB / count));

    }
  }, null, function(errorCode, errorMessage) {
    alert(errorMessage);
  });
}

/**
 * Event Unregist
 */
function doEventUnregister(serviceId, sessionKey) {

  var builder = new dConnect.URIBuilder();
  builder.setProfile('measurement');
  builder.setServiceId(serviceId);
  builder.setAccessToken(accessToken);
  builder.setSessionKey(sessionKey);
  builder.setAttribute('eventtest');
  var uri = builder.build();
  if (DEBUG) {
    console.log('Uri : ' + uri);
  }

  dConnect.removeEventListener(uri, null, function(errorCode, errorMessage) {
    alert(errorMessage);
  });
}

