/**
 measurement.js
 Copyright (c) 2015 NTT DOCOMO,INC.
 Released under the MIT license
 http://opensource.org/licenses/mit-license.php
 */

var StartTimer, StopTimer, Timer, time, timerID;

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
  str += 'GET送信回数<br>';
  str += '<SELECT name="sendpatternG" id="sendpatternG">';
  str += '<OPTION value="50">50回</OPTION>';
  str += '<OPTION value="100">100回</OPTION>';
  str += '<OPTION value="500">500回</OPTION>';
  str += '</SELECT>';
  str += '<input type="button" name="getButton" id="getButton" value="Get"' +
           ' onclick="doGetTest(\'' + serviceId + '\');"/>';
  str += '<input type="text" id="countG" width="100%">';
  str += '<input type="text" id="measureG1" width="100%">';
  str += '<input type="text" id="measureG2" width="100%">';
  str += '<input type="text" id="measureG21" width="100%">';
  str += '<input type="text" id="measureG3" width="100%">';
  str += '<input type="text" id="measureG4" width="100%">';
  str += '</form>';
  reloadContent(str);
}

var sum_point_gA, sum_point_gB, sum_point_gC, sum_point_gD, sum_point_gE;
var min_point_gA, min_point_gB, min_point_gC, min_point_gD, min_point_gE;
var max_point_gA, max_point_gB, max_point_gC, max_point_gD, max_point_gE;
/**
 * Get Test Caller
 *
 * @param {String}serviceId サービスID
 */
function doGetTest(serviceId) {
  sum_point_gA = 0;
  sum_point_gB = 0;
  sum_point_gC = 0;
  sum_point_gD = 0;
  sum_point_gE = 0;
  min_point_gA = 0;
  min_point_gB = 0;
  min_point_gC = 0;
  min_point_gD = 0;
  min_point_gE = 0;
  max_point_gA = 0;
  max_point_gB = 0;
  max_point_gC = 0;
  max_point_gD = 0;
  max_point_gE = 0;
  time = 0;
  timerID = 0;

  $('#countG').val('');
  $('#measureG1').val('');
  $('#measureG2').val('');
  $('#measureG21').val('');
  $('#measureG3').val('');
  $('#measureG4').val('');

  var limit = $('#sendpatternG').val();

  StartTimer = function() {
    timerID = setInterval(Timer, 1000);
  };

  StopTimer = function() {
    clearInterval(timerID);
  };

  Timer = function() {
    if (time >= limit) {
      StopTimer();
      return alert("計測完了");
    }
    time = time + 1;
    console.log(time);
    doGetTestMain(serviceId)
  };

  StartTimer();
}

/**
 * Get Test Main
 *
 * @param {String}serviceId サービスID
 */
function doGetTestMain(serviceId) {

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
      var mgr_request_nanotime = Number(json.mgr_request_nanotime);
      var mgr_req_process_time = Number(json.mgr_req_process_time);
      var mgr_req_process_nanotime = Number(json.mgr_req_process_nanotime);
      var plugin_response_time = Number(json.plugin_response_time);
      var mgr_response_time = Number(json.mgr_response_time);
      var point_gA = mgr_request_time - request_time;
      var point_gB = plugin_response_time - mgr_request_time;
      var point_gC = mgr_response_time - plugin_response_time;
      var point_gD = now_time - mgr_response_time;
      var point_gE = mgr_req_process_nanotime - mgr_request_nanotime;

      if (time == 1) {
        min_point_gA = point_gA;
        min_point_gB = point_gB;
        min_point_gC = point_gC;
        min_point_gD = point_gD;
        min_point_gE = point_gE;
        max_point_gA = point_gA;
        max_point_gB = point_gB;
        max_point_gC = point_gC;
        max_point_gD = point_gD;
        max_point_gE = point_gE;
      } else {
        if (point_gA > max_point_gA ) {
          max_point_gA = point_gA;
        }
        if (point_gB > max_point_gB ) {
          max_point_gB = point_gB;
        }
        if (point_gC > max_point_gC ) {
          max_point_gC = point_gC;
        }
        if (point_gD > max_point_gD ) {
          max_point_gD = point_gD;
        }
        if (point_gE > max_point_gE ) {
          max_point_gE = point_gE;
        }

        if (point_gA < min_point_gA) {
          min_point_gA = point_gA;
        }
        if (point_gB < min_point_gB) {
          min_point_gB = point_gB;
        }
        if (point_gC < min_point_gC) {
          min_point_gC = point_gC;
        }
        if (point_gD < min_point_gD) {
          min_point_gD = point_gD;
        }
        if (point_gE < min_point_gE) {
          min_point_gE = point_gE;
        }
      }
      
      sum_point_gA = sum_point_gA + point_gA;
      sum_point_gB = sum_point_gB + point_gB;
      sum_point_gC = sum_point_gC + point_gC;
      sum_point_gD = sum_point_gD + point_gD;
      sum_point_gE = sum_point_gE + point_gE;
      $('#countG').val('count: ' + time);
      $('#measureG1').val('measure1: ' + (sum_point_gA / time) + ', min: ' + min_point_gA + ', max: ' + max_point_gA);
      $('#measureG2').val('measure2: ' + (sum_point_gB / time) + ', min: ' + min_point_gB + ', max: ' + max_point_gB);
      $('#measureG21').val('measure21(nanoSec): ' + (sum_point_gE / time) + ', min: ' + min_point_gE + ', max: ' + max_point_gE);
      $('#measureG3').val('measure3: ' + (sum_point_gC / time) + ', min: ' + min_point_gC + ', max: ' + max_point_gC);
      $('#measureG4').val('measure4: ' + (sum_point_gD / time) + ', min: ' + min_point_gD + ', max: ' + max_point_gD);
      if (DEBUG) {
        console.log('sum_point_gA: ', sum_point_gA);
        console.log('sum_point_gB: ', sum_point_gB);
        console.log('sum_point_gC: ', sum_point_gC);
        console.log('sum_point_gD: ', sum_point_gD);
        console.log('sum_point_gE: ', sum_point_gE);
      }
    }
  }, function(errorCode, errorMessage) {
    showError('GET Test', errorCode, errorMessage);
  });

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
  str += 'POST送信回数<br>';
  str += '<SELECT name="sendpatternP" id="sendpatternP">';
  str += '<OPTION value="50">50回</OPTION>';
  str += '<OPTION value="100">100回</OPTION>';
  str += '<OPTION value="500">500回</OPTION>';
  str += '</SELECT>';
  str += '<input type="button" name="postButton" id="postButton" value="Post"' +
           ' onclick="doPostTest(\'' + serviceId + '\');"/>';
  str += '<input type="text" id="countP" width="100%">';
  str += '<input type="text" id="measureP1" width="100%">';
  str += '<input type="text" id="measureP2" width="100%">';
  str += '<input type="text" id="measureP3" width="100%">';
  str += '<input type="text" id="measureP4" width="100%">';
  str += '</form>';
  reloadContent(str);
}

var sum_point_pA, sum_point_pB, sum_point_pC, sum_point_pD;
var min_point_pA, min_point_pB, min_point_pC, min_point_pD;
var max_point_pA, max_point_pB, max_point_pC, max_point_pD;
/**
 * Post Test Caller
 *
 * @param {String}serviceId サービスID
 */
function doPostTest(serviceId) {
  sum_point_pA = 0;
  sum_point_pB = 0;
  sum_point_pC = 0;
  sum_point_pD = 0;
  min_point_pA = 0;
  min_point_pB = 0;
  min_point_pC = 0;
  min_point_pD = 0;
  max_point_pA = 0;
  max_point_pB = 0;
  max_point_pC = 0;
  max_point_pD = 0;
  time = 0;
  timerID = 0;

  $('#countP').val('');
  $('#measureP1').val('');
  $('#measureP2').val('');
  $('#measureP3').val('');
  $('#measureP4').val('');

  var limit = $('#sendpatternP').val();

  StartTimer = function() {
    timerID = setInterval(Timer, 1000);
  };

  StopTimer = function() {
    clearInterval(timerID);
  };

  Timer = function() {
    if (time >= limit) {
      StopTimer();
      return alert("計測完了");
    }
    time = time + 1;
    console.log(time);
    doPostTestMain(serviceId)
  };

  StartTimer();
}

/**
 * Post Test Main
 *
 * @param {String}serviceId サービスID
 */
function doPostTestMain(serviceId) {

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
      var point_pA = mgr_request_time - request_time;
      var point_pB = plugin_response_time - mgr_request_time;
      var point_pC = mgr_response_time - plugin_response_time;
      var point_pD = now_time - mgr_response_time;

      if (time == 1) {
        min_point_pA = point_pA;
        min_point_pB = point_pB;
        min_point_pC = point_pC;
        min_point_pD = point_pD;
        max_point_pA = point_pA;
        max_point_pB = point_pB;
        max_point_pC = point_pC;
        max_point_pD = point_pD;
      } else {
        if (point_pA > max_point_pA ) {
          max_point_pA = point_pA;
        }
        if (point_pB > max_point_pB ) {
          max_point_pB = point_pB;
        }
        if (point_pC > max_point_pC ) {
          max_point_pC = point_pC;
        }
        if (point_pD > max_point_pD ) {
          max_point_pD = point_pD;
        }

        if (point_pA < min_point_pA) {
          min_point_pA = point_pA;
        }
        if (point_pB < min_point_pB) {
          min_point_pB = point_pB;
        }
        if (point_pC < min_point_pC) {
          min_point_pC = point_pC;
        }
        if (point_pD < min_point_pD) {
          min_point_pD = point_pD;
        }
      }
      
      sum_point_pA = sum_point_pA + point_pA;
      sum_point_pB = sum_point_pB + point_pB;
      sum_point_pC = sum_point_pC + point_pC;
      sum_point_pD = sum_point_pD + point_pD;
      $('#countP').val('count: ' + time);
      $('#measureP1').val('measure1: ' + (sum_point_pA / time) + ', min: ' + min_point_pA + ', max: ' + max_point_pA);
      $('#measureP2').val('measure2: ' + (sum_point_pB / time) + ', min: ' + min_point_pB + ', max: ' + max_point_pB);
      $('#measureP3').val('measure3: ' + (sum_point_pC / time) + ', min: ' + min_point_pC + ', max: ' + max_point_pC);
      $('#measureP4').val('measure4: ' + (sum_point_pD / time) + ', min: ' + min_point_pD + ', max: ' + max_point_pD);
      if (DEBUG) {
        console.log('sum_point_pA: ', sum_point_pA);
        console.log('sum_point_pB: ', sum_point_pB);
        console.log('sum_point_pC: ', sum_point_pC);
        console.log('sum_point_pD: ', sum_point_pD);
      }
    }
  }, function(errorCode, errorMessage) {
    showError('POST Test', errorCode, errorMessage);
  });

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
  str += 'イベント発生間隔<br>';
  str += '<SELECT name="intervalpatternE" id="intervalpatternE">';
  str += '<OPTION value="1">100mSec</OPTION>';
  str += '<OPTION value="2">200mSec</OPTION>';
  str += '<OPTION value="3">500mSec</OPTION>';
  str += '<OPTION value="4">1000mSec</OPTION>';
  str += '</SELECT>';
  str += 'イベント受信回数<br>';
  str += '<SELECT name="receiveE" id="receiveE">';
  str += '<OPTION value="50">50回</OPTION>';
  str += '<OPTION value="100">100回</OPTION>';
  str += '<OPTION value="500">500回</OPTION>';
  str += '</SELECT>';
  str += '<fieldset class=\"ui-grid-a\">';
  str += '  <div class=\"ui-block-a\">';
  str += '    <input data-icon=\"search\" onclick=\"doEventRegist(\'' +
          serviceId + '\', \'' + sessionKey +
          '\')\" type=\"button\" value=\"Register\" />';
  str += '  </div>';
  str += '  <div class=\"ui-block-b\">';
  str += '    <input data-icon=\"search\"' +
        ' onclick=\"doEventUnregister(\'' + serviceId + '\', \'' +
        sessionKey + '\')\" type=\"button\" value=\"Unregister\" />';
  str += '  </div>';
  str += '</fieldset>';
  str += '<input type="text" id="countE" width="100%">';
  str += '<input type="text" id="measureE1" width="100%">';
  str += '<input type="text" id="measureE2" width="100%">';
  str += '</form>';
  reloadContent(str);
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

var count;
/**
 * Event Regist
 */
function doEventRegist(serviceId, sessionKey) {
  var sum_point_eA = 0;
  var sum_point_eB = 0;
  var min_point_eA = 0;
  var min_point_eB = 0;
  var max_point_eA = 0;
  var max_point_eB = 0;
  count = 0;
  $('#countE').val('');
  $('#measureE1').val('');
  $('#measureE2').val('');

  var interval = $('#intervalpatternE').val();
  var receivecount = $('#receiveE').val();

  var builder = new dConnect.URIBuilder();
  builder.setProfile('measurement');
  builder.setServiceId(serviceId);
  builder.setAccessToken(accessToken);
  builder.setSessionKey(sessionKey);
  builder.setAttribute('eventtest');
  builder.addParameter('interval', interval);
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
      var point_eA = mgr_event_time - plugin_event_time;
      var point_eB = now_time - mgr_event_time;

      count++;
      if (count == 1) {
        min_point_eA = point_eA;
        min_point_eB = point_eB;
        max_point_eA = point_eA;
        max_point_eB = point_eB;
      } else {
        if (point_eA > max_point_eA ) {
          max_point_eA = point_eA;
        }
        if (point_eB > max_point_eB ) {
          max_point_eB = point_eB;
        }

        if (point_eA < min_point_eA) {
          min_point_eA = point_eA;
        }
        if (point_eB < min_point_eB) {
          min_point_eB = point_eB;
        }
      }

      if (count > receivecount) {
        doEventUnregister(serviceId, sessionKey);
      } else {
        sum_point_eA = sum_point_eA + point_eA;
        sum_point_eB = sum_point_eB + point_eB;
        $('#countE').val('count: ' + count);
        $('#measureE1').val('measure1: ' + (sum_point_eA / count) + ', min: ' + min_point_eA + ', max: ' + max_point_eA);
        $('#measureE2').val('measure2: ' + (sum_point_eB / count) + ', min: ' + min_point_eB + ', max: ' + max_point_eB);
      }
    }
  }, null, function(errorCode, errorMessage) {
    alert(errorMessage);
  });

  dConnect.connectWebSocket(sessionKey, function(errorCode, errorMessage) {});

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

