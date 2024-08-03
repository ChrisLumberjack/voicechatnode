const fs = require("fs");
const https = require("https");
const WebSocket = require("ws");

const serverOptions = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert"),
};

const server = https.createServer(serverOptions);

const wss = new WebSocket.Server({ server });

const users = {};

wss.on("connection", (connection) => {
  console.log("Client connected");

  connection.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    console.log("Received message:", data);

    switch (data.type) {
      case "login":
        console.log("User logged", data.name);
        if (users[data.name]) {
          sendTo(connection, { type: "login", success: false });
        } else {
          users[data.name] = connection;
          connection.name = data.name;
          sendTo(connection, { type: "login", success: true });
        }
        break;
      case "offer":
        console.log("Sending offer to:", data.name);
        if (users[data.name]) {
          connection.otherName = data.name;
          sendTo(users[data.name], {
            type: "offer",
            offer: data.offer,
            name: connection.name,
          });
        }
        break;
      case "answer":
        console.log("Sending answer to:", data.name);
        if (users[data.name]) {
          connection.otherName = data.name;
          sendTo(users[data.name], {
            type: "answer",
            answer: data.answer,
          });
        }
        break;
      case "candidate":
        console.log("Sending candidate to:", data.name);
        if (users[data.name]) {
          sendTo(users[data.name], {
            type: "candidate",
            candidate: data.candidate,
          });
        }
        break;
      case "leave":
        console.log("Disconnecting from:", data.name);
        if (users[data.name]) {
          sendTo(users[data.name], { type: "leave" });
        }
        break;
      default:
        sendTo(connection, {
          type: "error",
          message: "Command not found: " + data.type,
        });
        break;
    }
  });

  connection.on("close", () => {
    console.log("Client disconnected");
    if (connection.name) {
      delete users[connection.name];
      if (connection.otherName) {
        const connClose = users[connection.otherName];
        connClose.otherName = null;
        if (connClose) {
          sendTo(connClose, { type: "leave" });
        }
      }
    }
  });

  connection.send(
    JSON.stringify({ message: "Welcome to the WebSocket server!" })
  );
});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

// Listen on IP 195.82.126.224 and port 9090
server.listen(9090, "0.0.0.0", () => {
  console.log("Server is listening on 195.82.126.224:9090");
});
