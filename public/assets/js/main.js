type = ["", "info", "success", "warning", "danger"];

main = {
	showSwal: function (type) {
		if (type == "basic") {
			swal({
				title: "Here's a message!",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
			});
		} else if (type == "loginContinue") {
			swal({
				title: "Email Application",
				text: "Please login to continue!",
				timer: 1000,
				showConfirmButton: false,
			});
		} else if (type == "signingIn") {
			swal({
				title: "Email Application",
				text: "Signing into your account...",
				timer: 1250,
				showConfirmButton: false,
			});
		} else if (type == "emailInvalid") {
			swal({
				title: "Should start with letter and end with @email.com",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
			});
		} else if (type == "wrongPattern") {
			swal({
				title:
					"Password must contain at least one number, one upper case, one lower case, and at least 8 or more characters",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
			});
		} else if (type == "passwordNoMatch") {
			swal({
				title: "Password don't match",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
			});
		} else if (type == "title-and-text") {
			swal({
				title: "Here's a message!",
				text: "It's pretty, isn't it?",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-info btn-fill",
			});
		} else if (type == "success-message") {
			swal({
				title: "Good job!",
				text: "You clicked the button!",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
				type: "success",
			});
		} else if (type == "warning-message-and-confirmation") {
			swal({
				title: "Are you sure?",
				text: "You won't be able to revert this!",
				type: "warning",
				showCancelButton: true,
				confirmButtonClass: "btn btn-success btn-fill",
				cancelButtonClass: "btn btn-danger btn-fill",
				confirmButtonText: "Yes, delete it!",
				buttonsStyling: false,
			}).then(function () {
				swal({
					title: "Deleted!",
					text: "Your file has been deleted.",
					type: "success",
					confirmButtonClass: "btn btn-success btn-fill",
					buttonsStyling: false,
				});
			});
		} else if (type == "warning-message-and-cancel") {
			swal({
				title: "Are you sure?",
				text: "You will not be able to recover this imaginary file!",
				type: "warning",
				showCancelButton: true,
				confirmButtonText: "Yes, delete it!",
				cancelButtonText: "No, keep it",
				confirmButtonClass: "btn btn-success btn-fill",
				cancelButtonClass: "btn btn-danger btn-fill",
				buttonsStyling: false,
			}).then(
				function () {
					swal({
						title: "Deleted!",
						text: "Your imaginary file has been deleted.",
						type: "success",
						confirmButtonClass: "btn btn-success btn-fill",
						buttonsStyling: false,
					});
				},
				function (dismiss) {
					// dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
					if (dismiss === "cancel") {
						swal({
							title: "Cancelled",
							text: "Your imaginary file is safe :)",
							type: "error",
							confirmButtonClass: "btn btn-info btn-fill",
							buttonsStyling: false,
						});
					}
				}
			);
		} else if (type == "custom-html") {
			swal({
				title: "HTML example",
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
				html:
					"You can use <b>bold text</b>, " +
					'<a href="http://github.com">links</a> ' +
					"and other HTML tags",
			});
		} else if (type == "auto-close") {
			swal({
				title: "Auto close alert!",
				text: "I will close in 2 seconds.",
				timer: 2000,
				showConfirmButton: false,
			});
		} else if (type == "input-field") {
			swal({
				title: "Input something",
				html:
					'<div class="form-group">' +
					'<input id="input-field" type="text" class="form-control" />' +
					"</div>",
				showCancelButton: true,
				confirmButtonClass: "btn btn-success btn-fill",
				cancelButtonClass: "btn btn-danger btn-fill",
				buttonsStyling: false,
			})
				.then(function (result) {
					swal({
						type: "success",
						html:
							"You entered: <strong>" +
							$("#input-field").val() +
							"</strong>",
						confirmButtonClass: "btn btn-success btn-fill",
						buttonsStyling: false,
					});
				})
				.catch(swal.noop);
		} else {
			swal({
				title: "Error!",
				text: type,
				buttonsStyling: false,
				confirmButtonClass: "btn btn-success btn-fill",
			});
		}
	},

	checkFullPageBackgroundImage: function () {
		$page = $(".full-page");
		image_src = $page.data("image");

		if (image_src !== undefined) {
			image_container =
				'<div class="full-page-background" style="background-image: url(' +
				image_src +
				') "/>';
			$page.append(image_container);
		}
	},

	initFormExtendedSliders: function () {
		// Sliders for main purpose in refine cards section
		var slider = document.getElementById("sliderRegular");

		noUiSlider.create(slider, {
			start: 40,
			connect: [true, false],
			range: {
				min: 0,
				max: 100,
			},
		});

		var slider2 = document.getElementById("sliderDouble");

		noUiSlider.create(slider2, {
			start: [20, 60],
			connect: true,
			range: {
				min: 0,
				max: 100,
			},
		});
	},
};
