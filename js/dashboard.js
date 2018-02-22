
console.log("DASHBOARD SCRIPT EXECUTED");

(function() {

    // init side nav trigger
    M.Sidenav.init(document.querySelector('.side-nav'));
    // $('.hamburger').sideNav();

    // init all modals
    M.Modal.init(document.querySelectorAll('.modal'));
    $('.modal').modal();

    // init Tipp dashboard
    initTippDashboard();

    // add necessary click handlers
    document.querySelector('#stripe-connect-btn a').addEventListener('click', handleStripeConnect);
    document.querySelector('#stripe-dashboard-btn a').addEventListener('click', handleOpenStripeDashboard);
    document.querySelector('#logout-btn a').addEventListener('click', logout);
    document.querySelector('#yt-connect-btn a').addEventListener('click', handleYTConnect);
    document.querySelector('#delete-account-btn').addEventListener('click', handleDeleteAccount);

    // initializes the entire dashboard for the newly logged-in Tipp user
    function initTippDashboard() {
        openLoadingScreen('', 'green');
        const acc = getCachedValue('tipp_account');
        // fill in user's basic info (from cached user)
        $('.user-view .name').text(`${acc.fname} ${acc.lname}`);
        $('.user-view .username').text(`@${acc.displayname}`);
        // show appropriate Stripe button (from cached user)
        initStripeButtons();
        // show user's connected channels
        if(acc.channels.length) {
            // change profile pic to icon of first connected channel
            changeImage(acc.channels[0].channelIcon, '.user-view .profile-pic');
            // insert user's connected channels into UI
            insertYTChannelList(acc.channels, '#yt-account');
        }
        // show helpful messages if new user
        initToasts();
        // dashboard is now ready
        setTimeout(() => closeLoadingScreen(), 700);
    }

    // handles when user clicks the button to create a Stripe account
    function handleStripeConnect() {
        openLoadingScreen('', 'blue');
        // send request to start Stripe connect
        setTimeout(() => {
            chrome.runtime.sendMessage({
                "message": "start_stripe_oauth"
            }, (response) => {
                // check on response
                if(!response.error) {
                    // no error, so update UI with newly connected YT channels
                    initStripeButtons();
                    closeLoadingScreen();
                } else if(response.error.type == 'forbidden') {
                    // illegal access error, so logout user
                    logout();
                } else {
                    // some other error, so just close loading screen
                    closeLoadingScreen();
                }
            });
        }, 700);
    }

    // handles when user clicks their Stripe dashboard button
    function handleOpenStripeDashboard() {
        // make sure user has Stripe account already
        if(getCachedValue('tipp_account').stripe) {
            // user has connected a Stripe account
            openLoadingScreen('', 'blue');
            // send request to get dashboard link
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    "message": "open_stripe_dashboard"
                }, (response) => {
                    // check on response
                    if(!response.error) {
                        // no error, so just close loading screen
                        closeLoadingScreen();
                    } else if(response.error.type == 'forbidden') {
                        // illegal access error, so logout user
                        logout();
                    } else {
                        // some other error, so just close loading screen
                        closeLoadingScreen();
                    }
                });
            }, 700);
        }
    }

    // handles when user clicks the add YT account button
    function handleYTConnect() {
        openLoadingScreen('', 'red');
        // start Google OAuth in background, and then wait for the connected
        // YT channels that were added to db to be returned from backend
        setTimeout(() => {
            chrome.runtime.sendMessage({
                "message": "start_youtube_connect_flow"
            }, (response) => {
                // check on response
                if(!response.error) {
                    // no error, so update UI with newly connected YT channels
                    const acc = getCachedValue('tipp_account');
                    if(acc.channels.length) {
                        changeImage(acc.channels[0].channelIcon, '.user-view .profile-pic');
                        insertYTChannelList(acc.channels, '#yt-account');
                    }
                    // close loading screen
                    closeLoadingScreen();
                } else if(response.error.type == 'forbidden') {
                    // illegal access error, so logout user
                    logout();
                } else {
                    // some other error, so just close loading screen
                    closeLoadingScreen();
                }
            });
        }, 700);
    }

    // handles when user wants to delete their Tipp account
    function handleDeleteAccount() {
        openLoadingScreen('', 'green');
        // send request to delete user
        setTimeout(() => {
            chrome.runtime.sendMessage({
                "message": "delete_user"
            }, (response) => {
                // check on response
                if(!response.error) {
                    // account was deleted successfully, so 
                    // empty their cache + redirect back to sign up page
                    setCachedValue('tipp_account', {});
                    window.location.replace(chrome.runtime.getURL('splash.html'));
                } else if(response.error.type == 'forbidden') {
                    // illegal access error, so logout user
                    logout();
                } else {
                    // some other error, so just close the loading screen
                    closeLoadingScreen();
                }
            }); 
        }, 700);
    }


    // ------------------------------
    // ---------- HELPERS -----------
    // ------------------------------


    // TODO: initializes any relevant call to action toasts displayed in
    // the dashboard upon logging in
    function initToasts() {
        const newUser = getCachedValue('tipp_account').newUser;
        if(newUser) {
            // step 1 (if new user, show a helpful, dismissable toast chain)
            M.toast({
                html: '1 of 3: Now, add a YouTube channel.',
                classes: 'red white-text',
                callback: () => {
                    // step 2
                    M.toast({
                        html: '2 of 3: Then, connect a Stripe account.',
                        classes: 'blue white-text',
                        callback: () => {
                            // step 3
                            M.toast({
                                html: '3 of 3: You can now receive audience donations!',
                                classes: 'green white-text'
                            });
                        }
                    });
                }
            });
        }
    }

    // shows logout modal for a set time, then empties the user cache 
    // + redirects back to the login page
    function logout() {
        openLoadingScreen('', 'green');
        // logout user and redirect (after designed delay)
        setTimeout(() => {
            // empty cached user info
            setCachedValue('tipp_account', {});
            // redirect back to login page
            window.location.replace(chrome.runtime.getURL('splash.html'));
        }, 700);
    }

    // initializes Stripe connect button (displayed or not),
    // as well as the main dashboard call to action and the
    // My Stripe Dashboard button (disabled or not)
    function initStripeButtons() {
        if(getCachedValue('tipp_account').stripe) {
            // user has connected a Stripe account
            document.querySelector('#stripe-dashboard-btn a').style.display = 'block';
            document.querySelector('#stripe-connect-btn a').style.display = 'none';
        } else {
            document.querySelector('#stripe-dashboard-btn a').style.display = 'none';
            document.querySelector('#stripe-connect-btn a').style.display = 'block';
        }
    }

    // opens preloader modal with a given message and preloader color
    function openLoadingScreen(msg, color) {
        let $loaderModal = document.querySelector('.tipp-preloader-modal');
        let $spinner = $loaderModal.querySelector('.spinner-layer');
        let $msg = document.querySelector('.tipp-preloader-modal .msg');
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

    // changes src attribute of an img w/ the given selector to the given URL
    function changeImage(imgURL, selector) {
        let $img = document.querySelector(selector);
        $img.src = imgURL;
    }

    // given an array of channel documents returned from the YTChannels
    // table on the backend, inserts it into the UI after the element w/
    // the given selector
    function insertYTChannelList(channels, selector) {
        let $li = document.createElement('li');
        $li.id += 'channel-collection-item';
        let $collection = makeChannelCollection(channels);
        $li.appendChild($collection);
        // remove previous collection, if necessary
        const $prevChannelCollection = document.querySelector('#channel-collection-item');
        if($prevChannelCollection) $prevChannelCollection.remove();
        // replace with updated collection
        $(selector).after($li);
    }

    // creates a list of channel items for each connected YT channel
    // in the given array of channel documents returned from the YTChannels
    // table on the backend
    function makeChannelCollection(channels) {
        let $collection = document.createElement('ul');
        $collection.className += 'collection yt-channels ';
        channels.forEach((el) => {
            let $chip = makeChip('yt-channel', el.channelIcon, el.channelName, 'check');
            $collection.appendChild($chip);
        });
        return $collection;
    }

    // creates and returns materialize.css chip element w/ a given
    // classname, image url, text content, and optional icon (e.g. 'check')
    function makeChip(className, img, title, icon) {
        let $chip = document.createElement('div');
        let $img = document.createElement('img');
        let $text = document.createTextNode(title);
        let $icon = (icon) ? createMaterialIcon(icon) : null;
        $chip.className += 'chip ';
        $chip.className += className+' ';
        $img.src = img;
        $chip.appendChild($img);
        $chip.appendChild($text);
        if($icon) $chip.appendChild($icon);
        return $chip;
    }

    // creates materialize.css icon w/ given name
    function createMaterialIcon(name) {
        let $icon = document.createElement('i');
        let $iconText = document.createTextNode(name);
        $icon.className += 'material-icons ';
        $icon.appendChild($iconText);
        return $icon;
    }

    // sets localStorage[key] to JSON-stringified obj
    function setCachedValue(key, obj) {
        localStorage.setItem(key, JSON.stringify(obj));
    }

    // gets JSON-parsed obj stored in localStorage[key]
    function getCachedValue(key) {
        return JSON.parse(localStorage.getItem(key));
    }

})();
