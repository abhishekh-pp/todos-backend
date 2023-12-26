const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/user");
var jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const Todo = require("./models/todo");
const saltRounds = 10;
const app = express();
const port = process.env.PORT || 3000;
const baseUrl = process.env.BASE_URL;

app.use(
  cors({
    origin: [baseUrl],
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const verifyLogin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    res.status(401).send("Unauthorized access");
  }
  try {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded._id;
  } catch (err) {
    res.status(401).send("Unauthorized access");
  }
  next();
};

app.get("/todos", verifyLogin, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user });
    res.status(200).json(todos);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post(
  "/todos",
  verifyLogin,

  async (req, res) => {
    const user = req.user;
    const data = req.body;
    try {
      const todo = new Todo({
        ...data,
        user: user,
      });
      await todo.save();
      res.status(201).json(todo);
    } catch (err) {
      res.status(400).send("Invalid input data");
    }
  }
);

app.post("/users/signup", async (req, res, next) => {
  try {
    const hash = bcrypt.hashSync(req.body.password, saltRounds);
    const user = new User({
      ...req.body,
      password: hash,
    });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).send("Invalid signup");
  }
});

app.post("/users/login", async (req, res, next) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).send("User ont found");
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.send(401).send("Login failed");
    }
    const token = jwt.sign(
      { _id: user._id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: 3 * 24 * 60 * 60 }
    );

    res.cookie("token", token, {
      withCredentials: true,
      httpOnly: false,
    });

    res.status(200).json({
      message: "login successfull ",
      user: { _id: user._id, name: user.name },
    });
  } catch (err) {
    res.status(400).send("Invalid login");
  }
});

app.post("/users/verify", async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send("User not logged in");
  }
  return res.status(200).send("User is logged in");
});

app.delete("/todos/:todoId", verifyLogin, async (req, res) => {
  try {
    const givenTodo = await Todo.findById(req.params.todoId);
    const todoCreatedBy = givenTodo.user.toString();
    if (todoCreatedBy === req.user) {
      await Todo.findByIdAndDelete(req.params.todoId);
      res.status(204).send("Deleted");
    } else {
      res.status(404).send("Cannot delete todo. Unauthorized!");
    }
  } catch (err) {
    res.status(404).send("Todo with given ID not found");
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

main()
  .then(() => console.log("db connected"))
  .catch((err) => console.log(err));

async function main() {
  const url = process.env.DB_URL;
  const password = process.env.DB_PASSWORD;
  const urlWithPassword = url.replace("<password>", password);
  await mongoose.connect(urlWithPassword);

  // use `await mongoose.connect('mongodb://user:password@127.0.0.1:27017/test');` if your database has auth enabled
}
