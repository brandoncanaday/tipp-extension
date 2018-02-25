
(function() {

    // this will be changed when deploying new release
    const LIVE_DOMAIN_URL = 'https://tippextension.com';

    runInitCode();

    // code immediately executed upon invocation of closure
    function runInitCode() {
        // when YT is done changing to new video (for new youtube design)
        window.addEventListener("yt-navigate-finish", () => {
            if(window.location.pathname == '/watch') prepareVideoPage();
        });
        // when YT is done changing to new video (for old youtube design)
        window.addEventListener("spfdone", () => {
            if(window.location.pathname == '/watch') prepareVideoPage();
        });
        // listen for postMessage after Stripe Checkout submission
        window.addEventListener("message", (e) => {
            if(window.location.pathname == '/watch') handlePostMessage(e);
        }, false);
        // initial call on actual page navigation to new video
        if(window.location.pathname == '/watch') prepareVideoPage();
    }

    // determines if a Tipp button should be added to current YT video page,
    // and if so, calls addTippButton
    function prepareVideoPage() {
        // grab video id of current page
        let v = getParameterByName('v');
        // check if channel owner of new video has Stripe-enabled Tipp account
        getStripeUserFromYTVideo(v, (stripeUser) => {
            // add appropriate kind of Tipp button to the page.
            let $tippButton = createTippButton(stripeUser);
            // check if need to append to old youtube layout or new youtube layout
            let $container = document.getElementById('watch8-action-buttons');
            if($container) {
                // old youtube layout
                appendTippButton($container, $tippButton, false);
            } else {
                // new youtube layout
                $container = document.querySelector('#info.ytd-video-primary-info-renderer');
                appendTippButton($container, $tippButton, true);
            }
            // load AutoNumeric into page to enable Tipp amount formatting
            if(stripeUser) addAutoNumericToPage();
            // add Stripe Checkout submit interceptor to YT page
            if(stripeUser) addStripeCheckoutInterceptToPage();
        });
    }

    // check if channel of video is in YTChannels table on backend
    function getStripeUserFromYTVideo(video, callback) {
        chrome.runtime.sendMessage({
            "message": "get_stripe_user_from_YT_video",
            "video": video
        }, (response) => {
            callback(response);
        });
    }

    // creates and returns a Tipp button of the appropriate kind:
    // 1) built with Tipp amount form if content creator has Stripe-enabled
    // Tipp account.
    // 2) built with call-to-action message asking user to tell the creator
    // to create such an account.
    function createTippButton(stripeUser) {
        let $tipp = document.createElement('button');
        let $img = document.createElement('img');
        let $popup = (stripeUser.stripeId) ? createTippAmountForm() : createCallToAction();
        let $loginPrompt = createLoginPrompt();

        $tipp.className += ' tipp-ext-btn';
        $tipp.className += ' yt-uix-button-group';
        $tipp.className += ' yt-uix-tooltip';
        $tipp.setAttribute('data-tooltip-text', 'Tipp me');
        $tipp.setAttribute('data-destination', stripeUser.stripeId);
        $tipp.setAttribute('data-fname', stripeUser.fname);
        $tipp.setAttribute('data-lname', stripeUser.lname);
        $tipp.setAttribute('data-displayname', stripeUser.displayname);
        $tipp.addEventListener('click', () => {
            tippIconButtonClickHandler($tipp, $popup, $loginPrompt);
        });

        $img.setAttribute('src', chrome.extension.getURL('img/tipp-icon-btn.svg'));
        $img.style.height = '26px';
        $img.style.width = '26px';

        $tipp.appendChild($img);
        $tipp.appendChild($popup);
        $tipp.appendChild($loginPrompt);

        return $tipp;
    }

    // creates and returns an amount form to be used as a popup
    // when clicking on the Tipp button
    function createTippAmountForm() {
        let $form = document.createElement('form');
        // form body
        $form.className += ' tipp-form tipp-amount-form tipp-popup tipp-scale-transition tipp-scale-out';
        $form.innerHTML += '<img src='+chrome.extension.getURL('img/tipp_brand.png')+' alt="tipp logo"/>';
        $form.innerHTML += '<div class="tipp-input-field">'+
                        '<input type="text" id="tipp-amount" '+
                                'oninvalid="this.setCustomValidity(\'You must enter an amount.\')" '+
                                'oninput="this.setCustomValidity(\'\')" '+
                                'autocomplete="off" required>'+
                        '<label for="tipp-amount">Enter Amount'+
                        '</label>'+
                      '</div>'+
                      '<button class="tipp-btn tipp-green tipp-hoverable" type="submit">Confirm'+
                      '</button>';
        // listeners for form
        $form.addEventListener('click', (e) => e.stopPropagation());
        $form.addEventListener('submit', handleTippAmountFormSubmit);
        // listeners for amount input
        let $amountInput = $form.querySelector('#tipp-amount');
        $amountInput.addEventListener('mousewheel', (e) => e.preventDefault());
        $amountInput.addEventListener('change', () => {
            let $label = $amountInput.parentNode.querySelector('label');
            if($amountInput.value) {
                $label.classList.add('tipp-active');
            } else {
                $label.classList.remove('tipp-active');
            }
        });
        return $form;
    }

    // submit handler for Tipp amount form. called only if user is also logged in
    function handleTippAmountFormSubmit(e) {
        e.preventDefault();
        const TIPP_MIN_AMOUNT = 1;
        const $tipp = document.querySelector('.tipp-ext-btn');
        const $amountInput = e.target.querySelector('#tipp-amount');
        const $label = $amountInput.parentNode.querySelector('label');
        const $chooseAmount = e.target.querySelector('button[type=submit]');
        const dollars = currencyToNumber($amountInput.value);
        if(!dollars || dollars < TIPP_MIN_AMOUNT) {
            // invalid dollar amount
            $amountInput.classList.add('tipp-invalid');
            $label.textContent = "Enter Tipp Amount ($1.00 minimum)";
        } else {
            // get necessary values for Stripe Checkout
            const amount = dollars*100; // in cents
            const fname = $tipp.getAttribute("data-fname");
            const lname = $tipp.getAttribute("data-lname");
            const displayname = $tipp.getAttribute("data-displayname");
            // build dynamically-loaded Stripe Checkout button
            const $checkoutForm = createStripeCheckoutForm(amount, fname, lname, displayname);
            // replace choose amount button with Stripe Checkout button
            $amountInput.style.display = 'none';
            $label.style.display = 'none';
            $chooseAmount.style.display = 'none';
            e.target.appendChild($checkoutForm);
        }
    }

    // creates and returns Stripe Checkout form that is to be embedded
    // into YT video page and shown upon Tipp Payment amount selection
    function createStripeCheckoutForm(amount, fname, lname, displayname) {
        const CHECKOUT_CONFIG = {
            'data-key': 'pk_test_Ico77z8GgHKmrINbf9VnxIRY',
            'data-name': 'Tipp',
            'data-image': 'https://image.ibb.co/kF2Apm/tipp_128x128.png',
            'data-description': `A Tipp for @${displayname}`,
            'data-panel-label': "Tipp {{amount}}",
            'data-label': "Tipp with Card",
            'data-locale': 'auto',
            'data-zip-code': true,
            'data-billing-address': true,
            'data-bitcoin': true
        };
        let $checkout = document.createElement('form');
        let $script = document.createElement('script');
        // build pay button
        $checkout.className = 'tipp-stripe-payment-form';
        $checkout.setAttribute('action', `${LIVE_DOMAIN_URL}/api/dummy`);
        $checkout.setAttribute('method', 'GET');
        // build dynamically-loaded Stripe script tag
        $script.src = 'https://checkout.stripe.com/checkout.js';
        $script.className = 'stripe-button';
        $script.setAttribute('data-amount', amount);
        // set necessary values for Stripe Checkout
        for(let key in CHECKOUT_CONFIG) {
            if(CHECKOUT_CONFIG.hasOwnProperty(key)) {
                $script.setAttribute(key, CHECKOUT_CONFIG[key]);
            }
        }
        // add dynamically-loaded Stripe pay button to form
        $checkout.appendChild($script);
        return $checkout;
    }

    // creates and returns a call to action for the user, as a popup
    // when clicking on the Tipp button
    function createCallToAction() {
        const COMMENT = "Hey, so I just wanted to say that I'm a long-time fan, "+
                        "and I appreciate all the content you put out on a regular basis. "+
                        "Also, I just tried to donate to your video here, but in order for me "+
                        "to be able to do that, you have to install this Chrome extension called Tipp.\n\n"+
                        "If you want more information, just visit their website, "+
                        "but it basically just allows people like me, who want to give a bit more than a Like, "+
                        "to make a donation on your video.\n\n"+
                        "If you let your audience know they should download it, too, "+
                        "then they'll be able to start giving out donations where they see fit "+
                        "(as well as being able to receive donations themselves).\n\n"+
                        "Anyways, keep up the great work!";

        const $callToAction = document.createElement('div');
        $callToAction.className += ' tipp-form tipp-popup tipp-call-to-action tipp-scale-transition tipp-scale-out';
        
        const $img = document.createElement('img');
        $img.src = chrome.extension.getURL('img/tipp_48x48.png');
        
        const $p = document.createElement('p');
        $p.textContent = "This channel hasn't configured their Tipp account to receive donations yet.";
        
        const $button = document.createElement('button');
        $button.className += ' tipp-btn tipp-green tipp-hoverable';
        $button.textContent = "Let them know";
        $button.setAttribute('data-comment', COMMENT);
        $button.addEventListener('click', (e) => {
            // trigger comment box to open
            const $commentBoxTrigger = document.querySelector('.comment-simplebox-trigger');
            let clickEvent;
            clickEvent = document.createEvent("MouseEvents");
            clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            $commentBoxTrigger.dispatchEvent(clickEvent);
            // insert comment text and enable comment submit button
            const $commentBox = document.querySelector('.comment-simplebox-text');
            const $commentBoxSubmit = document.querySelector('.comment-simplebox-submit');
            if($commentBox) $commentBox.textContent = e.target.getAttribute('data-comment');
            if($commentBoxSubmit) $commentBoxSubmit.removeAttribute('disabled');
            // // potentially auto-submit comment as well ??
            // if($commentBoxSubmit) $commentBoxSubmit.dispatchEvent(clickEvent);
        });
        
        $callToAction.appendChild($img);
        $callToAction.appendChild($p);
        $callToAction.appendChild($button);
        $callToAction.addEventListener('click', e => e.stopPropagation());
        return $callToAction;
    }

    // creates and returns a login prompt for the user, and is
    // show as a popup when clicking on the Tipp button
    function createLoginPrompt() {
        let $loginPrompt = document.createElement('div');
        $loginPrompt.className += ' tipp-form tipp-popup tipp-login-prompt tipp-scale-transition tipp-scale-out';
        $loginPrompt.innerHTML += '<img src='+chrome.extension.getURL('img/tipp_48x48.png')+' alt="tipp logo"/>';
        $loginPrompt.innerHTML += '<p>You must be logged in to Tipp someone!</p>';
        $loginPrompt.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        return $loginPrompt;
    }

    // add AutoNumeric library to page for Tipp amount formatting
    function addAutoNumericToPage() {
        if(!document.querySelector('script[data-library=autonumeric]')) {
            // only add AutoNumeric if not there already
            addScriptToPage('https://cdn.jsdelivr.net/npm/autonumeric@4.1.0-beta.16/dist/autoNumeric.min.js', 'autonumeric', () => {
                // now that AutoNumeric is loaded into the page, initialize it by
                // adding an initializer function to the page as well
                addFunctionToPage(initializeAutoNumericInput, 'autonumeric-initializer');
            });
        }
    }

    // add Stripe Checkout intercept script to page in order to submit via ajax
    function addStripeCheckoutInterceptToPage() {
        if(!document.querySelector('script[data-label=stripeCheckoutIntercept]')) {
            // only add stripe checkout interceptor if not there already
            addFunctionToPage(stripeCheckoutSubmitIntercept, 'stripeCheckoutIntercept');
        }
    }

    // creates & adds an immediately-invoked function expression with a
    // label to the page
    function addFunctionToPage(f, label) {
        let $script = document.createElement('script');
        $script[($script['innerText']) ? 'innerText' : 'textContent'] = '('+f+')()';
        $script['data-label'] = label;
        document.head.appendChild($script);
    }

    // creates and adds a script tag with a given source and label to page,
    // performing a callback once it has been loaded
    function addScriptToPage(src, label, callback) {
        let $script = document.createElement('script');
        $script['src'] = src;
        $script['data-label'] = label;
        $script.onload = callback;
        document.head.appendChild($script);
    }

    // adds beforeunload listener to page window in order to intercept
    // Checkout submission and send the returned Stripe token values to
    // content script postMessage listener
    function stripeCheckoutSubmitIntercept() {
        window.addEventListener('beforeunload', () => {
            let token = null;
            let $tokenIdField = document.querySelector('input[name=stripeToken]');
            if($tokenIdField) {
                // build token obj to send via postMessage
                token = {};
                // for each hidden input, grab value we need for token,
                // and then remove it so not detected more than once
                $tokenIdField.parentNode.querySelectorAll('input[type=hidden]').forEach((input) => {
                    token[input.getAttribute("name")] = input.value;
                    input.parentNode.removeChild(input);
                });
            }
            // only send message if received token
            if(token) {
                window.postMessage({
                    "message": "STRIPE_CARD_TOKENIZED",
                    "token": token
                }, "*");
            }
        });
    }

    // adds AutoNumeric initializing code to page window in order to
    // have robust currency formatting for #tipp-amount input element
    function initializeAutoNumericInput() {
        const TIPP_MIN_AMOUNT = 1;
        window.tippAmountInput = new AutoNumeric('#tipp-amount').northAmerican({ 
            minimumValue: TIPP_MIN_AMOUNT
        });
    }

    // listens for message from the embedded Checkout interceptor and
    // sends the Checkout token values to background script
    function handlePostMessage(e) {
        if(e.source == window && e.data.message && (e.data.message == "STRIPE_CARD_TOKENIZED")) {
            // received message that was expected,
            // from page that was expected to send it
            if(e.data.token.stripeToken) {
                // token definitely contains necessary data
                const $tipp = document.querySelector('.tipp-ext-btn');
                const $popup = $tipp.querySelector('.tipp-popup');
                const $loginPrompt = $tipp.querySelector('.tipp-login-prompt');
                const amount = document.querySelector('script.stripe-button').getAttribute("data-amount");
                const destination = $tipp.getAttribute("data-destination");
                const fname = $tipp.getAttribute("data-fname");
                const lname = $tipp.getAttribute("data-lname");
                const displayname = $tipp.getAttribute("data-displayname");
                // close Tipp form after Stripe Checkout complete
                tippIconButtonClickHandler($tipp, $popup, $loginPrompt);
                // send data to background.js to send to backend
                chrome.runtime.sendMessage({
                    "message": "perform_tipp",
                    "data": {
                        token: e.data.token,
                        amount,
                        destination,
                        fname,
                        lname,
                        displayname
                    }
                });
            }
        }
    }

    // Tipp button click handler. shows/hides tooltips and the applicable popup/login prompt
    function tippIconButtonClickHandler($tipp, $popup, $loginPrompt) {
        // hide/remove tooltip on click
        $tipp.classList.toggle('yt-uix-tooltip');
        document.querySelectorAll('.yt-uix-tooltip-tip').forEach(($tooltip) => {
            let content = $tooltip.querySelector('.yt-uix-tooltip-tip-content').textContent;
            if(content == 'Tipp me') $tooltip.style.display = 'none';
        });
        if($popup.classList.contains('tipp-scale-in')) {
            // popup is showing, so hide it (and reset if popup is form)
            $popup.classList.remove('tipp-scale-in');
            $tipp.setAttribute('data-tooltip-text', 'Tipp me');
            if(!$popup.classList.contains('tipp-call-to-action')) {
                setTimeout(() => resetTippForm($popup), 200);
            }
        } else if($loginPrompt.classList.contains('tipp-scale-in')) {
            // login prompt is showing, so hide it
            $loginPrompt.classList.remove('tipp-scale-in');
            $tipp.setAttribute('data-tooltip-text', 'Tipp me');
        } else {
            // both popup and login prompt not showing, so
            // first hide tooltips
            $tipp.setAttribute('data-tooltip-text', '');
            $tipp.setAttribute('title', '');
            // then check if user is logged in. if not, show login prompt.
            // otherwise, show popup
            chrome.runtime.sendMessage({
                "message": "is_logged_in"
            }, (response) => {
                if(response.loggedIn) {
                    // show the popup the Tipp button was built with
                    $popup.classList.add('tipp-scale-in');
                } else {
                    // show the login prompt
                    $loginPrompt.classList.add('tipp-scale-in');
                }
            });
        }
    }

    // appends the finished Tipp button element to the given container element
    function appendTippButton($container, $tippButton, newYT) {
        // remove old button if still there
        const $oldTippBtn = $container.querySelector('.tipp-ext-btn');
        if($oldTippBtn) $oldTippBtn.parentNode.removeChild($oldTippBtn);
        // append new button
        if(!newYT) {
            // old youtube layout
            $container.appendChild($tippButton);
            $container.addEventListener('mouseenter', () => {
                $tippButton.classList.add('pulse');
            });
            $container.addEventListener('mouseleave', () => {
                $tippButton.classList.remove('pulse');
            });
        } else {
            // new youtube layout
            let $flexNode = $container.querySelector('#flex');
            $flexNode.parentNode.insertBefore($tippButton, $flexNode.nextSibling);
            $container.addEventListener('mouseenter', () => {
                $tippButton.classList.add('pulse');
            });
            $container.addEventListener('mouseleave', () => {
                $tippButton.classList.remove('pulse');
            });
        }
    }

    // resets the Tipp amount form and all its values to a default state
    function resetTippForm($form) {
        let $stripePaymentForm = $form.querySelector('.tipp-stripe-payment-form');
        let $chooseAmount = $form.querySelector('button[type=submit]');
        let $amountInput = $form.querySelector('#tipp-amount');
        let $label = $amountInput.parentNode.querySelector('label');
        $amountInput.value = "";
        $label.classList.remove('tipp-active');
        $amountInput.classList.remove('tipp-invalid');
        $label.textContent = "Enter Amount";
        $amountInput.style.display = 'inline-block';
        $label.style.display = 'inline-block';
        $chooseAmount.style.display = 'inline-block';
        if($stripePaymentForm) $form.removeChild($stripePaymentForm);
    }

    // // tries to convert given currency string to numeric value
    function currencyToNumber(value) {
        let amount = +(value.replace(/[^0-9.]+/g,''));
        return isNaN(amount) ? undefined : amount;
    }

    // tries to grab the value of a given query string param from either
    // the current window url, or the given url
    function getParameterByName(name, url) {
        if(!url) url = window.location.href;
        name = name.replace(/[[\]]/g, "\\$&");
        let regex = new RegExp("[#?&]" + name + "(=([^&#]*)|&|#|$)");
        let results = regex.exec(url);
        if(!results) return null;
        if(!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

})();
