/**
 * This stores all the database queries
 * Helps in connecting to database by viewing values in .env
 */

var dotenv =  require('dotenv');
var pgp = require('pg-promise')(/* options */);  // From express documentation

// Loading dotenv
dotenv.config();

// Database ones
db = pgp(process.env.DATABASE_URL)

/**
 * Function to create insert statement from json data
 * @param {JSON DATA} data 
 * @param {String} tablename 
 */
function create_insert_statement(jsondata, tablename){
    var stmt = "";
    stmt = "INSERT INTO "+tablename+"";
    var col="(";
    var val="(";

    Object.keys(jsondata).forEach(function(key){
        //console.log(key)
        col+=('"'+key+'",');
        //console.log(data[key])
        if(key === 'dateadded'){  // Addd all the colums which are of date type, as date type is like this one
            val+=("'"+jsondata[key]+"',");
        }
        else if(key ==='total'){
            val+=("NULLIF('"+jsondata[key]+"','')::integer,");  // This is for integer values (Type casting to Integer in sql)
        }
        else{
            val+=("NULLIF('"+jsondata[key]+"',''),");   // This NULLIF does enter null value if the string is empty
        }
    });
    col = (col.substring(0,col.length-1)+")");
    val = (val.substring(0,val.length-1)+")");
    stmt+=(col+" VALUES"+val);
    return(stmt);
}
//Add Query Functions

/* Function to get details of all users */
function getAllUsers(req, res, next){
    db.any('select userid, name, email from users')
    .then(function(data){
        res.status(200)
        .json({
          status: 'success',
          data: data,
          message: 'Retrieved ALL Users'
        });
    })
    .catch(function (err) {
        return next(err);
      });
}

/* API to add a book */
/* Using xxx-urlencoded  DON't Forget to send correct data only*/
function addBook(req, res, next){

    var date = new Date();
    var year = date.getFullYear().toString();
    var month = (date.getMonth()>9)?(date.getMonth.toString()):('0'+date.getMonth());
    var d = (date.getDate()>9)?(date.getDate().toString()):('0'+date.getDate());
    var today = year + '-'+month + '-' + d;

    //res.json(req.body);
    reqbody=req.body;
    reqbody['dateadded']=today;
    var stmt = create_insert_statement(reqbody, 'books');
    //res.end(stmt);

    if('name' in reqbody){
        db.one(stmt+' returning id')
        .then(function(data){
            res.status(200)
                .render('addbook.ejs', {title: "Add Book", flashMessage: "{ status: 'success', id: '"+data['id']+"', message: 'Successfully Added the Book - "+reqbody['name']+"' }", name: req.session.name});
        })
        .catch(err =>{
            return next(err);
        });
    } else{  // Some constraints of the function
        res.end('"name" not supplied in method body');
    }
}

/* REST API to add a user */
function addUser(req, res, next){
    var reqbody = req.body;
    reqbody['isadmin']=false
    var stmt = create_insert_statement(reqbody, 'users');
    db.one(stmt + ' returning userid')
        .then(function (data) {
            res.status(200)
                .json({
                    status: 'success',
                    id: data['userid'],
                    message: 'Successfully added the user'
                });
        })
        .catch(err => {
            return next(err);
        });
}

/* Function to check Valid Login or not */
function checkLogin(req, res, next){
    if(req.session.userid){
        res.end("Already logged in!\n");
    }

    var req_email = req.body.email;
    var req_password = req.body.password;
    // Executing one or None
    db.oneOrNone ("select userid,password,name,isadmin from users where email=$1", req_email)
        .then(function(data){
            try{
                if(data['password'] === req_password){
                    // Adding cookies for session
                    req.session.userid=data['userid'];
                    req.session.email=req_email;
                    req.session.name=data['name'];
                    if(data['isadmin']){
                        req.session.isadmin=true;
                    }else{
                        req.session.isadmin=false;
                    }

                    // Redirecting as logged in
                    res.status(200);
                    res.redirect('/');
                }
                else{
                    //res.end("Invalid Password");
                    res.render('login.ejs', {title: 'Login Page!', flashMessage: 'Invalid Password!'});
                }
            } catch(e){    // try - catch is checking that the data is not null
                console.log(e);
                // The user does not exists
                res.render('login.ejs', { title: 'Login Page!', flashMessage: 'Username does not exist!'});
            }
        })
        .catch(err => {
            return next(err);
        });
}

/* Function to register a new user */
function registerUser(req, res, next){
    if(req.session.userid){
        res.end("First log out to Enter new user\n");
    }

    var req_name = req.body.name;
    var req_email = req.body.email;
    var req_password = req.body.password;

    db.oneOrNone("select userid from users where email=$1", req_email)
        .then(useridgot => {
            try{
                var ifitexists = (useridgot['userid']);
                res.render('register.ejs', { title: 'Login Page!', flashMessage: 'This email already exists!'});
            }
            // The above try gives error when the userid does not exists
            catch{
                
                //Now create a new user
                db.one("Insert into users(name, email, password, isadmin) values($1,$2,$3,$4) returning userid",[req_name, req_email, req_password, false])
                .then(function(data){
                    console.log("successfully added the new user",data['userid']);
                    
                    // Adding cookies for session
                    req.session.userid=data['userid'];
                    req.session.email=req_email;
                    req.session.name=req_name;
                    req.session.isadmin=false;

                    // Redirecting as logged in
                    res.status(200);
                    res.redirect('/');
                })
                .catch(err =>{
                    return next(err);
                });
            }
        })
        .catch(err => {
            return next(err);
        });
}

/* Function to view all the books */
function viewBooks(req, res, next){
    if(req.session.email){
        db.any('select * from books')
        .then(function(data){
            /*
            data.forEach(item =>{
                console.log(item);
            })
            */
            res.status(200)
            res.render('books.ejs', { title: 'Books', name: req.session.name, data: data})
    })
    .catch(function (err) {
        return next(err);
      });
    }else{
        res.redirect('/login');
    }
}

module.exports = {
    getAllUsers: getAllUsers,
    addBook: addBook,
    addUser: addUser,
    checkLogin: checkLogin,
    registerUser: registerUser,
    viewBooks: viewBooks
};
