/*
   老俞好帥！
 */

var express = require('express');
var bodyParser = require('body-parser');
var webduino = require('webduino-js');
var Firebase = require('firebase');
var TelegramBot = require('node-telegram-bot-api');
var config = require('./env.js');

var ref = new Firebase( config.firebase );
var token = config.telegram_token;
var groupChatId = config.telegram_groupChatId;
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
    console.log(err);
    board.disconnect();
    writeData({value: -1});
  }

  function onBeforeDisconnect() {
    console.log('before disconnect');
  }

  function onDisconnect() {
    console.log('disconnect');
    board.disconnect();
    writeData({value: -1});
    bot.sendMessage(groupChatId, '我 ＧＧ 惹 ╰( ゜ω゜)っ✂╰ひ╯');
    createWebArduino();
  }

  function onReady() {
    var text;
    status = -2;
    board.samplingInterval = 20;
    button = new webduino.module.Button(board, board.getDigitalPin(11));

    console.log('ready');
    bot.sendMessage(groupChatId, '我開始監控了喔 ^.<');
    onToggle();

    button.on('pressed', onToggle);
    button.on('released', onToggle);

    ////////////////

    function onToggle() {
      if (timer) {
        clearTimeout(timer);
      }
      if (status >= 0) {
        timer = setTimeout(toggle, 2000);
      } else {
        toggle();
      }

      function toggle() {
        var boardValue = board.getDigitalPin(11).value;

        if (status != boardValue) {
          writeData({value: boardValue});
          if (boardValue == 1) {
            console.log('關門');
            text = 'MOLi 關門';
          } else if (boardValue == 0) {
            console.log('開門');
            text = 'MOLi 開門';
          }
          if (status == -2) {
            text += '中';
          }
          bot.sendMessage(groupChatId, text);
        } else {
          console.log('重複');
        }
        console.log(boardValue);
        console.log('');
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

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
});
