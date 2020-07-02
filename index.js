const express = require('express');
const bodyParser = require('body-parser');
const webduino = require('webduino-js');
const firebaseAdmin = require('firebase-admin');
const axios = require('axios');
const config = require('./env.js');

const firebaseDatabaseURL = config.firebaseDatabaseURL;
const token = config.token;
const cameraURL = config.cameraURL;
const groupChatId = config.telegramGroupChatId;
const devGroupChatId = config.telegramDevGroupChatId;
let status = -2;
let button, timer;

const app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.get('/', (req, res) => res.json({ Status: status }));

const server = app.listen(process.env.PORT || '4000', function () {
  const host = server.address().address;
  const port = server.address().port;
});

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(config.firebaseServiceAccountKeyFilePath),
  databaseURL: firebaseDatabaseURL
});

createWebArduino();

function createWebArduino() {
  const option = {
    device: config.boardId,
    server: config.mqttBroker
  };

  const board = new webduino.WebArduino( option );

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
    const stage = 'Disconnect';
    log(stage);
    board.disconnect();
    writeData({value: -1});

    const msgData = {
      chat_id: devGroupChatId,
      text: '我 ＧＧ 惹 ╰( ゜ω゜)っ✂╰ひ╯'
    }

    sendMoliBotMsg(msgData, stage);

    //getCameraSnapshot(devGroupChatId);

    createWebArduino();
  }

  function onReady() {
    const stage = 'Ready';
    let text;
    board.samplingInterval = 20;
    button = new webduino.module.Button(board, board.getDigitalPin( config.boardPin ));

    log(stage);

    const msgData = {
      chat_id: devGroupChatId,
      text: '我開始監控了喔 ^.<'
    }

    sendMoliBotMsg(msgData, stage);

    onToggle();

    button.on('pressed', onToggle);
    button.on('released', onToggle);


    ////////////////

    function onToggle() {
      if (timer) {
        clearTimeout(timer);
      }

      const stage = 'toggle';

      log('onToggle Status: ' + status);

      let chatId = groupChatId;
      if (status >= 0) {
        timer = setTimeout(toggle, 2000);
      } else if (status === -2) {
        chatId = devGroupChatId;
        timer = setTimeout(toggle, 2000);
      } else {
        toggle();
      }

      function toggle() {
        log('use chat: ' + chatId);
        let boardValue = parseInt(board.getDigitalPin( config.boardPin ).value);

        if (status !== boardValue) {
          log('status: ' + status);
          if (boardValue === 1) {
            text = 'MOLi 關門';
          } else if (boardValue === 0) {
            text = 'MOLi 開門';
          }
          if (status === -2) {
            text = text.concat('中');
          }
          log('Send "' + text + '" to ' + chatId);

          const msgData = {
            chat_id: chatId,
            text: text
          }

          sendMoliBotMsg(msgData, stage);

          //getCameraSnapshot(chatId);
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

  const db = firebaseAdmin.database();
  const historyRef = db.ref('history');
  const statusRef = db.ref('status');
  const newDataRef = historyRef.push();

  newDataRef.set(data).catch(function(error) {
    log('Firebase history Synchronization failed');
  });

  statusRef.set(data.value).then(function() {
    status = data.value;
  }).catch(function() {
    log('Firebase status Synchronization failed');
  });
}

function getCameraSnapshot(chatId) {
  axios.get('http://ncnu.hydra.click:65432/go_to/door').then(
    function (response) {
      log('set camera to door success!');

      axios.post('https://bot.moli.rocks/photos', {
        headers: {
          Authorization: token
        },
        data: {
          chat_id: chatId,
          photo: cameraURL,
          disable_notification: true
        }
      }).then(
        function (response) {
          log('Send snapshot to ' + chatId + ' success!');
        }
      ).catch(function (error) {
        log('Send snapshot to ' + chatId + ' failed! ' + error);
      });
    }
  ).catch(function (error) {
    log('set camera to door failed!');
    log(error);
  });
}

function log(text) {
  const d = new Date();
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString();
  console.log(date + ' ' + time + ': ' + text);
}

function sendMoliBotMsg(msgData = {}, stage = '') {
  axios.post('https://bot.moli.rocks/messages', msgData,{
    headers: {
      'Authorization': token
    }
  }).then(
    function (response) {
      log(stage + ' message send success!');
    }
  ).catch(function (error) {
    log(stage + ' message send failed! ' + error);
  });
}
