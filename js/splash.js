
(function() {

    // init all modals
    $('.modal').modal();

    // first sign up page submit
    document.querySelector('#tipp-register .form-page-1').addEventListener('submit', submitFirstSignUpPage);
    // last sign up page submit
    document.querySelector('#tipp-register .form-page-2').addEventListener('submit', submitLastSignUpPage);
    // go back to first sign up page
    document.querySelector('#back-btn').addEventListener('click', goToFirstSignUpPage);

    // submit login form
    document.querySelector('#tipp-login').addEventListener('submit', submitLoginForm);

    // listeners for passphrase reset form
    document.querySelector('#tipp-passphrase-reset').addEventListener('submit', submitPassphraseResetForm);

    // submits basic info form of sign up flow. first checks db for availability of 
    // chosen displayname availability, and then moves on to the next page if available
    function submitFirstSignUpPage(e) {
        e.preventDefault();
        // clean form errors every submission
        removeValidationError('#tipp-register .basic-information-fields');
        // grab everything we need
        const fname = $('#tipp-fname').val();
        const lname = $('#tipp-lname').val();
        const displayname = $('#tipp-displayname').val();
        // check if all values exist
        const err = validateBasicInfoRegisterPage(fname, lname, displayname);
        if(err.type) {
            // some field was missing. show validation error
            showValidationError('#tipp-register .basic-information-fields', err);
        } else {
            // disable submit button
            e.target.querySelector('button[type=submit]').disabled = true;
            // let user know work is being done
            openLoadingScreen('', 'green');
            // all basic validation checks passed, so check on displayname availability
            chrome.runtime.sendMessage({
                "message": "displayname_availability",
                "data": { displayname }
            }, (response) => {
                // delay for better user experience
                setTimeout(() => {
                    if(response.error) {
                        // error with Tipp backend, show on sign up form
                        showValidationError('#tipp-register .basic-information-fields', response.error);
                        closeLoadingScreen();
                    } else if(response.exists) {
                        // no error, but displayname was taken
                        showValidationError('#tipp-register .basic-information-fields', validateRegisterInput(response.exists));
                        closeLoadingScreen();
                    } else {
                        // displayname was not taken, so advance to last sign up page
                        goToLastSignUpPage();
                        closeLoadingScreen();
                    }
                    // enable submit button
                    e.target.querySelector('button[type=submit]').disabled = false;
                }, 700);
            });
        }
        return false;
    }

    // handles Tipp registration form submission. if successful,
    // creates user on backend and redirects to their dashboard
    function submitLastSignUpPage(e) {
        e.preventDefault();
        // clean form errors every submission
        removeValidationError('#tipp-register .login-information-fields');
        // grab everything we need
        const fname = $('#tipp-fname').val();
        const lname = $('#tipp-lname').val();
        const displayname = $('#tipp-displayname').val();
        const email = $('#tipp-email').val();
        const passphrase = $('#tipp-passphrase').val();
        const passphrase_repeat = $('#tipp-passphrase-repeat').val();
        // perform simple input validation
        const err = validateRegisterInput(false, fname, lname, displayname, email, passphrase, passphrase_repeat);
        if(err.type) {
            // simple input validation error
            showValidationError('#tipp-register .login-information-fields', err);
        } else {
            // disable submit button
            e.target.querySelector('button[type=submit]').disabled = true;
            // let user know work is being done
            openLoadingScreen('', 'green');
            // basic form requirements met, so create user on backend
            chrome.runtime.sendMessage({
                "message": "create_user",
                "data": { fname, lname, displayname, email, passphrase }
            }, (response) => {
                // delay for better user experience
                setTimeout(() => {
                    if(response.error) {
                        // error creating user, so show on sign up form
                        showValidationError('#tipp-register .login-information-fields', response.error);
                        closeLoadingScreen();
                    } else {
                        // account creation success, so log user in
                        window.location.replace(chrome.runtime.getURL('dashboard.html'));
                    }
                    // enable submit button
                    e.target.querySelector('button[type=submit]').disabled = false;
                }, 700);
            });
        }
        return false;
    }

    // advances to the last sign up page (email, passphrase) 
    function goToLastSignUpPage() {
        const $firstPage = $('#tipp-register .form-page-1');
        const $secondPage = $('#tipp-register .form-page-2');
        // slide out first page
        $firstPage.css({
            "-webkit-transform": "translateX(-200%)",
            "-ms-transform": "translateX(-200%)",
            "transform": "translateX(-200%)"
        });
        $firstPage.css("visibility", "hidden");
        // slide in second page
        $secondPage.css("visibility", "visible");
        $secondPage.css({
            "-webkit-transform": "translateX(0)",
            "-ms-transform": "translateX(0)",
            "transform": "translateX(0)"
        });
    }


    // advances to the first sign up page (fname, lname, displayname)
    function goToFirstSignUpPage() {
        const $firstPage = $('#tipp-register .form-page-1');
        const $secondPage = $('#tipp-register .form-page-2');
        // slide in first page
        $firstPage.css("visibility", "visible");
        $firstPage.css({
            "-webkit-transform": "translateX(0)",
            "-ms-transform": "translateX(0)",
            "transform": "translateX(0)"
        });
        // slide out second page
        $secondPage.css({
            "-webkit-transform": "translateX(200%)",
            "-ms-transform": "translateX(200%)",
            "transform": "translateX(200%)"
        });
        $secondPage.css("visibility", "hidden");
    }

    // handle Tipp login form submission. if successful,
    // redirects user to their dashboard
    function submitLoginForm(e) {
        e.preventDefault();
        // clean form errors every submission
        removeValidationError('#tipp-login .field-group');
        // grab everything we need
        const email = $('#tipp-login-email').val();
        const passphrase = $('#tipp-login-passphrase').val();
        // perform simple input validation
        const err = validateLoginInput(email, passphrase);
        if(err.type) {
            // simple input validation error
            showValidationError('#tipp-login .field-group', err);
        } else {
            // disable submit button
            e.target.querySelector('button[type=submit]').disabled = true;
            // let user know work is being done
            openLoadingScreen('', 'green');
            // basic form requirements met, so check login details
            chrome.runtime.sendMessage({
                "message": "login_user",
                email,
                passphrase
            }, (response) => {
                // delay for better user experience
                setTimeout(() => {
                    if(response.error) {
                        // error with Tipp backend or login details, show on login form
                        showValidationError('#tipp-login .field-group', response.error);
                        closeLoadingScreen();
                    } else {
                        // user login details were correct, redirect to dashboard
                        window.location.replace(chrome.runtime.getURL('dashboard.html'));
                    }
                    // enable submit button
                    e.target.querySelector('button[type=submit]').disabled = false;
                }, 700);
            });
        }
        return false;
    }

    // handle Tipp passphrase reset form submission. if successful, sends
    // a passphrase reset link to the given email and lets user know
    function submitPassphraseResetForm(e) {
        e.preventDefault();
        // clean form errors every submission
        removeValidationError('#tipp-passphrase-reset');
        // grab everything we need
        const email = $('#passphrase-reset-email').val();
        const email_repeat = $('#passphrase-reset-email-repeat').val();
        // perform simple input validation
        const err = validatePassphraseResetEmail(email, email_repeat);
        if(err.type) {
            // simple input validation error
            showValidationError('#tipp-passphrase-reset', err);
        } else {
            // disable submit button
            document.querySelector('#passphrase-reset-modal button[type=submit]').disabled = true;
            // let user know work is being done
            openLoadingScreen('', 'green');
            // basic form requirements met, so check login details
            chrome.runtime.sendMessage({
                "message": "reset_passphrase",
                email
            }, (response) => {
                // delay for better user experience
                setTimeout(() => {
                    if(response.error) {
                        // error sending reset link email
                        showValidationError('#tipp-passphrase-reset', response.error);
                        closeLoadingScreen();
                    } else {
                        // passphrase reset link sent to user, so close modal
                        closeLoadingScreen();
                        $('#passphrase-reset-modal').modal('close');
                        // reset values for next time
                        $('#passphrase-reset-email').val('');
                        $('#passphrase-reset-email-repeat').val('');
                    }
                    // enable submit button
                    document.querySelector('#passphrase-reset-modal button[type=submit]').disabled = false;
                }, 700);
            });
        }
        return false;
    }

    // checks if input to passphrase reset form is valid
    function validatePassphraseResetEmail(email, email_repeat) {
        const error = {};
        if(!email || !email_repeat) {
            error.type = 'missing_field';
            error.msg = 'Both fields are required.';
            return error;
        }
        if(email != email_repeat) {
            error.type = 'email_repeat';
            error.msg = 'Re-typed email does not match.';
            return error;
        }
        return error;
    }

    // checks if all of the required basic info was provided
    function validateBasicInfoRegisterPage(fname, lname, displayname) {
        const error = {};
        if(!fname || !lname || !displayname) {
            error.type = 'missing_field';
            error.msg = 'All fields are required.';
            return error;
        }
        return error;
    }

    // validates Tipp account creation form input, populates error object accordingly
    function validateRegisterInput(displaynameTaken, fname, lname, displayname, email, passphrase, passphrase_repeat) {
        const error = {};
        if(displaynameTaken) {
            error.type = 'user_exists';
            error.msg = 'Displayname already in use.';
            return error;
        }
        if(!fname || !lname || !displayname || !email || !passphrase || !passphrase_repeat) {
            error.type = 'missing_field';
            error.msg = 'All fields are required.';
            return error;
        }
        if(passphrase.length < 15) {
            error.type = 'passphrase';
            error.msg = 'For your security, passphrase must be at least 15 characters.';
            return error;
        }
        if(passphrase != passphrase_repeat) {
            error.type = 'passphrase_repeat';
            error.msg = 'Re-typed passphrase does not match.';
            return error;
        }
        return error;
    }

    // validates Tipp login form input, populates error object accordingly
    function validateLoginInput(email, passphrase) {
        const error = {};
        if(!email || !passphrase) {
            error.type = 'missing_field';
            error.msg = 'Both fields are required.';
            return error;
        }
        if(passphrase.length < 15) {
            error.type = 'passphrase';
            error.msg = 'Passphrase should be at least 15 characters, think harder.';
            return error;
        }
        return error;
    }

    // displays form error in appropriate place on Tipp form
    function showValidationError(selector, error) {
        const $p = $('<p></p>');
        $p.addClass('validation-error');
        $p.text(error.msg);
        $p.insertAfter(`${selector} > *:last-child`);
    }

    // removes any displayed validation error from the Tipp form
    function removeValidationError(selector) {
        if($(selector).length) {
            $(selector).find('.validation-error').remove();
        }
    }

    // opens preloader modal with a given message and preloader color
    function openLoadingScreen(msg, color) {
        let $loaderModal = document.querySelector('.tipp-preloader-modal');
        let $spinner = $loaderModal.querySelector('.spinner-layer');
        let $msg = document.querySelector('.tipp-preloader-modal .header');
        // set text of modal
        $msg.textContent = msg;
        // remove previous color of loader
        $spinner.classList.remove('spinner-blue-only');
        $spinner.classList.remove('spinner-red-only');
        $spinner.classList.remove('spinner-green-only');
        // change color of loader
        switch(color) {
        case 'blue':
            $spinner.classList.add('spinner-blue-only');
            break;
        case 'red':
            $spinner.classList.add('spinner-red-only');
            break;
        case 'green':
        default:
            $spinner.classList.add('spinner-green-only');
            break;
        }
        // shows modal
        $loaderModal.style.display = 'block';
    }

    // closes preloader modal
    function closeLoadingScreen() {
        document.querySelector('.tipp-preloader-modal').style.display = 'none';
    }

})();
