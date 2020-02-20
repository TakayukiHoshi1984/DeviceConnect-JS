/**
 notification.js
 Copyright (c) 2020 NTT DOCOMO,INC.
 Released under the MIT license
 http://opensource.org/licenses/mit-license.php
 */

/**
 * Notification Menu
 *
 * @param {String} serviceId サービスID
 */
function showNotification(serviceId) {

  initAll();

  let btnStr = '';
  btnStr += getBackButton('Device Top', 'doNotificationBack', serviceId);
  reloadHeader(btnStr);
  reloadFooter(btnStr);

  if (myDeviceName.indexOf('Pebble') == -1 &&
      myDeviceName.indexOf('SmartWatch') == -1 &&
      myDeviceName.indexOf('Chromecast') == -1) {
    doRegisterNotificationShow(serviceId);
    doRegisterNotificationClick(serviceId);
    doRegisterNotificationClose(serviceId);
  }

  setTitle('Notification Profile(Notify)');

  let builder = new sdk.URIBuilder();
  builder.setProfile('notification');
  builder.setAttribute('notify');
  let uri = builder.build();
  if (DEBUG) {
    console.log('Uri: ' + uri);
  }
  let str = '';
  str += '<form action="' + uri + '" method="POST" id="notificationForm"' +
        ' name="notificationForm" enctype="multipart/form-data"' +
        ' onsubmit="return false;">';

  if (myDeviceName.indexOf('Pebble') == -1 &&
      myDeviceName.indexOf('SmartWatch') == -1 &&
      myDeviceName.indexOf('Chromecast') == -1) {
    str += makeInputText('onClick', 'click', 'click');
    str += makeInputText('onShow', 'show', 'show');
    str += makeInputText('onClose', 'close', 'close');
  }
  str += '<br>';
  str += '<center><input type="text" value="hello world!"' +
          ' name="body" id="body">';
  str += '<SELECT name="type" id="type">';
  str += '<OPTION value="0">Call event</OPTION>';
  str += '<OPTION value="1">Mail event</OPTION>';
  str += '<OPTION value="2">SMS event</OPTION>';
  str += '<OPTION value="3">Normal event</OPTION>';
  str += '</SELECT>';
  str += '<input type="file" name="icon" id="icon"/>';
  str += '<input type="hidden" name="serviceId" value="' + serviceId + '"/>';
  str += '<input type="hidden" name="accessToken" value="' +
          sdk.getAccessToken() + '"/>';
  str += '<input type="button" name="sendButton" id="sendButton"' +
        ' value="Notify" onclick="doNotificationNotify(\'' +
        serviceId + '\');"/>';
  str += '</center>';
  str += '</form>';
  reloadContent(str);

}

/**
 * Back Button
 *
 * @param {String} serviceId サービスID
 */
function doNotificationBack(serviceId) {

  if (myDeviceName.indexOf('Pebble') == -1 &&
      myDeviceName.indexOf('SmartWatch') == -1 &&
      myDeviceName.indexOf('Chromecast') == -1) {
    doUnregisterNotificationShow(serviceId);
    doUnregisterNotificationClick(serviceId);
    doUnregisterNotificationClose(serviceId);
  }
  searchSystem(serviceId);
}

/**
 * onShowイベントの登録
 *
 * @param {String} serviceId サービスID
 */
function doRegisterNotificationShow(serviceId) {

  sdk.addEventListener({
    profile: 'notification',
    attribute: 'onshow',
    serviceId: serviceId
  }, message => {
    // イベントメッセージが送られてくる
    if (DEBUG) {
      console.log('Event-Message:' + message);
    }

    let json = JSON.parse(message);
    document.notificationForm.show.value = json.notificationId;
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onShowイベントの解除
 *
 * @param {String} serviceId サービスID
 */
function doUnregisterNotificationShow(serviceId) {
  sdk.removeEventListener({
    profile: 'notification',
    attribute: 'onshow',
    serviceId: serviceId
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onClickイベントの登録
 *
 * @param {String} serviceId サービスID
 */
function doRegisterNotificationClick(serviceId) {
  sdk.addEventListener({
    profile: 'notification',
    attribute: 'onclick',
    serviceId: serviceId
  }, message => {
    // イベントメッセージが送られてくる
    if (DEBUG) {
      console.log('Event-Message:' + message);
    }

    let json = JSON.parse(message);
    document.notificationForm.click.value = json.notificationId;
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onClickイベントの解除
 *
 * @param {String} serviceId サービスID
 */
function doUnregisterNotificationClick(serviceId) {
  sdk.removeEventListener({
    profile: 'notification',
    attribute: 'onclick',
    serviceId: serviceId
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onCloseイベントの登録
 *
 * @param {String} serviceId サービスID
 */
function doRegisterNotificationClose(serviceId) {
  sdk.addEventListener({
    profile: 'notification',
    attribute: 'onclose',
    serviceId: serviceId
  }, message => {
    // イベントメッセージが送られてくる
    if (DEBUG) {
      console.log('Event-Message:' + message)
    }
    let json = JSON.parse(message);
    document.notificationForm.close.value = json.notificationId;
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onCloseイベントの解除
 *
 * @param {String} serviceId サービスID
 */
function doUnregisterNotificationClose(serviceId) {
  sdk.removeEventListener({
    profile: 'notification',
    attribute: 'onclose',
    serviceId: serviceId
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onErrorイベントの登録
 *
 * @param {String}serviceId サービスID
 */
function doRegisterNotificationError(serviceId) {
  sdk.addEventListener({
    profile: 'notification',
    attribute: 'onerror',
    serviceId: serviceId
  }, message => {
    // イベントメッセージが送られてくる
    if (DEBUG) {
      console.log('Event-Message:' + message)
    }
    let json = JSON.parse(message);
    document.notificationForm.error.value = json.notificationId;
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * onErrorイベントの解除
 *
 * @param {String} serviceId サービスID
 */
function doUnregisterNotificationError(serviceId) {
  sdk.removeEventListener({
    profile: 'notification',
    attribute: 'onerror',
    serviceId: serviceId
  }).catch(e => {
    alert(e.errorMessage);
  });
}

/**
 * Notification(Notify)
 *
 * @param {String} serviceId サービスID
 */
function doNotificationNotify(serviceId) {
  let myForm = document.getElementById('notificationForm');
  let myFormData = new FormData(myForm);
  let myXhr = new XMLHttpRequest();
  myXhr.open(myForm.method, myForm.action, true);
  myXhr.onreadystatechange = function() {
    if (myXhr.readyState === 4) {
      if (myXhr.status === 200 || myXhr.status == 0) {
        if (DEBUG) {
          console.log('Response:' + myXhr.responseText)
        }
        let obj = JSON.parse(myXhr.responseText);
        if (obj.result == 0) {
          let str = '';
          if (myDeviceName.indexOf('Pebble') != -1) {
          } else if (myDeviceName.indexOf('SmartWatch') != -1) {
          } else {
            str += '<center>';
            str += '<input type="button" onclick="notificationDel(\'' +
                    serviceId + '\',\'' + obj.notificationId +
                    '\');" value="Delete" type="button" >';
            str += '</center>';
            reloadMenu(str)
          }
        } else {
          showError('POST notification/notify',
                    obj.errorCode, obj.errorMessage);
        }
      } else {
        alert('error:' + myXhr.status);
      }
      closeLoading();
    }
  };
  myXhr.send(myFormData);
}

/**
 * ID指定でNotificationを消す
 *
 * @param {String} serviceId サービスID
 */
function notificationDel(serviceId, notificationId) {
  sdk.delete({
    profile: 'notification',
    attribute: 'notify',
    serviceId: serviceId,
    notificationId: notificationId
  }).then(json => {
    if (DEBUG) {
      console.log('Response: ', json);
    }
    reloadMenu('');
  }).catch(e => {
    showError('POST notification/notify', e.errorCode, e.errorMessage);
  });
}
