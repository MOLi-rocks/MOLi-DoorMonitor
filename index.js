var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var webduino = require('webduino-js');
var Firebase = require('firebase');
var config = require('./env.js');

var ref = new Firebase( config.firebase );
var token = config.telegram_token;
var groupChatId = config.telegram_groupChatId;
var devGroupChatId = config.telegram_devGroupChatId;
var button, status, timer;

var app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

createWebArduino();

function createWebArduino() {
  var option = {
    device: config.boardId,
    server: config.mqttBroker
  };
  var board = new webduino.WebArduino( option );

  board.on(webduino.BoardEvent.READY, onReady);
  board.on(webduino.BoardEvent.DISCONNECT, onDisconnect);
  board.on(webduino.BoardEvent.ERROR, onError);
  board.on(webduino.BoardEvent.BEFOREDISCONNECT, onBeforeDisconnect);

  ////////////////

  function onError(err) {
    log(err);
    board.disconnect();
    writeData({value: -1});
  }

  function onBeforeDisconnect() {
    log('before disconnect');
  }

  function onDisconnect() {
    log('disconnect');
    board.disconnect();
    writeData({value: -1});
    
    var formData = {
      chat_id: devGroupChatId,
      text: '我 ＧＧ 惹 ╰( ゜ω゜)っ✂╰ひ╯'
    }
    request.post({url:'https://bot.moli.rocks/messages', formData: formData}, function optionalCallback(err, httpResponse, body) {
      if (err) {
        return console.error(err);
      }
      console.log('message success send!');
    });
    getCameraSnapshot(devGroupChatId);
    
    createWebArduino();
  }

  function onReady() {
    var text;
    status = -2;
    board.samplingInterval = 20;
    button = new webduino.module.Button(board, board.getDigitalPin(8));

    log('Ready');
    var formData = {
      chat_id: devGroupChatId,
      text: '我開始監控了喔 ^.<'
    }
    request.post({url:'https://bot.moli.rocks/messages', formData: formData}, function optionalCallback(err, httpResponse, body) {
      if (err) {
        return console.error(err);
      }
      console.log('message success send!');
    });

    onToggle();

    button.on('pressed', onToggle);
    button.on('released', onToggle);


    ////////////////

    function onToggle() {
      if (timer) {
        clearTimeout(timer);
      }

      log('onToggle Status: ' + status);

      var chatId = groupChatId;
      if (status >= 0) {
        timer = setTimeout(toggle, 2000);
      } else if (status === -2) {
        chatId = devGroupChatId;
        timer = setTimeout(toggle, 2000);
      } else {
        toggle();
      }

      function toggle() {
        console.log(chatId);
        var boardValue = board.getDigitalPin(8).value;

        if (status != boardValue) {
          log('status: ' + status);
          if (boardValue == 1) {
            text = 'MOLi 關門';
          } else if (boardValue == 0) {
            text = 'MOLi 開門';
          }
          if (status == -2) {
            text = text.concat('中');
          }
          log('Send "' + text + '" to ' + chatId);

          var formData = {
            chat_id: chatId,
            text: text
          }
          request.post({url:'https://bot.moli.rocks/messages', formData: formData}, function optionalCallback(err, httpResponse, body) {
            if (err) {
              return console.error(err);
            }
            console.log('message success send!');
          });

          getCameraSnapshot(chatId);
          writeData({value: boardValue});
        } else {
          log('重複喔');
        }
        log('boardValue: ' + boardValue);
      }
    }
  }
}

function writeData(data) {
  data.timestamp = new Date().getTime();

  var statusRef = ref.child('status');
  statusRef.set(data.value);
  status = data.value;

  var historyRef = ref.child('history');
  var newDataRef = historyRef.push();
  newDataRef.set(data);
}

function getCameraSnapshot(chatId) {
  log('Send snapshot to ' + chatId);
  var formData = {
    chat_id: chatId,
    photo: config.cameraURL
  };
  request.post({url:'https://bot.moli.rocks/photos', formData: formData}, function optionalCallback(err, httpResponse, body) {
    if (err) {
      return console.error(err);
    }
    console.log('photo Send successful!', body);
  });
}

function log(text) {
  var d = new Date();
  var date = d.toLocaleDateString();
  var time = d.toLocaleTimeString();
  console.log(date + ' ' + time + ': ' + text);
}

var server = app.listen(4000, function () {
  var host = server.address().address;
  var port = server.address().port;
});
