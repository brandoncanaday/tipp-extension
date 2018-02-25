
console.log('BACKGROUND SCRIPT EXECUTED');

(function() {

    // these will be changed when deploying new release
    const LIVE_DOMAIN_URL = 'https://staging.tippextension.com';
    const STRIPE_CLIENT_ID = 'ca_BZRHmzhOuOKgiOM4u2GaqcEy9wkqM4Dn';

    // google stuff
    const GOOGLE_API_KEY   = 'AIzaSyDXr947mAu05wahjTLGZ-0ShCtyu2NVm_g';
    const GOOGLE_CLIENT_ID = '1016457967962-mfps991h6u7u6f51aglairp8uho8odnn.apps.googleusercontent.com';
    const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'+
                              '?scope=profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.readonly&'+
                              'include_granted_scopes=true&'+
                              'redirect_uri=https%3A%2F%2F'+chrome.runtime.id+'.chromiumapp.org&'+
                              'response_type=token&'+
                              'client_id='+GOOGLE_CLIENT_ID;
    const GOOGLE_OAUTH_VALIDATE_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';
    const STRIPE_OAUTH_URL = 'https://connect.stripe.com/express/oauth/authorize'+
                                '?redirect_uri=https%3A%2F%2F'+chrome.runtime.id+'.chromiumapp.org&'+
                                'client_id='+STRIPE_CLIENT_ID;
    // const GITHUB_CLIENT_ID = 'db209c2ac723da32da6e';
    // const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize?client_id='+
    //                             '?redirect_uri=https%3A%2F%2F'+chrome.runtime.id+'.chromiumapp.org&'+
    //                             'client_id='+GITHUB_CLIENT_ID;

    const NOTIFICATION = {
        'accountCreation': {
            success: {
                title: 'Account Creation Success',
                message: "You can now Tipp your favorite videos!"
            },
            failure: {
                title: 'Account Creation Failure',
                message: ''
            }
        },
        'accountDeletion': {
            success: {
                title: 'Account Deletion Success',
                message: "Thank you for using Tipp!"
            },
            failure: {
                title: 'Account Deletion Failure',
                message: 'There was an issue deleting your acccount.'
            }
        },
        'ajaxFailure': {
            title: 'Communication Failure',
            message: 'The connection with Tipp servers failed.'
        },
        'stripeOAuth': {
            success: {
                title: 'Stripe Connect Success',
                message: 'Your Stripe account was connected!'
            },
            failure: {
                title: 'Stripe Connect Failed',
                message: 'Your Stripe account connection failed.'
            }
        },
        'googleOauthAborted': {
            title: 'Google OAuth Failed',
            message: 'Your YouTube channels were not connected.'
        },
        'mongoFailure': {
            title: 'Database Error',
            message: 'There was an issue communicating with the Tipp database.'
        },
        'illegalAccess': {
            title: 'Illegal Access',
            message: 'Your session has expired. Log back in to do that.'
        },
        'stripeDashboardFailure': {
            title: 'Stripe Dashboard Failure',
            message: 'There was an issue generating your dashboard link.'
        },
        'youtubeConnect': {
            success: {
                title: 'YouTube Connect Success',
                message: 'You just expanded your Tipp audience!'
            },
            failure: {
                title: 'YouTube Connect Failed',
                message: 'There was an issue connecting your account.'
            }
        },
        'googlePermissionDenied': {
            title: 'Google OAuth Failed',
            message: 'Necessary permissions were not given.'
        },
        'tippAmountError': {
            title: 'Invalid Tipp Amount',
            message: 'You can only Tipp between $1-$100.'
        },
        'stripeCharge': {
            success: {
                title: 'Tipp Completed',
                message: ''
            },
            failure: {
                title: 'Tipp Failed',
                message: 'There was an issue completing your Tipp.'
            }
        }
    };

    // add Chrome message handler
    chrome.runtime.onMessage.addListener(messageListener);

    // listens for messages from content script and page scripts,
    // takes the appropriate action, and returns a response
    function messageListener(request, sender, sendResponse) {
        switch(request.message) {
        case 'displayname_availability':
            userExists({ 'displayname': request.data.displayname }, sendResponse);
            return true;
        case 'reset_passphrase':
            sendPassphraseResetLink(request.email, sendResponse);
            return true;
        case 'is_logged_in':
            sendResponse({ loggedIn: isLoggedIn() });
            return true;
        case 'create_user':
            registrationFlow(request.data, sendResponse);
            return true;
        case 'delete_user':
            deleteUser(sendResponse);
            return true;
        case 'login_user':
            loginFlow(request.email, request.passphrase, sendResponse);
            return true;
        case 'start_stripe_oauth':
            stripeOAuthFlow(sendResponse);
            return true;
        case 'start_youtube_connect_flow':
            youtubeConnectFlow(sendResponse);
            return true;
        case 'open_stripe_dashboard':
            openStripeDashboard(sendResponse);
            return true;
        case 'get_stripe_user_from_YT_video':
            getStripeIdFromVideo(request.video, sendResponse);
            return true;
        case 'perform_tipp':
            performTipp(request.data, sendResponse);
            return true;
        default:
            console.log('message not recognized');
        }
    }


    // ----- main functionality ------


    // checks existence of user based on given field 
    // (note: must be a single key/value pair in obj)
    function userExists(obj, sendResponse) {
        const key = Object.keys(obj)[0];
        const value = obj[key];
        $.ajax({
            type: "GET",
            url: `${LIVE_DOMAIN_URL}/api/user/${key}-${value}`,
            contentType: 'application/json',
            success: (data) => {
                if(!data.error) {
                    // no error checking db, so send back existence result
                    sendResponse({ exists: data.exists });
                } else {
                    // problem checking mongo db
                    sendResponse({ error: data.error });
                }
            },
            error: () => {
                // problem making request to Tipp backend
                sendResponse({ error: { type: 'ajax', msg: 'There was an issue communicating with the Tipp servers.' } });
            }
        });
    }

    // begins the process of resetting the user's passphrase. sends
    // a passphrase reset link to the specified email address
    function sendPassphraseResetLink(email, sendResponse) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/passphrase-reset-email`,
            data: JSON.stringify({ email }),
            contentType: 'application/json',
            success: (data) => {
                if(!data.error) {
                    // successfully sent reset link
                    notify(
                        "Reset Link Sent",
                        "Check your inbox for an email from us!"
                    );
                }
                // show all errors in form
                sendResponse(data);
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // calls the function that deletes the user's Tipp account, and all its
    // associated data, from the backend db
    function deleteUser(sendResponse) {
        // delete the user and their connected YT channels
        deleteTippAccount(sendResponse, () => {
            // successful Tipp account deletion, so let user know
            handleAccountDeletionSuccess(sendResponse);
        });
    }

    // executes Tipp by creating Stripe charge on backend, which transfers funds from
    // the person Tipping (token), to the content creator with the Stripe-enabled
    // Tipp account (destination)
    function performTipp(tippData, sendResponse) {
        // returns created customer object upon success
        createCharge(tippData, sendResponse, (chargeAmount) => {
            // successful charge (so try to create customer?)
            handleSuccessfulCharge(chargeAmount, sendResponse);
        });
    }

    // begins Google Oauth process for connecting YT accounts of user
    function youtubeConnectFlow(sendResponse) {
        // launch Google auth flow window
        chrome.identity.launchWebAuthFlow({
            'url': GOOGLE_OAUTH_URL,
            'interactive': true
        }, (redirect_url) => {
            // check if oauth flow failed due to user closing window
            if(chrome.runtime.lastError) return handleGoogleOAuthFailure(true, sendResponse);
            // grab auth token from url
            let token = getParameterByName('access_token', redirect_url);
            // check if oauth flow failed due to insufficient permissions
            if(!token) return handleGoogleOAuthFailure(false, sendResponse);
            // validate Google API access token for authenticated user
            validateGoogleOAuthToken(token, sendResponse, () => {
                // call youtube API to retrieve all channels of authorized account
                getChannelsForGoogleUser(token, sendResponse, (response) => {
                    // update "YTChannels" table on backend for all channels of authorized account
                    let channels = buildYTChannelDocuments(response.items);
                    if(!channels.length) {
                        // dont bother making db call if user's Google acc has no YT channels
                        handleNoYTChannelsForAccount(sendResponse);
                    } else {
                        // try to add all YT channels for the Google acc to db on backend
                        addChannels(channels, sendResponse, (numAdded) => {
                            // let user know how many channels were just added
                            notify(
                                NOTIFICATION.youtubeConnect.success.title,
                                (numAdded > 1) ? `${numAdded} channels were just connected.` : `${numAdded} channel was just connected.`
                            );
                            // add new channels to cached user
                            const acc = getCachedValue('tipp_account');
                            acc.channels = acc.channels.concat(channels);
                            setCachedValue('tipp_account', acc);
                            sendResponse({});
                        });
                    }
                });
            });
        });
    }

    // finish Google OAuth by sending token back for validation
    function validateGoogleOAuthToken(token, sendResponse, callback) {
        $.ajax({
            type: "GET",
            url: `${GOOGLE_OAUTH_VALIDATE_URL}?access_token=${token}`,
            success: (data) => {
                if(!data.error && data.aud == GOOGLE_CLIENT_ID) {
                    callback();
                } else {
                    // problem with Google validating token
                    handleYTChannelConnectionFailure(sendResponse);
                }
            },
            error: () => {
                // request to Google failed
                handleYTChannelConnectionFailure(sendResponse);
            }
        });
    }

    // tries to get all YT channels associated with Google account that user authorized
    function getChannelsForGoogleUser(token, sendResponse, callback) {
        $.ajax({
            type: "GET",
            url: `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&access_token=${token}`,
            success: (data) => {
                if(!data.error) {
                    callback(data);
                } else {
                    // problem retrieving data from Youtube
                    handleYTChannelConnectionFailure(sendResponse);
                }
            },
            error: () => {
                // request to Youtube failed
                handleYTChannelConnectionFailure(sendResponse);
            }
        });
    }

    // called when trying to build the Tipp button for the current YT video page
    function getStripeIdFromVideo(video, sendResponse) {
        // makes YT api call to find YT channel associated w/ video id
        getChannelFromVideo(video, sendResponse, (channelId) => {
            // makes backend call to get Stripe account id of Tipp user that connected the channel
            getStripeIdFromChannel(channelId, sendResponse, (data) => {
                // returns the Stripe acc of the Tipp user
                // so the Tipp button can be built
                sendResponse({
                    stripeId: data.stripeId,
                    fname: data.fname,
                    lname: data.lname,
                    displayname: data.displayname
                });
            });
        });
    }

    // gets YT channel from YT API that is associated with given YT video id
    function getChannelFromVideo(video, sendResponse, callback) {
        $.ajax({
            type: "GET",
            url: `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${video}&key=${GOOGLE_API_KEY}`,
            success: (data) => {
                if(!data.error) {
                    let channelId = data.items[0].snippet.channelId;
                    callback(channelId);
                } else {
                    // problem retrieving data from Youtube
                    handleYTChannelConnectionFailure(sendResponse);
                }
            },
            error: () => {
                // request to YT failed
                handleYTChannelConnectionFailure(sendResponse);
            }
        });
    }

    // looks in backend db for Tipp user associated with given channel id,
    // and then returns the user's Stripe account id, if they have one
    function getStripeIdFromChannel(channel, sendResponse, callback) {
        $.ajax({
            type: "GET",
            url: `${LIVE_DOMAIN_URL}/api/stripe-id/${channel}`,
            contentType: 'application/json',
            success: (data) => {
                if(!data.error && data.stripeId) {
                    callback(data);
                } else if(data.error) {
                    handleMongoFailure(sendResponse, data);
                } else {
                    sendResponse({});
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // begins Stripe OAuth for creating a Connect account for the Tipp platform.
    // this is done to begin receiving Tipps, after already creating a basic Tipp account
    function stripeOAuthFlow(sendResponse) {
        // launch Stripe Connect onboarding window
        chrome.identity.launchWebAuthFlow({
            'url': STRIPE_OAUTH_URL,
            'interactive': true
        }, (redirect_url) => {
            // user aborted the Stripe OAuth process
            if(chrome.runtime.lastError) return handleStripeOAuthFailure(sendResponse);
            // user didn't abort, so send auth code to backend to retrieve token for user
            const code = getParameterByName("code", redirect_url);
            // code not in url for some reason
            if(!code) return handleStripeOAuthFailure(sendResponse);
            // get Stripe auth token from code
            getStripeOAuthToken(code, sendResponse, (token) => {
                // update Tipp user on backend with new Stripe account data
                updateUser({ stripe: token }, sendResponse, () => {
                    // update cached user
                    const acc = getCachedValue('tipp_account');
                    acc.stripe = true;
                    setCachedValue('tipp_account', acc);
                    // let dashboard know their Stripe account was created successfully
                    handleStripeOAuthSuccess(sendResponse);
                });
            });
        });
    }

    // upon user sign up, tries to create new user on backend
    function registrationFlow(info, sendResponse) {
        // tries to create user. could fail if displayname or email taken
        createUser(info, sendResponse, (user) => {
            // user sign up successful
            setCachedValue('tipp_account', user);
            handleTippUserCreationSuccess(sendResponse);
        });
    }

    // given registration info, attempts to create Tipp user in backend db
    function createUser(info, sendResponse, callback) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/create-user`,
            data: JSON.stringify(info),
            contentType: 'application/json',
            success: (data) => {
                if(!data.error) {
                    // user successfully created
                    callback(data.user);
                } else if(data.error.type == 'user_exists') {
                    // user already exists with the given displayname OR email
                    sendResponse(data);
                } else {
                    // adding user to backend db failed
                    handleMongoFailure(sendResponse, data);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // attempts to login user with given email and passphrase, and if successful,
    // caches the returned user and sends response to login page
    function loginFlow(email, passphrase, sendResponse) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/login`,
            data: JSON.stringify({ email, passphrase }),
            contentType: 'application/json',
            success: (data) => {
                if(!data.error) {
                    // email and passphrase were correct. cache the user
                    setCachedValue('tipp_account', data.user);
                    chrome.browserAction.setPopup({ popup: 'dashboard.html' });
                    sendResponse({});
                } else {
                    // send error back to login form
                    sendResponse(data);
                }
            },
            error: () => {
                // send error back to login form
                sendResponse({ error: { type: 'backend', msg: 'There was an issue communicating with the Tipp servers.' } });
            }
        });
    }


    // ----- calls a protected route ------


    // deletes Tipp account of logged-in user from backend db. this includes
    // deleting all channels from the YTChannels db, as well as the user from the
    // users db
    function deleteTippAccount(sendResponse, callback) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/auth/delete-user`,
            contentType: 'application/json',
            headers: { "Authorization": `Bearer ${getJWT()}` },
            success: (data) => {
                if(!data.error) {
                    callback();
                } else if(data.error.type == 'forbidden') {
                    // invalid/missing session token
                    handleIllegalAccessFailure(sendResponse, data);
                } else {
                    // db operation error
                    handleAccountDeletionFailure(sendResponse, data);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // tries to call Stripe charges.create on backend to transfer money. Tipp
    // also charges a small fee on the transfer to offset the small fee that
    // Stripe charges the Tipp platform
    function createCharge(tippData, sendResponse, callback) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/auth/charge-card`,
            data: JSON.stringify({
                token: tippData.token,
                amount: tippData.amount,
                destination: tippData.destination,
                fname: tippData.fname,
                lname: tippData.lname,
                displayname: tippData.displayname
            }),
            contentType: 'application/json',
            headers: { "Authorization": `Bearer ${getJWT()}` },
            success: (data) => {
                if(!data.error) {
                    callback(data.chargeAmount);
                } else if(data.error.type == 'forbidden') {
                    // if error was due to invalid/missing session token
                    handleIllegalAccessFailure(sendResponse, data);
                } else {
                    // Stripe destination charge creation error
                    handleStripeChargeFailure(data.error, sendResponse);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // adds given YT channels of an associated Tipp user to backend db
    function addChannels(channels, sendResponse, callback) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/auth/add-channels`,
            data: JSON.stringify(channels),
            contentType: 'application/json',
            headers: { "Authorization": `Bearer ${getJWT()}` },
            success: (data) => {
                if(!data.error) {
                    callback(data.numAdded);
                } else if(data.error.type == 'nothing_inserted') {
                    // all channels for Google account have already been connected
                    handleAlreadyAddedYTChannels(sendResponse);
                } else if(data.error.type == 'forbidden') {
                    // invalid/missing session token
                    handleIllegalAccessFailure(sendResponse, data);
                } else {
                    // db operation error
                    handleMongoFailure(sendResponse, data);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // makes request to Stripe from Tipp backend to retrieve valid Stripe auth token
    // with which Tipp can make authenticated API calls on the user's behalf
    function getStripeOAuthToken(code, sendResponse, callback) {
        $.ajax({
            type: "GET",
            url: `${LIVE_DOMAIN_URL}/api/auth/stripe-token/${code}`,
            contentType: 'application/json',
            headers: { "Authorization": `Bearer ${getJWT()}` },
            success: (data) => {
                if(!data.error) {
                    const token = JSON.parse(data.authToken);
                    callback(token);
                } else if(data.error.type == 'forbidden') {
                    // if error was due to invalid/missing session token
                    handleIllegalAccessFailure(sendResponse, data);
                } else {
                    // problem retrieving auth token from Stripe
                    handleStripeOAuthFailure(sendResponse);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // finds user on backend using session token, and then updates the object with the new
    // top level key/value pairs in the given fields param
    function updateUser(fields, sendResponse, callback) {
        $.ajax({
            type: "POST",
            url: `${LIVE_DOMAIN_URL}/api/auth/update-user`,
            data: JSON.stringify({ fields }),
            contentType: 'application/json',
            headers: { "Authorization": `Bearer ${getJWT()}` },
            success: (data) => {
                if(!data.error) {
                    callback();
                } else if(data.error.type == 'forbidden') {
                    // if error was due to invalid/missing session token
                    handleIllegalAccessFailure(sendResponse, data);
                } else {
                    // db operation error
                    handleMongoFailure(sendResponse, data);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }

    // attempts to open the user's Stripe account dashboard in another tab
    function openStripeDashboard(sendResponse) {
        $.ajax({
            type: "GET",
            url: `${LIVE_DOMAIN_URL}/api/auth/stripe-dashboard`,
            headers: { "Authorization": `Bearer ${getJWT()}` },
            success: (data) => {
                if(!data.error) {
                    // open the dashboard
                    openURLInNewTab(data.link.url, sendResponse);
                } else if(data.error.type == 'forbidden') {
                    // if error was due to invalid/missing session token
                    handleIllegalAccessFailure(sendResponse, data);
                } else {
                    // there was an issue generating the Stripe dashboard link
                    handleDashboardLinkFailure(sendResponse, data);
                }
            },
            error: () => {
                handleAjaxFailure(sendResponse);
            }
        });
    }


    // ----- user notification handlers ------


    // notifies user after successfully deleting their Tipp account
    function handleAccountDeletionSuccess(sendResponse, obj) {
        notify(
            NOTIFICATION.accountDeletion.success.title,
            NOTIFICATION.accountDeletion.success.message
        );
        // empty user cache
        setCachedValue('tipp_account', {});
        chrome.browserAction.setPopup({ popup: 'splash.html' });
        return sendResponse((obj) ? obj : {});
    }

    // lets user know their was a problem deleting their Tipp account
    function handleAccountDeletionFailure(sendResponse, obj) {
        notify(
            NOTIFICATION.accountDeletion.failure.title,
            NOTIFICATION.accountDeletion.failure.message
        );
        return sendResponse((obj) ? obj : {});
    }

    // notifies user after creating a successful Stripe charge on backend
    function handleSuccessfulCharge(amount, sendResponse, obj) {
        notify(
            NOTIFICATION.stripeCharge.success.title,
            `Your $${(parseInt(amount)/100).toFixed(2)} Tipp was successful!`
        );
        return sendResponse((obj) ? obj : {});
    }

    // let user know reason why Stripe charges.create fails on backend
    function handleStripeChargeFailure(error, sendResponse) {
        if(error.type == "amount") {
            notify('Invalid Tipp Amount', error.msg);
        } else {
            notify('Stripe Charge Failed', error.msg);
        }
        return sendResponse({});
    }

    // let user know when ajax request fails, with an optional
    // object to pass to sendResponse
    function handleAjaxFailure(sendResponse) {
        notify(
            NOTIFICATION.ajaxFailure.title,
            NOTIFICATION.ajaxFailure.message
        );
        return sendResponse({ error: { type: 'ajax', msg: 'Communication with the server failed.' } });
    }

    // lets user what they did wrong during their Google OAuth flow
    function handleGoogleOAuthFailure(aborted, sendResponse, obj) {
        if(aborted) {
            // user aborted Google OAuth
            notify(
                NOTIFICATION.googleOauthAborted.title,
                NOTIFICATION.googleOauthAborted.message
            );
            return sendResponse((obj) ? obj : {});
        } else {
            // user did not give necessary permissions during oauth process
            notify(
                NOTIFICATION.googlePermissionDenied.title,
                NOTIFICATION.googlePermissionDenied.message
            );
            return sendResponse((obj) ? obj : {});
        }
    }

    // lets user know the Google API-related operation caused their YT channels not to connect
    function handleYTChannelConnectionFailure(sendResponse, obj) {
        notify(
            NOTIFICATION.youtubeConnect.failure.title,
            NOTIFICATION.youtubeConnect.failure.message
        );
        return sendResponse((obj) ? obj : {});
    }

    // lets user know that the YT channels they are trying to add have already been added
    function handleAlreadyAddedYTChannels(sendResponse, obj) {
        notify(
            NOTIFICATION.youtubeConnect.failure.title,
            "All channels for this account have been added."
        );
        return sendResponse((obj) ? obj : {});
    }

    // lets user know there were no channels associated with that Google account
    function handleNoYTChannelsForAccount(sendResponse, obj) {
        notify(
            NOTIFICATION.youtubeConnect.failure.title,
            "No channels associated with that account."
        );
        return sendResponse((obj) ? obj : {});
    }

    // lets user know why their Stripe account creation failed
    function handleStripeOAuthFailure(sendResponse, obj) {
        notify(
            NOTIFICATION.stripeOAuth.failure.title,
            NOTIFICATION.stripeOAuth.failure.message
        );
        return sendResponse((obj) ? obj : {});
    }

    // lets user know their Stripe account creation was a success
    function handleStripeOAuthSuccess(sendResponse, obj) {
        notify(
            NOTIFICATION.stripeOAuth.success.title,
            NOTIFICATION.stripeOAuth.success.message
        );
        return sendResponse((obj) ? obj : {});
    }

    // handles mongodb operation failure on backend
    function handleMongoFailure(sendResponse, obj) {
        notify(
            NOTIFICATION.mongoFailure.title,
            NOTIFICATION.mongoFailure.message
        );
        return sendResponse((obj) ? obj : {});
    }

    // caches newly-created user, and lets them know their Tipp account creation was successful
    function handleTippUserCreationSuccess(sendResponse, obj) {
        notify(
            NOTIFICATION.accountCreation.success.title,
            NOTIFICATION.accountCreation.success.message
        );
        chrome.browserAction.setPopup({ popup: 'dashboard.html' });
        return sendResponse((obj) ? obj : {});
    }

    // handle Stripe dashboard link generation failure
    function handleDashboardLinkFailure(sendResponse, obj) {
        notify(
            NOTIFICATION.stripeDashboardFailure.title,
            NOTIFICATION.stripeDashboardFailure.message
        );
        return sendResponse((obj) ? obj : {});
    }

    // handle illegal access Tipp API
    function handleIllegalAccessFailure(sendResponse, obj) {
        notify(
            NOTIFICATION.illegalAccess.title,
            NOTIFICATION.illegalAccess.message
        );
        // empty user cache
        setCachedValue('tipp_account', {});
        chrome.browserAction.setPopup({ popup: 'splash.html' });
        return sendResponse((obj) ? obj : {});
    }


    // ----- utilities ------


    // displays Chrome desktop notification with given title/message.
    // img is optional, as default is Tipp logo (img/tipp_48x48.png)
    function notify(title, message, img) {
        chrome.notifications.create({
            type: 'basic',
            requireInteraction: true,
            isClickable: true,
            iconUrl: (img) ? img : 'img/tipp_48x48.png',
            title,
            message
        });
    }

    // opens given url in new tab, then performs callback (w/ 1 arg of empty obj)
    function openURLInNewTab(url, callback) {
        chrome.tabs.create({
            url,
            active: true
        }, () => {
            callback({});
        });
    }

    // creates an array of Mongo-insertable channel objects from raw YT api response
    function buildYTChannelDocuments(channelsFromAPI) {
        const channels = [];
        channelsFromAPI.forEach((el) => {
            channels.push({
                channelId: el.id,
                channelName: el.snippet.title,
                channelIcon: el.snippet.thumbnails.default.url
            });
        });
        return channels;
    }

    // checks if user has Tipp account and has jwt
    function isLoggedIn() {
        const acc = getCachedValue('tipp_account');
        return (acc && acc.jwt) ? true : false;
    }

    // returns the logged-in user's JWT to pass in auth header
    function getJWT() {
        const acc = getCachedValue('tipp_account');
        return acc ? acc.jwt : '';
    }

    // synchronously sets localStorage[key] to JSON-stringified obj
    function setCachedValue(key, obj) {
        localStorage.setItem(key, JSON.stringify(obj));
    }

    // synchronously gets JSON-parsed obj stored in localStorage[key]
    function getCachedValue(key) {
        return JSON.parse(localStorage.getItem(key) ? localStorage.getItem(key) : '{}');
    }

    // gets value of given query string param in a given url
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
