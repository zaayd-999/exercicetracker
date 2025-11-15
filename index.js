const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
const bodyParser = require('body-parser');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { Database , OPEN_READWRITE }  = require("sqlite3").verbose();

const database = new Database("./database.db" , OPEN_READWRITE, (err) => {
  if (err) {
    console.error("Error opening database: " + err.message);
  }
  else {
    console.log("Connected to the SQLite database.");
  }
});

const { Router } = require("express");

const userRouter = Router();

userRouter.get("/", (req, res) => {
  const sql = "SELECT * FROM users";
  database.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json([...rows.map(row => ({ "_id": String(row.id), "username": row.username }))]);
    }
  );
});

userRouter.get("/:_id", (req, res) => {
  const sql = "SELECT * FROM users WHERE id = ?";
  const params = [req.params._id];
  database.get(sql, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json([row]);
    }
  );
});

userRouter.post("/", (req, res) => {
  const { username } = req.body;
  const sql = "INSERT INTO users (username) VALUES (?)";
  const params = [username];
  database.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({ username : username , "_id": this.lastID });
    }
  );
});


userRouter.get("/:_id/exercises/", (req, res) => {
  const userId = req.params._id;
  
  const sql = "SELECT * FROM exercices WHERE id = ?";
  const params = [userId];

  database.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const log = rows.map(row => ({
      description: row.description,
      duration: row.duration,
      date: row.date,
    }));
    res.json({
      "_id": userId,
      "username": rows.length > 0 ? rows[0].username : null,
      "count": rows.length,
      "log": log,
    });
  });
});

userRouter.get("/:_id/logs", (req, res) => {
  const userId = req.params._id;
  let { from , to , limit } = req.query;

  let sql = "SELECT * FROM exercices WHERE id = ?";
  const params = [userId];
  
  if(from) {
    sql += " AND date >= ?";
    params.push(new Date(from).getTime());
  }
  if(to) {
    sql += " AND date <= ?";
    params.push(new Date(to).getTime());
  }
  sql += " ORDER BY date ASC";
  if(limit) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }

  database.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const log = rows.map(row => ({
      description: row.description,
      duration: row.duration,
      date: row.date,
    }));
    res.json({
      "_id": userId,
      "username": rows.length > 0 ? rows[0].username : null,
      "count": rows.length,
      "log": log.map(entry => ({
        description: entry.description,
        duration: entry.duration,
        date: new Date(entry.date).toDateString(),
      })),
    });
  }
  );
});


userRouter.post("/:_id/exercises", (req, res) => {
  let { description , duration , date } = req.body;

  let olddate = date;
  const userId = req.params._id;

  database.get("SELECT * FROM users WHERE id=?" , [userId] , (err , row) => {
    if(err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if(!row) {
      res.status(400).json({ error: "User not found" });
      return;
    };
    const username = row.username;
    
    if(!date) {
      let thisD = new Date();
      date = thisD.getTime();
      olddate = thisD.toDateString();
    } else {
      date = new Date(date).getTime();
    }

    const sql = "INSERT INTO exercices (id , username , description , duration , date) VALUES ( ? , ? , ? , ? , ? )";

    database.run(sql , [ userId , username , description , duration , date ] , function(err) {
      if(err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({
        "username": username,
        "description": description,
        "duration": Number(duration),
        "date": olddate,
        "_id": String(userId),
      });
    });
  });
});


const apiRouter = Router();

apiRouter.use("/users", userRouter);


app.use("/api", apiRouter);



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
