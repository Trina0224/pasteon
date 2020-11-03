//jshint esversion:6

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');

const _ = require("lodash");
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PORT = process.env.PORT || 3000;


const homeStartingContent = "Click the link below and copy-paste anythin you want to keep it a while. The system will delete it after you read it or a while.";
const aboutContent = "aboutContent";
const contactContent = "The photo only accept less than 16MB, if you upload a photo which is larger than 16MB, you will lost it. The system will delete this file after a while. Please download it in the grace period.";
const errorContent = "The page already removed because expired or wrong link address.";

const app = express();

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
app.use(express.static("public"));
// Set EJS as templating engine
app.set('view engine', 'ejs');


// Connecting to the database
mongoose.connect(process.env.MONGODB_APP_LINK,
    { useNewUrlParser: true, useUnifiedTopology: true }, err => {
        console.log('DB connected')
    });
//console.log(process.env.MONGODB_APP_LINK);
mongoose.set('useFindAndModify', false);

const imageSchema = new mongoose.Schema({
  timeStamp:{
    type: String,
    required: [true,"timeStamp is required."]
  },
  timePeriod: {
    type: String,
    required: [true, "time period field is required."]
  },
  oneTimeOnly: String,
  name: {
    type: String,
    required: [true, "title field is required."]
  },
	desc: String,
	img:
	{
		data: Buffer,
		contentType: String
	}

});
//Image is a model which has a schema imageSchema
//module.exports = new mongoose.model('Image', imageSchema);
const ImgModel = mongoose.model("Image", imageSchema);

let storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'public/img') //setup this path in project.
	},
	filename: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1]; //which looks like 'image/jpeg'
		cb(null, `${file.fieldname}_${Date.now()}.${ext}`);

	}
});

const multerFilter = (req, file, cb) => { //jpeg...
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload an image.', 400), false);
  }
};
//create middle-ware,
const upload = multer({ storage: storage, fileFilter: multerFilter});

///////////////////////////////////////////////////////////////////////////////
// Retriving the image
app.get("/", function(req, res){
  ImgModel.find({}, (err, items) => {
      if (err) {
          console.log(err);
      }
      else {
          res.render("home", {
            startingContent: homeStartingContent,
             items: items
          });
      }
  });

});



// Uploading the image
app.post('/', upload.single('image'), (req, res, next) => {

//    console.log(req.body); //You will not see img related data display here.
//    console.log(req.file.filename);//if it is existed is fine. but...
    // if(typeof req.file === 'undefined'){
    //   console.log("file is undefined.");
    // }
    let current= new Date().getTime();
    let defaultOneTimeValue = "";
//    defaultOneTimeValue = req.body['oneTimeOnly'];
    defaultOneTimeValue = req.body.oneTimeOnly[1];//if checked, you will get oneTime, if no, get 'n'
    console.log(defaultOneTimeValue);
    if(typeof req.file === 'undefined'){
      var obj = {
          timeStamp: current,
          timePeriod: req.body.timePeriod,
          oneTimeOnly: defaultOneTimeValue,
          name: req.body.name,
          desc: req.body.desc
      }
    }else{
      var obj = {
          timeStamp: current,
          timePeriod: req.body.timePeriod,
          oneTimeOnly: defaultOneTimeValue,
          name: req.body.name,
          desc: req.body.desc,
          img: {
              data: fs.readFileSync(path.join(__dirname + '/public/img/' + req.file.filename)),
              contentType: 'image/png'
          }
      }
    }
    ImgModel.create(obj, (err, item) => {
        if (err) {
            console.log(err);
        }
        else {
            // item.save();
            res.redirect('/');
        }
    });
});

app.get("/compose", function(req, res){
  res.render("compose");
});

app.post("/compose", function(req, res){
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody
  });


  post.save(function(err){
    if (!err){
        res.redirect("/");
    }
  });
});

app.get("/about", function(req, res){
  res.render("about", {aboutContent: aboutContent});
});

app.get("/contact", function(req, res){
  res.render("contact", {contactContent: contactContent});
});

app.post("/remove", function(req, res){
  console.log(req.body.postBody);
  ImgModel.findByIdAndRemove(req.body.postBody, function(err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });

});



app.get("/:postId", function(req, res){
  //const requestedTitle = _.lowerCase(req.params.postName);
  const requestedPostId = req.params.postId;

    //Post.findOne({_id: requestedPostId}, function(err, post){
    ImgModel.findOne({name: requestedPostId}, function(err, img){
      console.log(err);
//      console.log(img.img.data!=="");//if it is not null, it means we have pic in this record.
//      console.log(img.hasOwnProperty('oneTimeOnly'));
      console.log(img);
      if(!err && img.length!==0){
        if(typeof img.img.data === 'undefined'){
          console.log("without pics");
          if(img.oneTimeOnly == "oneTime"){
            res.render("postNoImg", {
              title: img.name,
              content: img.desc,
              _id: "This is one time reading. The record is removed."
              });
            ImgModel.findByIdAndRemove(img._id, function(err) {
              if (err) {
                console.log(err);
              } else {
                ;
              }
            });
          }
          else{
            res.render("postNoImg", {
              title: img.name,
              content: img.desc,
              _id: img._id
              });
          }
        }else{
          console.log("with pics");
          if(img.oneTimeOnly=='n'){
            res.render("post", {
              title: img.name,
              content: img.desc,
              image:img,
              _id: img._id
              });
          }else{
              //has image, but need to remove this collection.
              ImgModel.findByIdAndRemove(img._id, function(err) {
                if (err) {
                  console.log(err);
                } else {
                  res.render("post", {
                    title: img.name,
                    content: img.desc,
                    image:img,
                    _id: "This is one time reading. The record is removed."
                    });
                }
              });
          }

        }
      }
    })
    .orFail(
      function(){
        // => new Error('Not Found')
        res.render("error", {errorContent: errorContent});

    });

});

app.listen(PORT, function(err) {
  if (err)
      throw err;
  console.log("Server started on port "+PORT );
});
