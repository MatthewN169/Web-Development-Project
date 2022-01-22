const session = require('express-session');
const express = require('express');
const MongoDBStore = require('connect-mongodb-session')(session);

let app = express();

let mongo = require('mongodb');
let MongoClient = mongo.MongoClient;
let db;

//storing session into mongodb
let mongoStore = new MongoDBStore({
    uri: 'mongodb://localhost:27017/mongoSession',
    collection: 'sessiondata'
});

//loading files from public folder
app.use(express.static("public"));
//allows to access the request body of requests with request.body
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.set("views");
app.set('view engine', 'pug');

//starts session
app.use(
    session({
        name: 'a4-session',
        secret: 'some secret key here',
        cookie: {
            //30 minutes
            maxAge: 1000 * 60 * 30
        },
        store: mongoStore,
        resave: true,
        saveUninitialized: false,
    })
);

//exposes session, this is so pugs can easily access session object
app.use(function(req, res, next) {
    if (req.session) {
        res.locals.session = req.session;
    }
    next();
});

//Displays all requests made
app.use((request, response, next)=>{
    console.log(request.method + ": " + request.url);
    next();
});

//All routes
app.get("/", (req,res)=>res.render("home"));

app.post("/login", login);
app.get("/logout", logout);

app.get("/registration", (req,res)=>res.render("registration"));
app.post("/registration", createUser);

app.get("/users", loadUsers);
app.get("/users/:userID", loadUser);
app.put("/users/:userID", savePrivacy);

app.get("/orders", loadOrderForm);
app.get("/orders/:orderID", loadOrderSum);
app.post("/orders", saveOrder);

//login function
function login(req, res) {
    //checks if user is already logged in
    if (req.session.loggedin) {
        res.status(200).send("Already logged in");
    }else{
        //finds username that matches users input
        db.collection("users").findOne({username : req.body.username}, function(err, result) {
            if (err || result == null) {
                res.status(404).send();
                return;
            };
            //checks if resultings username and password matches
            if (req.body.username == result.username && req.body.password == result.password) {
                //stores information on session object
                req.session.loggedin = true;
                req.session.username = result.username;
                req.session._id = result._id;
                res.locals.session = req.session;
                //sends id of the logged in user to client, this is used by the registration so the user can be redirected to users profile
                //login function is called in registration function
                res.status(201).send(result._id);
            }else{
                res.status(404).send();
            }
        });
    }
}

//logout function
function logout(req, res) {
    //destroys the session
    req.session.destroy();
    //deletes the any local data on session
    delete res.locals.session;
    //redirects user back home
    res.redirect("/");
}

//creates a new user
function createUser(req, res) {
    //finds if a user matches the new user that the client wants to create case insensitive
    db.collection("users").findOne({username : {"$regex" : "^" + req.body.username + "$", "$options" : "i"}}, function(err, result) {
        if (err) {
            res.status(404).send("ERROR");
        }
        //if no user that matches is found (no duplicate user exists)
        if (result == null) {
            //insert the new user and set privacy to false into database
            db.collection("users").insertOne(
                {
                    username : req.body.username,
                    password : req.body.password,
                    privacy : false,
                }
            )
            //calls login function to log new user in and redirect to new profile page
            login(req, res);
        }else{
            res.status(404).send();
        }
    });
}

//loads all users on database
function loadUsers(req, res) {
    //checking if query passed in is empty (used so it can default show all users)
    if (req.query.name == undefined) {
        req.query.name = "";
    }
    //finds users in database that contains the characters the user querys
    db.collection("users").find({
        username : {"$regex" : ".*" + req.query.name + ".*", "$options" : "i"},
    }).toArray(function(err, result) {
        if (err){
			response.status(500).send("error reading database");
			return;
		}
        //renders users page and passes in users array
        res.render("users", {
            users: result,
        });
	});
}

//loads specific user page
function loadUser(req, res) {
    //turns the requested user id into a mongo Object id
    let userId;
	try{
		userId = new mongo.ObjectID(req.params.userID);
	}catch{
		res.status(404).send("Unknown ID");
		return;
	}
    //finds user that matches the id passed in
    db.collection("users").findOne({_id : userId}, function(err, user) {
        if (err || user == null){
            res.status(500).send("User id does not exist");
            return;
        }
        //checks if that users privacy is false and if the client is currently not logged in as the user its trying to access
        if (user.privacy == true && req.session.username != user.username){
            res.status(403).send("Unauthorized");
        }else {
            //this is to find all the chosen users orders (the orders are all passed in the id of the user that ordered it)
            db.collection("users").find({"userOrder" : userId}).toArray(function(err, order) {
                if (err){
                    res.status(500).send("error reading database");
                    return;
                }
                //renders the specific user page and passes in the user information and the orders
                res.render("user", {
                    user: user,
                    orders: order,
                });
            });
        }
    });
}

//updates privacy setting of user
function savePrivacy(req, res) {
    //converts id requested into mongo object it
    let userId;
	try{
		userId = new mongo.ObjectID(req.params.userID);
	}catch{
		res.status(404).send("Unknown ID");
		return;
	}

    if (req.session.loggedin) {
        //checks if the user logged in is requesting to change the privacy
        if (userId.equals(req.session._id)) {
            //updates the following users id's privacy to the privacy that was sent
            db.collection("users").updateOne({_id : userId}, {$set:{privacy: req.body.privacy}}, function(err, result) {
                res.status(200).send();
            });
        }else{
            res.status(403).send("unauthorized");
        }
    }else{
        res.status(403).send("unauthorized");
    }
    
}

//loads order form for user
function loadOrderForm(req, res) {
    //checks if user is logged in as only logged in users can access the order form
    if (req.session.loggedin) {
        res.render("orderform");
    }else{
        res.status(404).send("You must be logged in to access this page");
    }
}

//loads the order summary of user
function loadOrderSum(req, res) {
    //converts requested order id into mongo object id
    let orderId;
	try{
		orderId = new mongo.ObjectID(req.params.orderID);
	}catch{
		res.status(404).send("Unknown ID");
		return;
	}
    //finds the order with the same id
    db.collection("users").findOne({_id : orderId}, function(err, result) {
        if (err) {
            res.status(500).send("Unable to find order")
        };
        //finds the user that made that order
        db.collection("users").findOne({_id : result.userOrder}, function(err, user) {
            if (err) {
                res.status(500).send("Unable to find order")
            };
            //checks if profile is not private
            if (!user.privacy) {
                //passes in order
                res.render("orderSum", {
                    order: result,
                });
            //checks if you are currently logged in
            }else if (req.session.loggedin){
                //checks if the logged in user is the same as users order its trying to access
                if (req.session._id.equals(user._id)) {
                    //passes in order
                    res.render("orderSum", {
                        order: result,
                    });
                }else{
                    res.status(403).send("unauthorized");
                }
            }else{
                res.status(403).send("unauthorized");
            }
        });
    });
}

//saves order that user makes
function saveOrder(req, res) {
    //creates order object
    let order = {
        //stores order information
        ...req.body,
        //saves the id of the user that ordered it in the object
        userOrder: req.session._id,
        //saves the username of the user that ordered it
        username: req.session.username,
    }
    //inserting the order in the users collection
    db.collection("users").insertOne(order, function(err, result) {
        if (err) {
            res.status(500).send("Unable to create order");
        }
        res.status(200).send();
    });
}

// Initialize database connection
MongoClient.connect("mongodb://localhost:27017/", function(err, client) {
    if(err) throw err;

    //Get the a4 database
    db = client.db('a4');
    // Start server once Mongo is initialized
    app.listen(3000);
    console.log("Listening on port http://localhost:3000/");
});