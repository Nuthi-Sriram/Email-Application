const functions = require("firebase-functions"),
	storage=require('@google-cloud/storage'),
	express = require("express"),
	https = require("https"),
	app = express(),
	bodyParser = require("body-parser"),
	admin = require("firebase-admin"),
	cookieParser = require("cookie-parser");
	const qs = require("querystring");
	const checksum_lib = require("./Paytm/checksum");
	const config = require("./Paytm/config");
/*=============================================>>>>>

				= init and config =

===============================================>>>>>*/

admin.initializeApp({
	credential: admin.credential.applicationDefault(),
});
const parseUrl = express.urlencoded({ extended: false });
const parseJson = express.json({ extended: false });
app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended: true,
	})
);
app.use(cookieParser());
app.set("views", "./views");
app.set("view engine", "ejs");
var db = admin.firestore();

/*=============================================>>>>>

				= security functions =

===============================================>>>>>*/

function checkCookieMiddleware(req, res, next) {
	const sessionCookie = req.cookies.__session || "";
	admin
		.auth()
		.verifySessionCookie(sessionCookie, true)
		.then((decodedClaims) => {
			req.decodedClaims = decodedClaims;
			next();
			return;
		})
		.catch((error) => {
			console.log(error);
			res.redirect("/signOut");
		});
}

function checkValidUser(req, res, next) {
	if (req.decodedClaims.phone_number && req.decodedClaims.email_verified) {
		next();
		return;
	} else {
		res.redirect("/updateProfile");
	}
}

function setCookieLogin(idToken, res) {
	const expiresIn = 60 * 60 * 24 * 5 * 1000;
	admin
		.auth()
		.createSessionCookie(idToken, {
			expiresIn,
		})
		.then(
			(sessionCookie) => {
				const options = {
					maxAge: expiresIn,
					httpOnly: true,
					secure: false, //should be true in prod
				};
				res.cookie("__session", sessionCookie, options);
				admin
					.auth()
					.verifyIdToken(idToken)
					.then((decodedClaims) => {
						console.log(decodedClaims);
						if (
							decodedClaims.phone_number &&
							decodedClaims.email_verified
						) {
							return res.redirect("/inbox");
						} else {
							return res.redirect("/updateProfile");
						}
					})
					.catch((error) => {
						console.log(error);
					});
				return;
			},
			(error) => {
				console.log(error);
				res.status(401).send("UNAUTHORIZED REQUEST!");
			}
		)
		.catch((error) => {
			console.log(error);
		});
}

function setCookieRegister(idToken, res) {
	const expiresIn = 60 * 60 * 24 * 5 * 1000;
	admin
		.auth()
		.createSessionCookie(idToken, {
			expiresIn,
		})
		.then(
			(sessionCookie) => {
				const options = {
					maxAge: expiresIn,
					httpOnly: true,
					secure: false, //should be true in prod
				};
				res.cookie("__session", sessionCookie, options);
				admin
					.auth()
					.verifyIdToken(idToken)
					.then((decodedClaims) => {
						res.redirect("/updateProfile");
						return console.log(decodedClaims);
					})
					.catch((error) => {
						console.log(error);
					});
				return;
			},
			(error) => {
				console.log(error);
				res.status(401).send("UNAUTHORIZED REQUEST!");
			}
		)
		.catch((error) => {
			console.log(error);
		});
}

/*=============================================>>>>>

				= basic routes =

===============================================>>>>>*/

app.get("/", (req, res) => {
	if (req.cookies.__session) {
		res.redirect("/inbox");
	} else {
		res.render("login");
	}
});
// Paytm wallet _______________----------------------------------->>>>>>>>>>>>>>>>>

app.get("/payForm", (req, res) => {
	res.render("payForm");
});

  app.post("/paynow", [parseUrl, parseJson], (req, res) => {
	// Route for making payment
  
	var paymentDetails = {
	  amount: req.body.amount,
	  customerId: req.body.name,
	  customerEmail: req.body.email,
	  customerPhone: req.body.phone
  }
  if(!paymentDetails.amount || !paymentDetails.customerId || !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
	  res.status(400).send('Payment failed')
  } else {
	  var params = {};
	  params['MID'] = config.PaytmConfig.mid;
	  params['WEBSITE'] = config.PaytmConfig.website;
	  params['CHANNEL_ID'] = 'WEB';
	  params['INDUSTRY_TYPE_ID'] = 'Retail';
	  params['ORDER_ID'] = 'TEST_'  + new Date().getTime();
	  params['CUST_ID'] = paymentDetails.customerId;
	  params['TXN_AMOUNT'] = paymentDetails.amount;
	  params['CALLBACK_URL'] = 'http://localhost:5000/callback';
	  params['EMAIL'] = paymentDetails.customerEmail;
	  params['MOBILE_NO'] = paymentDetails.customerPhone;
  
  
	  checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {

			if(err){
				console.log(err);
			}
		  var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
		  // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production
  
		  var form_fields = "";
		  for (var x in params) {
			  form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
		  }
		  form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";
  
		  res.writeHead(200, { 'Content-Type': 'text/html' });
		  res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
		  res.end();
	  });
  }
  });
  app.post("/callback", (req, res) => {
	// Route for verifiying payment
  
	var body = '';
  
	req.on('data', function (data) {
	   body += data;
	});
  
	 req.on('end', function () {
	   var html = "";
	   var post_data = qs.parse(body);
  
	   // received params in callback
	   console.log('Callback Response: ', post_data, "\n");
  
  
	   // verify the checksum
	   var checksumhash = post_data.CHECKSUMHASH;
	   // delete post_data.CHECKSUMHASH;
	   var result = checksum_lib.verifychecksum(post_data, config.PaytmConfig.key, checksumhash);
	   console.log("Checksum Result => ", result, "\n");
  
  
	   // Send Server-to-Server request to verify Order Status
	   var params = {"MID": config.PaytmConfig.mid, "ORDERID": post_data.ORDERID};
  
	   checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
			if(err){
				console.log(err);
			}
		 params.CHECKSUMHASH = checksum;
		 post_data = 'JsonData='+JSON.stringify(params);
  
		 var options = {
		   hostname: 'securegw-stage.paytm.in', // for staging
		   // hostname: 'securegw.paytm.in', // for production
		   port: 443,
		   path: '/merchant-status/getTxnStatus',
		   method: 'POST',
		   headers: {
			 'Content-Type': 'application/x-www-form-urlencoded',
			 'Content-Length': post_data.length
		   }
		 };
  
  
		 // Set up the request
		 var response = "";
		 var post_req = https.request(options, function(post_res) {
		   post_res.on('data', function (chunk) {
			 response += chunk;
		   });
  
		   post_res.on('end', function(){
			 console.log('S2S Response: ', response, "\n");
  
			 var _result = JSON.parse(response);
			   if(_result.STATUS === 'TXN_SUCCESS') {
				   res.send('payment sucess')
			   }else {
				   res.send('payment failed')
			   }
			 });
		 });
  
		 // post the data
		 post_req.write(post_data);
		 post_req.end();
		});
	   });
  });
  


//   End of paytm wallet code ------------------------------------------------->>>>>

app.get("/uploadKYC", (req, res) => {
	if (req.cookies.__session) {
		res.render("uploadKYC");
	} else {
		res.render("login");
	}
});

app.get("/displayKYC", (req, res) => {
	if (req.cookies.__session) {
		res.render("displayKYC");
	} else {
		res.render("login");
	}
});

app.get("/offline", (req, res) => {
	res.render("offline");
});
/*=============================================>>>>>

			= Authentication =

===============================================>>>>>*/

app.get("/login", (req, res) => {
	if (req.cookies.__session) {
		res.redirect("/inbox");
	} else {
		res.render("login");
	}
});
app.get("/sessionLogin", (req, res) => {
	setCookieLogin(req.query.idToken, res);
});
app.get("/register", (req, res) => {
	if (req.cookies.__session) {
		res.redirect("/inbox");
	} else {
		res.render("register");
	}
});
app.get("/sessionRegister", (req, res) => {
	setCookieRegister(req.query.idToken, res);
});
app.get("/signOut", (req, res) => {
	res.clearCookie("__session");
	res.redirect("/login");
});
app.get("/forgotPassword", (req, res) => {
	if (req.cookies.__session) {
		res.redirect("/inbox");
	} else {
		res.render("forgotPassword");
	}
});
app.get("/updatePassword", (req, res) => {
	res.clearCookie("__session");
	res.render("updatePassword");
});
app.post("/passwordReset", (req, res) => {
	if (req.cookies.__session) {
		res.redirect("/inbox");
	} else {
		admin
			.auth()
			.getUserByEmail(req.body.email)
			.then((userRecord) => {
				userRecord = Object.assign({}, userRecord);
				return res.render("passwordReset", {
					userRecord,
				});
			})
			.catch((error) => {
				console.log("Error fetching user data:", error);
			});
	}
});
app.get("/uid", checkCookieMiddleware, (req, res) => {
	res.send(req.decodedClaims.uid);
});

/*=============================================>>>>>

			= User profile =

===============================================>>>>>*/

app.get("/userProfile", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				console.log("No such document!");
				return res.redirect("/login");
			} else {
				user = Object.assign({}, req.decodedClaims);
				userProfile = Object.assign({}, doc.data());
				console.log(user);
				return res.render("userProfile", {
					userProfile,
					user,
				});
			}
		})
		.catch((err) => {
			console.log("Error getting document", err);
			res.redirect("/login");
		});
});
app.post(
	"/onUserProfileUpdate",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		admin
			.auth()
			.updateUser(req.decodedClaims.uid, {
				phoneNumber: req.body.countryCode + req.body.mobile,
				displayName: req.body.firstName + " " + req.body.lastName,
				emailVerified: true,
			})
			.then((userRecord) => {
				console.log("Successfully updated user", userRecord.toJSON());
				db.collection("users").doc(userRecord.uid).set({
					DOB: req.body.DOB,
					addressLine1: req.body.address1,
					addressLine2: req.body.address2,
					city: req.body.city,
					country: req.body.country,
					bio: req.body.bio,
					postalCode: req.body.postalCode,
				});
				return res.redirect("/signOut");
			})
			.catch((error) => {
				console.log("Error updating user:", error);
			});
	}
);
app.get("/updateProfile", checkCookieMiddleware, (req, res) => {
	if (req.decodedClaims.phone_number && req.decodedClaims.email_verified) {
		res.redirect("/inbox");
	} else {
		user = Object.assign({}, req.decodedClaims);
		res.render("updateProfile", {
			user,
		});
		user = Object.assign({}, req.decodedClaims);
	}
});
app.post("/onUpdateProfile", checkCookieMiddleware, (req, res) => {
	admin
		.auth()
		.updateUser(req.decodedClaims.uid, {
			phoneNumber: req.body.countryCode + req.body.mobile,
			displayName: req.body.firstName + " " + req.body.lastName,
			emailVerified: true,
		})
		.then((userRecord) => {
			console.log("Successfully updated user", userRecord.toJSON());
			db.collection("users").doc(userRecord.uid).set({
				DOB: req.body.DOB,
				addressLine1: req.body.address1,
				addressLine2: req.body.address2,
				city: req.body.city,
				country: req.body.country,
				bio: req.body.bio,
				postalCode: req.body.postalCode,
			});
			return res.redirect("/signOut");
		})
		.catch((error) => {
			console.log("Error updating user:", error);
		});
});
app.get("/deleteProfile", checkCookieMiddleware, checkValidUser, (req, res) => {
	admin
		.auth()
		.deleteUser(req.decodedClaims.uid)
		.then(() => {
			db.collection("users")
				.doc(req.decodedClaims.uid)
				.delete()
				.catch((err) => {
					console.log("Error getting document", err);
					return res.redirect("/signOut");
				});
			return res.redirect("/signOut");
		})
		.catch((error) => {
			console.log("Error deleting user:", error);
		});
});
app.post("/userQuery", (req, res) => {
	admin
		.auth()
		.getUserByEmail(req.body.checkEmail)
		.then(() => {
			return res.send("User exists");
		})
		.catch((error) => {
			console.log(error);
			return res.send("User doesn't exist");
		});
});
app.post("/userIDQuery", checkCookieMiddleware, checkValidUser, (req, res) => {
	admin
		.auth()
		.getUserByEmail(req.body.checkEmail)
		.then((userRecord) => {
			return res.send(userRecord.uid);
		})
		.catch((error) => {
			console.log(error);
			return res.send("User doesn't exist");
		});
});

/*=============================================>>>>>

				= Contacts =

===============================================>>>>>*/

app.get("/contacts", checkCookieMiddleware, checkValidUser, (req, res) => {
	var i = 0,
		contactData = new Array(),
		contactID = new Array();
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("contacts")
		.get()
		.then((querySnapshot) => {
			querySnapshot.forEach((childSnapshot) => {
				contactID[i] = childSnapshot.id;
				contactData[i] = childSnapshot.data();
				i++;
			});
			contactsData = Object.assign({}, contactData);
			contactsID = Object.assign({}, contactID);
			user = Object.assign({}, req.decodedClaims);
			return res.render("contacts", {
				user,
				contactsData,
				contactsID,
			});
		})
		.catch((err) => {
			console.log("Error getting contacts", err);
			res.redirect("/login");
		});
});
app.get("/addContact", checkCookieMiddleware, checkValidUser, (req, res) => {
	user = Object.assign({}, req.decodedClaims);
	res.render("addContact", {
		user,
	});
});
app.post("/onAddContact", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("contacts")
		.doc()
		.set({
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			DOB: req.body.DOB,
			emailAddress: req.body.emailAddress,
			countryCode: req.body.countryCode,
			mobile: req.body.mobile,
		});
	return res.redirect("/inbox");
});
app.get("/editContact", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("contacts")
		.doc(req.query.ID)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				console.log("No such document!");
				return res.redirect("/login");
			} else {
				user = Object.assign({}, req.decodedClaims);
				userProfile = Object.assign({}, doc.data());
				return res.render("editContact", {
					contactID: req.query.ID,
					userProfile,
					user,
				});
			}
		})
		.catch((err) => {
			console.log("Error getting document", err);
			res.redirect("/login");
		});
});
app.post(
	"/onEditContact",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		db.collection("users")
			.doc(req.decodedClaims.uid)
			.collection("contacts")
			.doc(req.body.contactID)
			.update({
				firstName: req.body.firstName,
				lastName: req.body.lastName,
				DOB: req.body.DOB,
				emailAddress: req.body.emailAddress,
				countryCode: req.body.countryCode,
				mobile: req.body.mobile,
			});
		return res.redirect("/inbox");
	}
);
app.get("/deleteContact", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("contacts")
		.doc(req.query.ID)
		.delete()
		.catch((err) => {
			console.log("Error getting document", err);
			res.redirect("/login");
		});
	return res.redirect("/inbox");
});

/*=============================================>>>>>

				= Email =

===============================================>>>>>*/

app.get("/inbox", checkCookieMiddleware, checkValidUser, (req, res) => {
	var i = 0,
		emailData = new Array(),
		emailID = new Array();
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("receivedEmails")
		.get()
		.then((querySnapshot) => {
			querySnapshot.forEach((childSnapshot) => {
				emailID[i] = childSnapshot.id;
				emailData[i] = childSnapshot.data();
				i++;
			});
			emailsData = Object.assign({}, emailData);
			emailsID = Object.assign({}, emailID);
			user = Object.assign({}, req.decodedClaims);
			return res.render("inbox", {
				user,
				emailsData,
				emailsID,
			});
		})
		.catch((err) => {
			console.log("Error getting contacts", err);
			res.redirect("/login");
		});
});
app.get("/readEmail", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("receivedEmails")
		.doc(req.query.ID)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				console.log("No such document!");
				return res.redirect("/login");
			} else {
				user = Object.assign({}, req.decodedClaims);
				emailData = Object.assign({}, doc.data());
				return res.render("readEmail", {
					emailID: req.query.ID,
					emailData,
					user,
				});
			}
		})
		.catch((err) => {
			console.log("Error getting document", err);
			res.redirect("/login");
		});
});
app.get("/readSentEmail", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("sentEmails")
		.doc(req.query.ID)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				console.log("No such document!");
				return res.redirect("/login");
			} else {
				user = Object.assign({}, req.decodedClaims);
				emailData = Object.assign({}, doc.data());
				return res.render("readSentEmail", {
					emailID: req.query.ID,
					emailData,
					user,
				});
			}
		})
		.catch((err) => {
			console.log("Error getting document", err);
			res.redirect("/login");
		});
});
app.get(
	"/readDraftedEmail",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		db.collection("users")
			.doc(req.decodedClaims.uid)
			.collection("draftedEmails")
			.doc(req.query.ID)
			.get()
			.then((doc) => {
				if (!doc.exists) {
					console.log("No such document!");
					return res.redirect("/login");
				} else {
					user = Object.assign({}, req.decodedClaims);
					emailData = Object.assign({}, doc.data());
					return res.render("readDraftedEmail", {
						draftID: req.query.ID,
						emailData,
						user,
					});
				}
			})
			.catch((err) => {
				console.log("Error getting document", err);
				res.redirect("/login");
			});
	}
);
app.post("/markAsRead", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("receivedEmails")
		.doc(req.body.emailID)
		.update({ status: "read" })
		.then(() => {
			return res.send("Marked as read!");
		})
		.catch((err) => {
			console.log("Error ", err);
			res.redirect("/login");
		});
});
app.post("/markAsUnread", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("receivedEmails")
		.doc(req.body.emailID)
		.update({ status: "unread" })
		.then(() => {
			return res.send("Marked as unread!");
		})
		.catch((err) => {
			console.log("Error ", err);
			res.redirect("/login");
		});
});
app.get("/sentEmails", checkCookieMiddleware, checkValidUser, (req, res) => {
	var i = 0,
		emailData = new Array(),
		emailID = new Array();
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("sentEmails")
		.get()
		.then((querySnapshot) => {
			querySnapshot.forEach((childSnapshot) => {
				emailID[i] = childSnapshot.id;
				emailData[i] = childSnapshot.data();
				i++;
			});
			emailsData = Object.assign({}, emailData);
			emailsID = Object.assign({}, emailID);
			user = Object.assign({}, req.decodedClaims);
			console.log(emailsData);
			return res.render("sentEmails", {
				user,
				emailsData,
				emailsID,
			});
		})
		.catch((err) => {
			console.log("Error getting contacts", err);
			res.redirect("/login");
		});
});
app.get("/composeEmail", checkCookieMiddleware, checkValidUser, (req, res) => {
	user = Object.assign({}, req.decodedClaims);
	res.render("composeEmail", {
		user,
	});
});
app.post("/sendEmail", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.body.receiverUID)
		.collection("receivedEmails")
		.doc()
		.set({
			subject: req.body.subject,
			message: req.body.message,
			timestamp: admin.firestore.Timestamp.now().toDate(),
			to: req.body.receiverEmail,
			from: req.decodedClaims.email,
			status: "unread",
		})
		.then(() => {
			return db
				.collection("users")
				.doc(req.decodedClaims.uid)
				.collection("sentEmails")
				.doc()
				.set({
					subject: req.body.subject,
					message: req.body.message,
					timestamp: admin.firestore.Timestamp.now().toDate(),
					to: req.body.receiverEmail,
					from: req.decodedClaims.email,
				})
				.then(() => {
					return res.redirect("/sentEmails");
				})
				.catch((err) => {
					console.log("Error ", err);
					res.redirect("/login");
				});
		})
		.catch((err) => {
			console.log("Error ", err);
			res.redirect("/login");
		});
});
app.get("/draftedEmails", checkCookieMiddleware, checkValidUser, (req, res) => {
	var i = 0,
		emailData = new Array(),
		emailID = new Array();
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("draftedEmails")
		.get()
		.then((querySnapshot) => {
			querySnapshot.forEach((childSnapshot) => {
				emailID[i] = childSnapshot.id;
				emailData[i] = childSnapshot.data();
				i++;
			});
			emailsData = Object.assign({}, emailData);
			emailsID = Object.assign({}, emailID);
			user = Object.assign({}, req.decodedClaims);
			console.log(emailsData);
			return res.render("draftedEmails", {
				user,
				emailsData,
				emailsID,
			});
		})
		.catch((err) => {
			console.log("Error getting contacts", err);
			res.redirect("/login");
		});
});
app.post("/draftEmail", checkCookieMiddleware, checkValidUser, (req, res) => {
	obj = {
		subject: req.body.subject,
		message: req.body.message,
		timestamp: admin.firestore.Timestamp.now().toDate(),
		to: req.body.receiverEmail,
		from: req.decodedClaims.email,
	};
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.collection("draftedEmails")
		.doc()
		.set(obj)
		.then(() => {
			return res.redirect("/draftedEmails");
		})
		.catch((err) => {
			console.log("Error ", err);
			res.redirect("/login");
		});
});
app.post(
	"/updateDraftedEmail",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		db.collection("users")
			.doc(req.decodedClaims.uid)
			.collection("draftedEmails")
			.doc(req.body.draftID)
			.update({
				subject: req.body.subject,
				message: req.body.message,
				timestamp: admin.firestore.Timestamp.now().toDate(),
				to: req.body.receiverEmail,
				from: req.decodedClaims.email,
			})
			.then(() => {
				return res.redirect("/draftedEmails");
			})
			.catch((err) => {
				console.log("Error ", err);
				res.redirect("/login");
			});
	}
);
app.post(
	"/sendDraftedEmail",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		console.log(req.body, req.query);
		db.collection("users")
			.doc(req.body.receiverUID)
			.collection("receivedEmails")
			.doc()
			.set({
				subject: req.body.subject,
				message: req.body.message,
				timestamp: admin.firestore.Timestamp.now().toDate(),
				to: req.body.receiverEmail,
				from: req.decodedClaims.email,
				status: "unread",
			})
			.then(() => {
				return db
					.collection("users")
					.doc(req.decodedClaims.uid)
					.collection("sentEmails")
					.doc()
					.set({
						subject: req.body.subject,
						message: req.body.message,
						timestamp: admin.firestore.Timestamp.now().toDate(),
						to: req.body.receiverEmail,
						from: req.decodedClaims.email,
					})
					.then(() => {
						return db
							.collection("users")
							.doc(req.decodedClaims.uid)
							.collection("draftedEmails")
							.doc(req.body.draftID)
							.delete()
							.then(() => {
								return res.redirect("/sentEmails");
							})
							.catch((err) => {
								console.log("Error ", err);
								res.redirect("/login");
							});
					})
					.catch((err) => {
						console.log("Error ", err);
						res.redirect("/login");
					});
			})
			.catch((err) => {
				console.log("Error ", err);
				res.redirect("/login");
			});
	}
);
app.get(
	"/deleteInboxEmail",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		db.collection("users")
			.doc(req.decodedClaims.uid)
			.collection("receivedEmails")
			.doc(req.query.ID)
			.delete()
			.catch((err) => {
				console.log("Error getting document", err);
				res.redirect("/login");
			});
		return res.redirect("/inbox");
	}
);
app.get(
	"/deleteSentEmail",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		db.collection("users")
			.doc(req.decodedClaims.uid)
			.collection("sentEmails")
			.doc(req.query.ID)
			.delete()
			.catch((err) => {
				console.log("Error getting document", err);
				res.redirect("/login");
			});
		return res.redirect("/sentEmails");
	}
);
app.get(
	"/deleteDraftEmail",
	checkCookieMiddleware,
	checkValidUser,
	(req, res) => {
		db.collection("users")
			.doc(req.decodedClaims.uid)
			.collection("draftedEmails")
			.doc(req.query.ID)
			.delete()
			.catch((err) => {
				console.log("Error getting document", err);
				res.redirect("/login");
			});
		return res.redirect("/draftedEmails");
	}
);

app.get("/termsConditions", (req, res) => {
	res.render("termsConditions");
});

app.get("/viewProfile", checkCookieMiddleware, checkValidUser, (req, res) => {
	db.collection("users")
		.doc(req.decodedClaims.uid)
		.get()
		.then((doc) => {
			if (!doc.exists) {
				console.log("No such document!");
				return res.redirect("/login");
			} else {
				user = Object.assign({}, req.decodedClaims);
				userProfile = Object.assign({}, doc.data());
				console.log(user);
				return res.render("viewProfile", {
					userProfile,
					user,
				});
			}
		})
		.catch((err) => {
			console.log("Error getting document", err);
			res.redirect("/login");
		});
});

/*=============================================>>>>>

				= errors =

===============================================>>>>>*/

app.use((req, res, next) => {
	res.status(404).render("errors/404");
});
app.use((req, res, next) => {
	res.status(500).render("errors/500");
});

/*=============================================>>>>>

				= DO NOT PUT ANYTHING AFTER THIS =

===============================================>>>>>*/

exports.app = functions.https.onRequest(app);
