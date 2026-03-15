document.addEventListener('DOMContentLoaded', function() {
    // Check authentication and role
    const token = localStorage.getItem('intelSeekToken');
    const user = JSON.parse(localStorage.getItem('intelSeekUser') || '{}');
    
    if (!token || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Set admin name
    document.getElementById('adminName').textContent = user.username.toUpperCase();
    
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
            
            // Load tab data
            if (tabId === 'dashboard') {
                loadDashboardStats();
                loadRecentLogs();
            }
            if (tabId === 'logs') loadAllLogs(0);
            if (tabId === 'profile') loadProfile();
        });
    });
    
    // Load dashboard by default
    loadDashboardStats();
    loadRecentLogs();
    
    // Toggle filters
    const toggleFilters = document.getElementById('toggleFilters');
    const filterPanel = document.getElementById('filterPanel');
    
    if (toggleFilters) {
        toggleFilters.addEventListener('click', () => {
            filterPanel.classList.toggle('active');
        });
    }
    
    // Apply filters
    document.getElementById('applyFilters')?.addEventListener('click', () => {
        loadRecentLogs();
    });
    
    // Change password form
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> UPDATING...';
        
        try {
            const response = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Password changed successfully');
                document.getElementById('changePasswordForm').reset();
            } else {
                alert('❌ Error: ' + data.message);
            }
        } catch (error) {
            alert('❌ Failed to change password: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('intelSeekToken');
        localStorage.removeItem('intelSeekUser');
        window.location.href = 'index.html';
    });
});

// Load dashboard stats
async function loadDashboardStats() {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const response = await fetch('/api/admin/my-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const statsContainer = document.getElementById('statsContainer');
            
            // Build type breakdown HTML
            const typeBreakdown = data.stats.byType.map(t => 
                `<div>${t.search_type}: ${t.count}</div>`
            ).join('');
            
            // Build top terms HTML
            const topTerms = data.stats.topTerms.map(t => 
                `<div>${t.search_term}: ${t.count}</div>`
            ).join('');
            
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-search"></i></div>
                    <div class="stat-value">${data.stats.totalSearches}</div>
                    <div class="stat-label">Total Searches</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-value">${data.stats.recent24h}</div>
                    <div class="stat-label">Last 24 Hours</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tags"></i></div>
                    <div class="stat-value">${data.stats.byType.length}</div>
                    <div class="stat-label">Search Types Used</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-pie"></i></div>
                    <div class="stat-value" style="font-size: 1rem; text-align: left;">
                        ${typeBreakdown || 'No data'}
                    </div>
                    <div class="stat-label">By Type</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load recent logs for dashboard
async function loadRecentLogs() {
    const token = localStorage.getItem('intelSeekToken');
    const typeFilter = document.getElementById('logTypeFilter')?.value || '';
    const fromDate = document.getElementById('logDateFrom')?.value || '';
    const toDate = document.getElementById('logDateTo')?.value || '';
    
    let url = '/api/admin/my-logs?limit=10';
    if (typeFilter) url += `&searchType=${typeFilter}`;
    if (fromDate) url += `&fromDate=${fromDate}`;
    if (toDate) url += `&toDate=${toDate}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('recentLogs');
            
            if (data.logs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-search"></i> No searches found
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = data.logs.map(log => `
                    <tr>
                        <td>${new Date(log.timestamp).toLocaleString()}</td>
                        <td>${log.search_type}</td>
                        <td>${log.search_term}</td>
                        <td>${log.ip_address}</td>
                    </tr>
                `).join('');
            }
            
            // Update type filter dropdown
            const uniqueTypes = [...new Set(data.logs.map(l => l.search_type))];
            const typeFilterSelect = document.getElementById('logTypeFilter');
            if (typeFilterSelect) {
                const currentValue = typeFilterSelect.value;
                typeFilterSelect.innerHTML = '<option value="">All Types</option>' + 
                    uniqueTypes.map(t => `<option value="${t}" ${t === currentValue ? 'selected' : ''}>${t}</option>`).join('');
            }
        }
    } catch (error) {
        console.error('Load recent logs error:', error);
    }
}

// Load all logs with pagination
async function loadAllLogs(page = 0) {
    const token = localStorage.getItem('intelSeekToken');
    const limit = 20;
    const offset = page * limit;
    
    try {
        const response = await fetch(`/api/admin/my-logs?limit=${limit}&offset=${offset}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('logsTableBody');
            
            if (data.logs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; padding: 2rem;">
                            <i class="fas fa-search"></i> No search history found
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = data.logs.map(log => `
                    <tr>
                        <td>${new Date(log.timestamp).toLocaleString()}</td>
                        <td>${log.search_type}</td>
                        <td>${log.search_term}</td>
                        <td>${log.ip_address}</td>
                    </tr>
                `).join('');
            }
            
            document.getElementById('totalLogs').textContent = `${data.total} records`;
            
            // Create pagination
            const totalPages = Math.ceil(data.total / limit);
            const pagination = document.getElementById('logsPagination');
            
            let paginationHtml = '<div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem;">';
            
            if (page > 0) {
                paginationHtml += `<button class="action-btn" onclick="loadAllLogs(${page - 1})">Previous</button>`;
            }
            
            paginationHtml += `<span style="padding: 0.5rem;">Page ${page + 1} of ${totalPages}</span>`;
            
            if (page < totalPages - 1) {
                paginationHtml += `<button class="action-btn" onclick="loadAllLogs(${page + 1})">Next</button>`;
            }
            
            paginationHtml += '</div>';
            pagination.innerHTML = paginationHtml;
        }
    } catch (error) {
        console.error('Load all logs error:', error);
    }
}

// Load profile
async function loadProfile() {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const response = await fetch('/api/admin/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('profileName').textContent = data.profile.username;
            document.getElementById('profileRole').textContent = data.profile.role.toUpperCase();
            
            const details = document.getElementById('profileDetails');
            details.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Username</span>
                    <span class="detail-value">${data.profile.username}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Role</span>
                    <span class="detail-value">${data.profile.role.toUpperCase()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Account Created</span>
                    <span class="detail-value">${new Date(data.profile.created_at).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Login</span>
                    <span class="detail-value">${data.profile.last_login ? new Date(data.profile.last_login).toLocaleString() : 'Never'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value" style="color: ${data.profile.is_active ? 'var(--accent-primary)' : 'var(--accent-danger)'}">
                        ${data.profile.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load profile error:', error);
    }
}

// Make pagination function globally available
window.loadAllLogs = loadAllLogs;