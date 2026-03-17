document.addEventListener('DOMContentLoaded', function() {
    // Check authentication and role
    const token = localStorage.getItem('intelSeekToken');
    const user = JSON.parse(localStorage.getItem('intelSeekUser') || '{}');
    
    if (!token || user.role !== 'owner') {
        window.location.href = 'index.html';
        return;
    }
    
    // Set owner name
    document.getElementById('ownerName').textContent = user.username.toUpperCase();
    
    // Tab switching
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            navItems.forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            
            const tabId = this.dataset.tab;
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(tabId + 'Tab').classList.add('active');
            
            if (tabId === 'dashboard') loadDashboard();
            if (tabId === 'users') loadUsers();
            if (tabId === 'logs') loadLogs();
            if (tabId === 'config') loadConfig();
        });
    });
    
    // Load dashboard by default
    loadDashboard();
    
    // Create admin modal
    const createModal = document.getElementById('createAdminModal');
    const createBtn = document.getElementById('createAdminBtn');
    const cancelCreate = document.getElementById('cancelCreate');
    
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            createModal.classList.add('active');
        });
    }
    
    if (cancelCreate) {
        cancelCreate.addEventListener('click', () => {
            createModal.classList.remove('active');
        });
    }
    
    // Create admin form
    const createForm = document.getElementById('createAdminForm');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('newUsername').value;
            const password = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmPassword').value;
            
            if (password !== confirm) {
                alert('Passwords do not match');
                return;
            }
            
            if (username.length < 3) {
                alert('Username must be at least 3 characters');
                return;
            }
            
            if (password.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }
            
            const submitBtn = createForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CREATING...';
            
            try {
                const response = await fetch('/api/owner/users/create-admin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ Admin created/reactivated successfully');
                    createModal.classList.remove('active');
                    createForm.reset();
                    loadUsers();
                } else {
                    alert('❌ Error: ' + data.message);
                }
            } catch (error) {
                alert('❌ Failed: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
    // Reset password modal
    const resetModal = document.getElementById('resetPasswordModal');
    const cancelReset = document.getElementById('cancelReset');
    let currentResetUserId = null;
    
    if (cancelReset) {
        cancelReset.addEventListener('click', () => {
            resetModal.classList.remove('active');
            document.getElementById('resetPasswordForm').reset();
        });
    }
    
    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('resetNewPassword').value;
            const confirm = document.getElementById('resetConfirmPassword').value;
            
            if (newPassword !== confirm) {
                alert('Passwords do not match');
                return;
            }
            
            if (newPassword.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }
            
            const submitBtn = resetForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> RESETTING...';
            
            try {
                const response = await fetch(`/api/owner/users/${currentResetUserId}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ newPassword })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ Password reset successfully. User activated.');
                    resetModal.classList.remove('active');
                    resetForm.reset();
                    loadUsers();
                } else {
                    alert('❌ Error: ' + data.message);
                }
            } catch (error) {
                alert('❌ Failed: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('intelSeekToken');
        localStorage.removeItem('intelSeekUser');
        window.location.href = 'index.html';
    });
});

// Load dashboard data
async function loadDashboard() {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const statsResponse = await fetch('/api/owner/logs/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await statsResponse.json();
        
        if (statsData.success) {
            const statsContainer = document.getElementById('statsContainer');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="stat-card">
                        <div class="stat-value">${statsData.stats.totalSearches || 0}</div>
                        <div class="stat-label">Total Searches</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${statsData.stats.recent24h || 0}</div>
                        <div class="stat-label">Last 24 Hours</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${statsData.stats.byUser ? statsData.stats.byUser.length : 0}</div>
                        <div class="stat-label">Active Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${statsData.stats.byType ? statsData.stats.byType.length : 0}</div>
                        <div class="stat-label">Search Types</div>
                    </div>
                `;
            }
        }
        
        const logsResponse = await fetch('/api/owner/logs?limit=10', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const logsData = await logsResponse.json();
        
        if (logsData.success) {
            const tbody = document.getElementById('recentLogs');
            if (tbody) {
                if (logsData.logs && logsData.logs.length > 0) {
                    tbody.innerHTML = logsData.logs.map(log => {
                        const date = new Date(log.timestamp);
                        const formattedDate = date.toLocaleString();
                        
                        return `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${log.username || 'Unknown'}</td>
                                <td><span class="role-badge ${log.user_role || 'user'}">${(log.user_role || 'USER').toUpperCase()}</span></td>
                                <td>${log.search_type || 'N/A'}</td>
                                <td>${log.search_term || 'N/A'}</td>
                                <td>${log.ip_address || 'N/A'}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 2rem;">
                                <i class="fas fa-history"></i> No search history found
                            </td>
                        </tr>
                    `;
                }
            }
        }
        
    } catch (error) {
        console.error('Load dashboard error:', error);
        const tbody = document.getElementById('recentLogs');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--accent-danger);">
                        <i class="fas fa-exclamation-triangle"></i> Error loading logs: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// Load users list - WITH REACTIVATE BUTTON
async function loadUsers() {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const response = await fetch('/api/owner/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                if (data.users && data.users.length > 0) {
                    tbody.innerHTML = data.users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td><span class="role-badge ${user.role}">${user.role.toUpperCase()}</span></td>
                            <td>${user.created_by_username || 'System'}</td>
                            <td>${new Date(user.created_at).toLocaleDateString()}</td>
                            <td>${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                            <td>
                                <span style="color: ${user.is_active ? 'var(--accent-primary)' : 'var(--accent-danger)'}">
                                    ${user.is_active ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                            </td>
                            <td>${user.total_searches || 0}</td>
                            <td>
                                <!-- Reset Password Button -->
                                <button class="action-btn reset-password" data-id="${user.id}" data-username="${user.username}" title="Reset Password">
                                    <i class="fas fa-key"></i>
                                </button>
                                
                                <!-- Toggle Active Status Button -->
                                ${user.is_active ? 
                                    `<button class="action-btn deactivate" data-id="${user.id}" data-username="${user.username}" title="Deactivate User">
                                        <i class="fas fa-ban"></i>
                                     </button>` :
                                    `<button class="action-btn activate" data-id="${user.id}" data-username="${user.username}" title="Reactivate User">
                                        <i class="fas fa-check-circle"></i>
                                     </button>`
                                }
                                
                                <!-- Delete Button (only for admins, not owners) -->
                                ${user.role === 'admin' ? `
                                    <button class="action-btn delete" data-id="${user.id}" title="Delete User">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('');
                    
                    // Reset password buttons
                    document.querySelectorAll('.reset-password').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const userId = btn.dataset.id;
                            const username = btn.dataset.username;
                            document.getElementById('resetUsername').textContent = username;
                            document.getElementById('resetPasswordModal').classList.add('active');
                            window.currentResetUserId = userId;
                        });
                    });
                    
                    // Activate/Deactivate buttons
                    document.querySelectorAll('.activate, .deactivate').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const userId = btn.dataset.id;
                            const username = btn.dataset.username;
                            const action = btn.classList.contains('activate') ? 'activate' : 'deactivate';
                            
                            if (confirm(`Are you sure you want to ${action} user ${username}?`)) {
                                await toggleUserStatus(userId);
                            }
                        });
                    });
                    
                    // Delete buttons
                    document.querySelectorAll('.delete').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const userId = btn.dataset.id;
                            if (confirm('Are you sure you want to delete this user permanently?')) {
                                await deleteUser(userId);
                            }
                        });
                    });
                    
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="9" style="text-align: center; padding: 2rem;">
                                <i class="fas fa-users"></i> No users found
                            </td>
                        </tr>
                    `;
                }
            }
        }
        
    } catch (error) {
        console.error('Load users error:', error);
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--accent-danger);">
                        <i class="fas fa-exclamation-triangle"></i> Error loading users: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

// Toggle user status function
async function toggleUserStatus(userId) {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const response = await fetch(`/api/owner/users/${userId}/toggle-status`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ User ${data.isActive ? 'activated' : 'deactivated'} successfully`);
            loadUsers(); // Refresh the list
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (error) {
        alert('❌ Failed to toggle status: ' + error.message);
    }
}

// Delete user function
async function deleteUser(userId) {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const response = await fetch(`/api/owner/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ User deleted/deactivated successfully');
            loadUsers();
        } else {
            alert('❌ Error: ' + data.message);
        }
    } catch (error) {
        alert('❌ Failed: ' + error.message);
    }
}

// Load audit logs
async function loadLogs(page = 0) {
    const token = localStorage.getItem('intelSeekToken');
    const limit = 50;
    const offset = page * limit;
    
    try {
        const response = await fetch(`/api/owner/logs?limit=${limit}&offset=${offset}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('logsTableBody');
            if (tbody) {
                if (data.logs && data.logs.length > 0) {
                    tbody.innerHTML = data.logs.map(log => {
                        const date = new Date(log.timestamp);
                        const formattedDate = date.toLocaleString();
                        
                        return `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${log.username}</td>
                                <td><span class="role-badge ${log.user_role || 'user'}">${(log.user_role || 'USER').toUpperCase()}</span></td>
                                <td>${log.search_type}</td>
                                <td>${log.search_term}</td>
                                <td>${log.ip_address}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 2rem;">
                                <i class="fas fa-history"></i> No audit logs found
                            </td>
                        </tr>
                    `;
                }
            }
            
            const userFilter = document.getElementById('logUserFilter');
            if (userFilter && data.logs) {
                const uniqueUsers = [...new Set(data.logs.map(l => l.username))];
                userFilter.innerHTML = '<option value="">All Users</option>' + 
                    uniqueUsers.map(u => `<option value="${u}">${u}</option>`).join('');
            }
            
            const typeFilter = document.getElementById('logTypeFilter');
            if (typeFilter && data.logs) {
                const uniqueTypes = [...new Set(data.logs.map(l => l.search_type))];
                typeFilter.innerHTML = '<option value="">All Types</option>' + 
                    uniqueTypes.map(t => `<option value="${t}">${t}</option>`).join('');
            }
            
            const pagination = document.getElementById('logsPagination');
            if (pagination) {
                const totalPages = Math.ceil(data.total / limit);
                let paginationHtml = '<div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">';
                
                if (page > 0) {
                    paginationHtml += `<button class="action-btn" onclick="loadLogs(${page - 1})">Previous</button>`;
                }
                
                paginationHtml += `<span style="padding: 0.5rem;">Page ${page + 1} of ${totalPages}</span>`;
                
                if (page < totalPages - 1) {
                    paginationHtml += `<button class="action-btn" onclick="loadLogs(${page + 1})">Next</button>`;
                }
                
                paginationHtml += '</div>';
                pagination.innerHTML = paginationHtml;
            }
        }
        
    } catch (error) {
        console.error('Load logs error:', error);
    }
}

// Load configuration
function loadConfig() {
    document.getElementById('showApiKey')?.addEventListener('click', function() {
        const input = document.getElementById('apiKeyInput');
        if (input.type === 'password') {
            input.type = 'text';
            this.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            input.type = 'password';
            this.innerHTML = '<i class="fas fa-eye"></i>';
        }
    });
    
    document.getElementById('updateApiKey')?.addEventListener('click', async function() {
        const token = localStorage.getItem('intelSeekToken');
        const apiKey = document.getElementById('apiKeyInput').value;
        
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }
        
        this.disabled = true;
        const originalText = this.innerHTML;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> UPDATING...';
        
        try {
            const response = await fetch('/api/owner/config/api/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ apiKey: apiKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ API key updated successfully');
            } else {
                alert('❌ Error: ' + data.message);
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('❌ Failed: ' + error.message);
        } finally {
            this.disabled = false;
            this.innerHTML = originalText;
        }
    });
}

// Make pagination function globally available
window.loadLogs = loadLogs;