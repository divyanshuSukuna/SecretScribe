const express = require('express');
const app = express();
const mongoose = require('mongoose')
require('dotenv').config();

const userModel = require('./models/user');
const postModel = require('./models/post')
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const upload = require('./config/multerconfig');
const { error } = require('console');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname , 'public')));

//////////////////////////////////Here is your MONGODB URI//////////////////////////////////////////////////////////////
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('Connected to MongoDB');
  }).catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
  });

//////////////////////////////////Here is your MONGODB URI//////////////////////////////////////////////////////////////

app.get('/home', async (req, res) => {
    try {
        // Fetch all posts from the database and populate the 'user' field with the 'username'
        const posts = await postModel.find().populate('user', 'username');

        // Render the homepage and pass the posts data
        res.render('home', { posts });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});


// app.get('/home',async (req, res)=>{
//     let posts = await postModel.find();
//     res.render('home', {posts});
// })
app.get('/', function(req, res){
    res.render("index", {errors: []});
});

app.post('/register', async function(req, res){
    let {username, name, email, password, age} = req.body;
    let errors=[];
    if(!username || !name || !email || !password || !age ){
        errors.push("All fields are required");
        return res.render('index', {errors});
    }
    let user = await userModel.findOne({email: email});
    if(user) return res.send("User already exists")
    
    bcrypt.genSalt(10, (err, salt)=>{
        bcrypt.hash(password, salt, async (err, hash)=>{
            const createdUser = await userModel.create({
                username,
                name,
                age,
                email,
                password: hash
            })
            let token = jwt.sign({email: email, userid: createdUser._id}, "secret");
            res.cookie("token", token)
            res.redirect('/');
        })
    })
    
    
})

app.get('/login', function(req, res){
    res.render("login", {errors: []})
})

app.post('/login',async function(req, res){
    let {email, password} = req.body;
    let errors=[];
    if(!email || !password){
        errors.push("Invalid Email or Password")
        return res.render('login', {errors})
    }
    let user = await userModel.findOne({email: email});
    if(!user) return res.send("Invalid Email or Password");
    bcrypt.compare(password, user.password, (err, result)=> {
        //agr password nhi match kr rha toh phir se login page pr jao
        if(!result) return res.redirect('/login');
        let token = jwt.sign({email: email, userid: user._id}, "secret");
        res.cookie("token", token);
        res.redirect("/profile");
    })
    
})

app.post('/post', isLoggedIn, async (req, res)=>{
    let loggedInUser = await userModel.findOne({email: req.user.email})
    let post = await postModel.create({
        user: req.user._id,
        content: req.body.content
    })
    loggedInUser.posts.push(post._id);
    await loggedInUser.save();
    res.redirect('/profile')

})

app.get('/logout', function (req, res){
    res.cookie("token", "");
    res.redirect('/login');
})

function isLoggedIn(req, res, next){
    const token = req.cookies.token;
    if(!token) res.send("You must log in first!");
    else{
        let data = jwt.verify(req.cookies.token, "secret");
        req.user = data;
        next();
    }
    
}

//protected route (hmko phle check krna h ki user logged in h ya nhi)
app.get('/profile',  isLoggedIn,async (req, res)=>{
    //req.user was created in isLoggedIn function by extracting the email and other info from cookie
    let loggedInUser = await userModel.findOne({email: req.user.email}).populate("posts");;
    //loggedInUser ki posts field me actuall post le ke aao post ids ki jgh
    res.render('profile', {loggedInUser: loggedInUser});
})

app.get('/like/:id', isLoggedIn,async function(req, res){
    let likedPost = await postModel.findOne({_id: req.params.id}).populate("user");
    //agr user ne phle se like nhi kiya hua h toh
    if(likedPost.likes.indexOf(req.user.userid) === -1){
        likedPost.likes.push(req.user.userid);
    }else {
        likedPost.likes.splice(likedPost.likes.indexOf(req.user.userid), 1);
    }
    
    await likedPost.save();
    res.redirect('/profile');

})

app.get('/edit/:id', isLoggedIn, async function (req, res) {
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    
    res.render('edit', {post: post});
})

app.post('/update/:id', isLoggedIn, async function(req, res){

    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content});
    res.redirect('/profile');
})

app.get('/profile/upload', isLoggedIn, function(req, res){
    res.render('profileupload');
})

app.post('/profile/upload', isLoggedIn, upload.single('profilepic'),async function(req, res){
    let user = await userModel.findOne({_id: req.user.userid});
    user.profilepic = req.file.filename;
    await user.save()
    res.redirect('/profile');
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
    console.log("Server is listening");
})

