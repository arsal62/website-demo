// Script to check authentication for resources.html
document.addEventListener('DOMContentLoaded', function() {
    // Check if users.js is loaded
    if (typeof isLoggedIn !== 'function') {
        // Load users.js
        const usersScript = document.createElement('script');
        usersScript.src = 'js/users.js';
        usersScript.onload = checkAuthentication;
        document.body.appendChild(usersScript);
    } else {
        // users.js is already loaded
        checkAuthentication();
    }
    
    function checkAuthentication() {
        // Check if user is logged in
        if (!isLoggedIn()) {
            // User is not logged in, redirect to resources-auth page
            window.location.href = 'resources-auth.html';
        } else {
            // User is logged in, show welcome message
            showWelcomeMessage(getCurrentUser());
        }
    }
    
    function showWelcomeMessage(user) {
        // Create welcome banner
        const welcomeBanner = document.createElement('div');
        welcomeBanner.className = 'alert alert-success alert-dismissible fade show mb-4';
        welcomeBanner.role = 'alert';
        welcomeBanner.style.position = 'fixed';
        welcomeBanner.style.top = '70px';
        welcomeBanner.style.left = '50%';
        welcomeBanner.style.transform = 'translateX(-50%)';
        welcomeBanner.style.zIndex = '9999';
        welcomeBanner.style.width = '80%';
        welcomeBanner.style.maxWidth = '800px';
        welcomeBanner.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        welcomeBanner.innerHTML = `
            <div class="d-flex align-items-center">
                <div>
                    <h4 class="alert-heading">Welcome to O and A Levels English Resources!</h4>
                    <p class="mb-0">Hello ${user.name}, Dr. Kamran Ali welcomes you to our exclusive learning resources.</p>
                </div>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(welcomeBanner);
        
        // Add logout button to navigation
        addLogoutToNav(user);
        
        // Auto remove after 5 seconds
        setTimeout(function() {
            welcomeBanner.classList.remove('show');
            setTimeout(function() {
                welcomeBanner.remove();
            }, 500);
        }, 5000);
    }
    
    function addLogoutToNav(user) {
        // Find the navbar
        const navbar = document.querySelector('.navbar-nav');
        if (!navbar) return;
        
        // Check if user info already exists
        if (document.getElementById('userNavInfo')) return;
        
        // Create user info element
        const userInfoLi = document.createElement('li');
        userInfoLi.className = 'nav-item ms-auto d-flex align-items-center';
        userInfoLi.id = 'userNavInfo';
        
        userInfoLi.innerHTML = `
            <span class="me-2 text-success">
                <i class="fas fa-user-circle me-1"></i>
                ${user.name}
            </span>
            <button id="navLogoutBtn" class="btn btn-sm btn-outline-danger">
                <i class="fas fa-sign-out-alt me-1"></i>
                Logout
            </button>
        `;
        
        // Add to navbar
        navbar.appendChild(userInfoLi);
        
        // Add event listener to logout button
        document.getElementById('navLogoutBtn').addEventListener('click', function() {
            logoutUser();
            window.location.href = 'index.html';
        });
    }
});
