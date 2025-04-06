// Authentication handling script

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    checkAuthStatus();
    
    // Setup form event listeners
    setupAuthForms();
    
    // Check if there's an auth action to perform
    checkAuthAction();
});

// Function to check authentication status
function checkAuthStatus() {
    if (isLoggedIn()) {
        // User is logged in, update UI
        showUserInfo(getCurrentUser());
        hideAuthButtons();
    } else {
        // User is not logged in, show auth buttons
        hideUserInfo();
        showAuthButtons();
    }
}

// Function to setup auth forms
function setupAuthForms() {
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            const result = loginUser(email, password);
            
            if (result.success) {
                // Show success message
                showAlert('Login successful! Welcome back, ' + result.user.name, 'success');
                
                // Update UI
                showUserInfo(result.user);
                hideAuthButtons();
                
                // Close modal
                const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                if (loginModal) {
                    loginModal.hide();
                }
                
                // Redirect to resources page after a short delay
                setTimeout(function() {
                    window.location.href = 'resources.html';
                }, 1500);
            } else {
                // Show error message
                showAlert(result.message, 'danger');
            }
        });
    }
    
    // Signup form submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            
            const result = registerUser(name, email, password);
            
            if (result.success) {
                // Show success message
                showAlert('Registration successful! Please log in with your credentials', 'success');
                
                // Close signup modal
                const signupModal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
                if (signupModal) {
                    signupModal.hide();
                }
                
                // Set a flag to open login modal after signup
                localStorage.setItem('authAction', 'login');
                
                // Reload the page to trigger the login modal
                setTimeout(function() {
                    window.location.reload();
                }, 1500);
            } else {
                // Show error message
                showAlert(result.message, 'danger');
            }
        });
    }
    
    // Logout button click
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logoutUser();
            showAlert('You have been logged out successfully', 'info');
            hideUserInfo();
            showAuthButtons();
        });
    }
}

// Function to check for auth action
function checkAuthAction() {
    const authAction = localStorage.getItem('authAction');
    
    if (authAction) {
        // Clear the auth action from localStorage
        localStorage.removeItem('authAction');
        
        // Perform the appropriate action
        if (authAction === 'signup') {
            // Open signup modal
            const signupModal = new bootstrap.Modal(document.getElementById('signupModal'));
            signupModal.show();
        } else if (authAction === 'login') {
            // Open login modal
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        }
    }
}

// Function to show user info
function showUserInfo(user) {
    const userInfoContainer = document.getElementById('userInfoContainer');
    const userName = document.getElementById('userName');
    
    if (userInfoContainer && userName) {
        userName.textContent = user.name;
        userInfoContainer.style.display = 'block';
    }
}

// Function to hide user info
function hideUserInfo() {
    const userInfoContainer = document.getElementById('userInfoContainer');
    
    if (userInfoContainer) {
        userInfoContainer.style.display = 'none';
    }
}

// Function to show auth buttons
function showAuthButtons() {
    const authButtons = document.querySelectorAll('.auth-btn');
    
    authButtons.forEach(function(button) {
        button.style.display = 'block';
    });
}

// Function to hide auth buttons
function hideAuthButtons() {
    const authButtons = document.querySelectorAll('.auth-btn');
    
    authButtons.forEach(function(button) {
        button.style.display = 'none';
    });
}

// Function to show alert
function showAlert(message, type) {
    const alertsContainer = document.getElementById('alertsContainer');
    
    if (alertsContainer) {
        const alertId = 'alert-' + Date.now();
        const alertHTML = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        alertsContainer.innerHTML += alertHTML;
        
        // Auto remove after 5 seconds
        setTimeout(function() {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                alertElement.classList.remove('show');
                setTimeout(function() {
                    alertElement.remove();
                }, 500);
            }
        }, 5000);
    }
}
