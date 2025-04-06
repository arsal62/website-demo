// Script to check authentication and redirect if not logged in
(function() {
    // Check if users.js is loaded
    if (typeof isLoggedIn !== 'function') {
        // Load users.js first
        const script = document.createElement('script');
        script.src = 'js/users.js';
        script.onload = checkAuth;
        document.head.appendChild(script);
    } else {
        // users.js is already loaded
        checkAuth();
    }

    function checkAuth() {
        // Check if user is logged in
        if (!isLoggedIn()) {
            // Not logged in, redirect to auth page
            window.location.href = 'resources-auth.html';
        }
    }
})();
