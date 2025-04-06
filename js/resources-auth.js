// Resources page authentication script

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    if (!isLoggedIn()) {
        // Hide the app content
        const appContent = document.getElementById('app');
        if (appContent) {
            appContent.style.display = 'none';
        }
        
        // Redirect to secure resources page
        window.location.href = 'secure-resources.html';
    } else {
        // User is logged in, show welcome message
        const user = getCurrentUser();
        showWelcomeMessage(user);
    }
});

// Function to show welcome message
function showWelcomeMessage(user) {
    // Create welcome banner
    const welcomeBanner = document.createElement('div');
    welcomeBanner.className = 'alert alert-success alert-dismissible fade show mb-4';
    welcomeBanner.role = 'alert';
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
    const container = document.querySelector('.container.my-5');
    if (container) {
        container.insertBefore(welcomeBanner, container.firstChild);
    }
    
    // Add logout button to navigation
    addLogoutToNav(user);
}

// Function to add logout button to navigation
function addLogoutToNav(user) {
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
