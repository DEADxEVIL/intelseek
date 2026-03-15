document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const token = localStorage.getItem('intelSeekToken');
    const userJson = localStorage.getItem('intelSeekUser');
    
    if (!token || !userJson) {
        window.location.href = 'index.html';
        return;
    }
    
    const user = JSON.parse(userJson);
    
    // Display user info
    document.getElementById('displayName').textContent = user.username.toUpperCase();
    document.getElementById('displayRole').textContent = user.role.toUpperCase();
    
    // Show admin/owner nav based on role
    if (user.role === 'owner') {
        document.getElementById('ownerNavSection').style.display = 'block';
        document.getElementById('adminNavSection').style.display = 'block';
    } else if (user.role === 'admin') {
        document.getElementById('adminNavSection').style.display = 'block';
    }
    
    // Session timer
    let seconds = 0;
    const timerElement = document.getElementById('sessionTimer');
    setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
    
    // Load search types
    loadSearchTypes();
    
    // Load user stats
    loadUserStats();
    
    // Tab switching
    document.getElementById('searchTab').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        e.target.closest('.nav-item').classList.add('active');
        document.getElementById('searchPanel').style.display = 'block';
        document.getElementById('historyPanel').style.display = 'none';
    });
    
    document.getElementById('historyTab').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        e.target.closest('.nav-item').classList.add('active');
        document.getElementById('searchPanel').style.display = 'none';
        document.getElementById('historyPanel').style.display = 'block';
        loadSearchHistory();
    });
    
    // Category tabs
    document.getElementById('categoryTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab');
        if (!tab) return;
        
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        filterSearchTypes(tab.dataset.category);
    });
    
    // Search button
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    
    // Enter key in search input
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Quick search (Ctrl + K)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            document.getElementById('quickSearch').focus();
        }
    });
    
    // Quick search input
    document.getElementById('quickSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const term = e.target.value.trim();
            if (term) {
                document.getElementById('searchInput').value = term;
                performSearch();
            }
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

// Load search types from API
async function loadSearchTypes() {
    const token = localStorage.getItem('intelSeekToken');
    
    try {
        const response = await fetch('/api/search/types/list', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            const typeSelect = document.getElementById('searchType');
            const categories = new Set();
            
            // Group by category
            const typesByCategory = {};
            data.types.forEach(type => {
                if (!typesByCategory[type.category]) {
                    typesByCategory[type.category] = [];
                }
                typesByCategory[type.category].push(type);
                categories.add(type.category);
            });
            
            // Create category tabs
            const categoryTabs = document.getElementById('categoryTabs');
            categoryTabs.innerHTML = '<button class="filter-tab active" data-category="all"><i class="fas fa-globe"></i> All</button>';
            
            categories.forEach(category => {
                categoryTabs.innerHTML += `
                    <button class="filter-tab" data-category="${category}">
                        <i class="fas fa-tag"></i> ${category}
                    </button>
                `;
            });
            
            // Populate select
            typeSelect.innerHTML = '<option value="">Select search type...</option>';
            
            Object.keys(typesByCategory).sort().forEach(category => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category;
                
                typesByCategory[category].forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.type_name;
                    option.textContent = type.display_name;
                    optgroup.appendChild(option);
                });
                
                typeSelect.appendChild(optgroup);
            });
            
            // Update example hint
            updateExampleHint();
        }
    } catch (error) {
        console.error('Load search types error:', error);
    }
}

// Filter search types by category
function filterSearchTypes(category) {
    const typeSelect = document.getElementById('searchType');
    const options = typeSelect.querySelectorAll('option');
    
    options.forEach(opt => {
        if (opt.parentElement.tagName === 'OPTGROUP') {
            const optgroup = opt.parentElement;
            if (category === 'all' || optgroup.label === category) {
                opt.style.display = '';
                optgroup.style.display = '';
            } else {
                opt.style.display = 'none';
                if (Array.from(optgroup.children).every(o => o.style.display === 'none')) {
                    optgroup.style.display = 'none';
                }
            }
        }
    });
}

// Update example hint based on selected type
function updateExampleHint() {
    const typeSelect = document.getElementById('searchType');
    const hint = document.getElementById('exampleHint');
    
    typeSelect.addEventListener('change', () => {
        const selected = typeSelect.options[typeSelect.selectedIndex];
        if (selected && selected.value) {
            hint.textContent = `Example: Enter a ${selected.textContent.toLowerCase()}`;
        } else {
            hint.textContent = 'Try: mobile, aadhaar, email, or vehicle';
        }
    });
}

// Perform search
async function performSearch() {
    const token = localStorage.getItem('intelSeekToken');
    const type = document.getElementById('searchType').value;
    const term = document.getElementById('searchInput').value.trim();
    
    if (!type) {
        alert('Please select a search type');
        return;
    }
    
    if (!term) {
        alert('Please enter a search term');
        return;
    }
    
    const searchBtn = document.getElementById('searchBtn');
    const originalText = searchBtn.innerHTML;
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SEARCHING...';
    
    try {
        const response = await fetch(`/api/search/${type}?term=${encodeURIComponent(term)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        // Hide placeholder, show results
        document.getElementById('resultsPlaceholder').style.display = 'none';
        document.getElementById('resultsContainer').style.display = 'block';
        
        // Display results
        const resultsJson = document.getElementById('resultsJson');
        resultsJson.textContent = JSON.stringify(data, null, 2);
        
        // Update result count
        document.getElementById('resultCount').textContent = '1 record found';
        
        // Highlight JSON
        if (typeof hljs !== 'undefined') {
            hljs.highlightElement(resultsJson);
        }
        
    } catch (error) {
        alert('Search failed: ' + error.message);
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = originalText;
    }
}

// Load search history
async function loadSearchHistory() {
    const token = localStorage.getItem('intelSeekToken');
    const user = JSON.parse(localStorage.getItem('intelSeekUser') || '{}');
    
    try {
        const endpoint = user.role === 'owner' ? '/api/owner/logs?limit=50' : '/api/admin/my-logs?limit=50';
        
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        const tbody = document.getElementById('historyTableBody');
        
        if (data.success && data.logs.length > 0) {
            tbody.innerHTML = data.logs.map(log => `
                <tr>
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.search_type}</td>
                    <td>${log.search_term}</td>
                    <td>
                        <button class="action-btn repeat-search" data-type="${log.search_type}" data-term="${log.search_term}">
                            <i class="fas fa-redo"></i> Repeat
                        </button>
                    </td>
                </tr>
            `).join('');
            
            // Add repeat search handlers
            document.querySelectorAll('.repeat-search').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.getElementById('searchType').value = btn.dataset.type;
                    document.getElementById('searchInput').value = btn.dataset.term;
                    document.getElementById('searchTab').click();
                    performSearch();
                });
            });
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-history"></i> No search history found
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Load history error:', error);
    }
}

// Load user stats
async function loadUserStats() {
    const token = localStorage.getItem('intelSeekToken');
    const user = JSON.parse(localStorage.getItem('intelSeekUser') || '{}');
    
    try {
        const endpoint = user.role === 'owner' ? '/api/owner/logs/stats' : '/api/admin/my-stats';
        
        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            if (user.role === 'owner') {
                document.getElementById('totalRecords').textContent = data.stats.totalSearches || '0';
                document.getElementById('searchesToday').textContent = data.stats.recent24h || '0';
            } else {
                document.getElementById('totalRecords').textContent = data.stats.totalSearches || '0';
                document.getElementById('searchesToday').textContent = data.stats.recent24h || '0';
            }
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}