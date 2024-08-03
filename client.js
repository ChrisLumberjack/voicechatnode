let name;
let connectedUser;

const conn = new WebSocket("wss://20.33.39.89:9090");

conn.onopen = function () {
  console.log("Connected to the signaling server");
};

conn.onmessage = function (msg) {
  console.log("Got message", msg.data);
  try {
    const data = JSON.parse(msg.data);

    switch (data.type) {
      case "login":
        handleLogin(data.success);
        break;
      case "offer":
        handleOffer(data.offer, data.name);
        break;
      case "answer":
        handleAnswer(data.answer);
        break;
      case "candidate":
        handleCandidate(data.candidate);
        break;
      case "leave":
        handleLeave();
        break;
      case "error":
        handleError(data.message);
        break;
      default:
        console.log("Unknown message type:", data.type);
    }
  } catch (e) {
    console.log("Error parsing message:", e);
  }
};

conn.onerror = function (err) {
  console.log("Got error", err);
};

function send(message) {
  if (connectedUser) {
    message.name = connectedUser;
  }

  conn.send(JSON.stringify(message));
}

const loginPage = document.querySelector("#loginPage");
const usernameInput = document.querySelector("#usernameInput");
const loginBtn = document.querySelector("#loginBtn");

const callPage = document.querySelector("#callPage");
const callToUsernameInput = document.querySelector("#callToUsernameInput");
const callBtn = document.querySelector("#callBtn");

const hangUpBtn = document.querySelector("#hangUpBtn");
const localAudio = document.querySelector("#localAudio");
const remoteAudio = document.querySelector("#remoteAudio");

let yourConn;
let stream;

callPage.style.display = "none";

loginBtn.addEventListener("click", function () {
  name = usernameInput.value;

  if (name.length > 0) {
    send({
      type: "login",
      name: name,
    });
  }
});

function handleLogin(success) {
  if (success === false) {
    alert("Ooops...try a different username");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    navigator.mediaDevices
      .getUserMedia({ video: false, audio: true })
      .then(function (myStream) {
        stream = myStream;
        localAudio.srcObject = stream;

        const configuration = {
          iceServers: [{ urls: "stun:stun2.1.google.com:19302" }],
        };

        yourConn = new RTCPeerConnection(configuration);

        yourConn.addStream(stream);

        yourConn.ontrack = function (event) {
          remoteAudio.srcObject = event.streams[0];
        };

        yourConn.onicecandidate = function (event) {
          if (event.candidate) {
            send({
              type: "candidate",
              candidate: event.candidate,
            });
          }
        };
      })
      .catch(function (error) {
        console.log("Error accessing media devices.", error);
      });
  }
}

callBtn.addEventListener("click", function () {
  const callToUsername = callToUsernameInput.value;

  if (callToUsername.length > 0) {
    connectedUser = callToUsername;

    if (yourConn) {
      yourConn
        .createOffer()
        .then(function (offer) {
          return yourConn.setLocalDescription(offer);
        })
        .then(function () {
          send({
            type: "offer",
            offer: yourConn.localDescription,
          });
        })
        .catch(function (error) {
          alert("Error when creating an offer");
        });
    } else {
      console.log("Peer connection is not initialized.");
    }
  }
});

function handleOffer(offer, name) {
  connectedUser = name;
  yourConn
    .setRemoteDescription(new RTCSessionDescription(offer))
    .then(function () {
      return yourConn.createAnswer();
    })
    .then(function (answer) {
      return yourConn.setLocalDescription(answer);
    })
    .then(function () {
      send({
        type: "answer",
        answer: yourConn.localDescription,
      });
    })
    .catch(function (error) {
      alert("Error when creating an answer");
    });
}

function handleAnswer(answer) {
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
}

function handleCandidate(candidate) {
  yourConn.addIceCandidate(new RTCIceCandidate(candidate));
}

hangUpBtn.addEventListener("click", function () {
  send({
    type: "leave",
  });

  handleLeave();
});

function handleLeave() {
  connectedUser = null;
  remoteAudio.srcObject = null;

  if (yourConn) {
    yourConn.close();
    yourConn.onicecandidate = null;
    yourConn.ontrack = null;
  }
}

function handleError(message) {
  console.error("Server error:", message);
  alert("An error occurred: " + message);
}
