var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var webduino = require('webduino-js');
var Firebase = require('firebase');
var TelegramBot = require('node-telegram-bot-api');
var config = require('./env.js');

var ref = new Firebase( config.firebase );
var token = config.telegram_token;
var groupChatId = config.telegram_groupChatId;
var devGroupChatId = config.telegram_devGroupChatId;
var bot = new TelegramBot(token, {polling: true});
var button, status, timer;

var app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

var ref = new Firebase('')
var button, status;

createWebArduino();

function createWebArduino() {
  var board = new webduino.WebArduino( config.boardId );

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
    
    bot.sendMessage(devGroupChatId, '我 ＧＧ 惹 ╰( ゜ω゜)っ✂╰ひ╯');
    getCameraSnapshot(devGroupChatId);
    
    createWebArduino();
  }

  function onReady() {
    var text;
    status = -2;
    board.samplingInterval = 20;
    button = new webduino.module.Button(board, board.getDigitalPin(11));

    log('Ready');
    bot.sendMessage(devGroupChatId, '我開始監控了喔 ^.<');
    onToggle();

    button.on('pressed', onToggle);
    button.on('released', onToggle);


    ////////////////

    function onToggle() {
      if (timer) {
        clearTimeout(timer);
      }
      var chatId = groupChatId;
      if (status >= 0) {
        timer = setTimeout(toggle, 2000);
      } else if (status === -2) {
        chatId = devGroupChatId;
        timer = setTimeout(toggle, 1000);
      } else {
        toggle();
      }

      function toggle() {
        console.log(chatId);
        var boardValue = board.getDigitalPin(11).value;

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
          bot.sendMessage(chatId, text);
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
  var options = {
    url: 'http://163.22.32.59:50080/cgi-bin/wappaint?pic_size=2',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
    },
    encoding: null
  };

  request(options, function(error, response, body) {
    log('Send snapshot to ' + chatId);
    bot.sendPhoto(chatId, body, {disable_notification: true});
  });
}

bot.onText(/\/status/, function (msg) {
  var fromUsername = msg.from.username;
  var chatId = msg.chat.id;
  var resp = '@'+ fromUsername + ' ';
  if (status === 1) {
    resp += 'MOLi 關門中';
  } else if (status === 0) {
    resp += 'MOLi 開門中';
  } else {
    resp += '我現在 GG 中 Orz';
  }
  log('Send message to ' + '@'+ fromUsername + ' in ' + msg.chat.title + '(' + msg.chat.id + '）');
  bot.sendMessage(chatId, resp);
});

bot.onText(/\/map/, function (msg) {
  var fromUsername = msg.from.username;
  var chatId = msg.chat.id;

  log('Send location to ' + '@'+ fromUsername + ' in ' + msg.chat.title + '(' + msg.chat.id + '）');
  bot.sendLocation(chatId, 23.9519631, 120.9274402);
});

function log(text) {
  var d = new Date();
  var date = d.toLocaleDateString();
  var time = d.toLocaleTimeString();
  console.log(date + ' ' + time + ': ' + text);
}

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
});
