const functions = require("firebase-functions"),
	express = require("express"),
	app = express(),
	bodyParser = require("body-parser"),
	admin = require("firebase-admin"),
	cookieParser = require("cookie-parser");

/*=============================================>>>>>

				= init and config =

===============================================>>>>>*/

admin.initializeApp({
	credential: admin.credential.applicationDefault(),
});
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
