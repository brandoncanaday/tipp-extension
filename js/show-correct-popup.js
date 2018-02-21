
(function() {
    // redirect to dashboard popup if logged in
    const _acc = JSON.parse((localStorage.getItem('tipp_account')) ? localStorage.getItem('tipp_account') : '{}');
    if(_acc.jwt) window.location.replace(chrome.runtime.getURL('dashboard.html'));
})();
