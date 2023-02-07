const path = require("path");
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const mongoose = require("mongoose");
// models here // 
const User = require("./models/User");
const Message = require("./models/Message");
// models done //
require("dotenv").config();
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

// MongoDB connection // 
mongoose
.connect(process.env.MONGODB_URI, {
useNewUrlParser: true,
useUnifiedTopology: true
})
.then(() => {
console.log("MongoDB Connected");
})
.catch(err => console.log(err));
// MongoDB connection done // 


// Express server // 
const app = express();
// Express server done //

// Body parser //
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());
// Body parser done //

const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

const botName = "Chat Bot";


// register

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// when user submits registration form create new user in db // 
app.post('/register', (req, res) => {
  const { firstname, lastname, username, password, password2 } = req.body;

  console.table(req.body);

  let errors = [];

  // Check required fields
  if (!firstname || !lastname || !username || !password || !password2) {
    errors.push({ msg: "Please fill in all fields" });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: "Passwords do not match" });
  }

  // Check pass length
  if (password.length < 3) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }

  if (errors.length > 0) {
    res.render("register", {
      errors,
      firstname,
      lastname,
      username,
      password,
      password2,
    });
  } else {
    // Validation passed

    // Check if user exists
    newUser = new User({
      firstname,
      lastname,
      username,
      password,
    });
  
    // Save user
    newUser
      .save()
      .then((user) => {
        res.redirect("/login");
      })
      .catch((err) => console.log(err));
  }
});

  
// login

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// when user submits login form check if user exists in db - if yes, direct to index page //
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  console.table(req.body);

  let errors = [];

  // Check required fields
  if (!username || !password) {
    errors.push({ msg: "Please fill in all fields" });
  }

    // Validation passed

    // Check if user exists in DB 

  User.findOne({ username: username }, (err, user) => {
    if (err) {
      console.error(err);
    }

    // If the user doesn't exist, return an error
    if (!user) {
      return res.render("login", {
        error: "Incorrect username",
      });
    }
    // If the user exists, check if the password matches
    if (user.password !== password) {
      return res.render("login", {
        error: "Incorrect password",
      });
    }
    // If the password matches, redirect to the index page
    res.redirect("/");    
  });
});


// Run when client connects
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to The Chat App!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));


    const newMessage = new Message({
      from_user: user.username,
      message: msg,
      room: user.room,
    });

    newMessage.save().then((message) => {
      console.log(message);
    }
    ).catch((err) => {
      console.log(err);
    }
    );
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));