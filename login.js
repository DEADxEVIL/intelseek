document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const accessSelect = document.getElementById('accessSelect');
    const loginBtn = document.getElementById('loginBtn');
    const loginStatus = document.getElementById('loginStatus');
    const sessionIdSpan = document.getElementById('sessionId');
    const setupInfo = document.getElementById('setupInfo');

    // Generate random session ID on load
    function generateSessionId() {
        const chars = '0123456789ABCDEF';
        let sessionId = '';
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                sessionId += chars[Math.floor(Math.random() * 16)];
            }
            if (i < 3) sessionId += '-';
        }
        sessionIdSpan.textContent = sessionId;
    }
    generateSessionId();

    // Update status based on input
    function updateStatus() {
        if (usernameInput.value || passwordInput.value) {
            loginStatus.textContent = 'VALIDATING CREDENTIALS...';
            loginStatus.style.color = 'var(--accent-secondary)';
        } else {
            loginStatus.textContent = 'AWAITING AUTHENTICATION';
            loginStatus.style.color = 'var(--accent-secondary)';
        }
    }

    usernameInput.addEventListener('input', updateStatus);
    passwordInput.addEventListener('input', updateStatus);

    // Check if this is first run (no token in localStorage and no users in system)
    async function checkFirstRun() {
        try {
            const response = await fetch('/api/auth/check-users');
            if (response.ok) {
                const data = await response.json();
                if (data.userCount === 0) {
                    setupInfo.style.display = 'block';
                }
            }
        } catch (error) {
            // Ignore errors, just don't show setup info
        }
    }
    
    // Uncomment if you add this endpoint
    // checkFirstRun();

    // Handle login
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = usernameInput.value;
        const password = passwordInput.value;
        const selectedRole = accessSelect.value;

        if (!username || !password) {
            loginStatus.textContent = 'USERNAME AND PASSWORD REQUIRED';
            loginStatus.style.color = 'var(--accent-danger)';
            return;
        }

        // Disable form
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>AUTHENTICATING</span><i class="fas fa-spinner fa-spin"></i>';
        loginStatus.textContent = 'CONTACTING SECURE SERVER...';

        try {
            // Call real backend
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username: username, 
                    password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                loginStatus.textContent = 'ACCESS GRANTED';
                loginStatus.style.color = 'var(--accent-primary)';
                
                // Store token and user info
                localStorage.setItem('intelSeekToken', data.token);
                localStorage.setItem('intelSeekUser', JSON.stringify(data.user));
                
                // Store API types if provided
                if (data.apiTypes) {
                    localStorage.setItem('apiTypes', JSON.stringify(data.apiTypes));
                }
                
                // Success animation
                loginBtn.innerHTML = '<span>REDIRECTING</span><i class="fas fa-arrow-right"></i>';
                
                // Redirect based on role
                setTimeout(() => {
                    if (data.user.role === 'owner') {
                        window.location.href = 'owner-panel.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }, 1000);
            } else {
                throw new Error(data.message || 'Invalid credentials');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            loginStatus.textContent = 'ACCESS DENIED: ' + (error.message || 'Invalid credentials');
            loginStatus.style.color = 'var(--accent-danger)';
            
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>INITIALIZE ACCESS</span><i class="fas fa-arrow-right"></i>';
            
            loginForm.classList.add('shake');
            setTimeout(() => loginForm.classList.remove('shake'), 500);
        }
    });

    // Add shake animation if not already in CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake {
            animation: shake 0.5s;
        }
    `;
    document.head.appendChild(style);
});