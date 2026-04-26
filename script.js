// ==================== CONFIGURATION ====================

const API_BASE = 'http://localhost:3000';
let threads = [];
let currentSimulation = null;
let allComparisonResults = {};
let selectedAlgorithm = 'fcfs';
let comparisonCharts = {};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadThreads();
    checkServerConnection();
    console.log('🚀 Professional Thread Manager initialized');
});

function initializeEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            switchSection(section);
        });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }

    // Thread Form
    document.getElementById('addThreadForm').addEventListener('submit', addThread);

    // Buttons
    document.getElementById('generateRandomBtn').addEventListener('click', generateRandomThreads);
    document.getElementById('clearThreadsBtn').addEventListener('click', clearAllThreads);
    document.getElementById('runSimulationBtn').addEventListener('click', runSimulation);

    // Quick action buttons
    document.getElementById('quickAddBtn').addEventListener('click', () => switchSection('threads'));
    document.getElementById('quickBulkBtn').addEventListener('click', generateRandomThreads);
    document.getElementById('quickSimulateBtn').addEventListener('click', () => switchSection('simulation'));

    // Algorithm selection
    document.querySelectorAll('.algo-btn').forEach(btn => {
        btn.addEventListener('click', selectAlgorithm);
    });

    // Time quantum visibility
    document.getElementById('comparisonMode').addEventListener('change', (e) => {
        if (e.target.checked) {
            runAllComparisons();
        }
    });

    // Animation controls
    document.getElementById('playBtn')?.addEventListener('click', () => animateGantt());
    document.getElementById('pauseBtn')?.addEventListener('click', () => stopGanttAnimation());
    document.getElementById('resetBtn')?.addEventListener('click', () => resetGanttAnimation());

    // Modal close
    document.getElementById('closeLegendBtn')?.addEventListener('click', () => {
        document.getElementById('legendModal').style.display = 'none';
    });
}

// ==================== SECTION SWITCHING ====================

function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    document.getElementById(`${sectionName}-section`).classList.add('active');

    // Mark nav item as active
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // Close sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
}

// ==================== THREAD MANAGEMENT ====================

async function addThread(e) {
    e.preventDefault();

    const id = document.getElementById('threadId').value.trim();
    const arrivalTime = parseInt(document.getElementById('arrivalTime').value) || 0;
    const burstTime = parseInt(document.getElementById('burstTime').value);
    const priority = parseInt(document.getElementById('priority').value) || 0;

    if (!id || !burstTime || burstTime <= 0) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/add-thread`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, arrivalTime, burstTime, priority })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast(`Error: ${error.error}`, 'error');
            return;
        }

        showToast(`✓ Thread "${id}" added successfully`, 'success');
        document.getElementById('addThreadForm').reset();
        loadThreads();

    } catch (error) {
        showToast(`Connection error: ${error.message}`, 'error');
    }
}

async function loadThreads() {
    try {
        const response = await fetch(`${API_BASE}/threads`);
        const data = await response.json();
        threads = data.threads;

        updateThreadsUI();
        updateDashboard();

    } catch (error) {
        console.error('Error loading threads:', error);
    }
}

async function deleteThread(threadId) {
    try {
        const response = await fetch(`${API_BASE}/threads/${threadId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast(`✓ Thread "${threadId}" deleted`, 'success');
            loadThreads();
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function clearAllThreads() {
    if (threads.length === 0) {
        showToast('No threads to clear', 'info');
        return;
    }

    if (!confirm(`Delete all ${threads.length} thread(s)?`)) return;

    try {
        const response = await fetch(`${API_BASE}/threads`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('✓ All threads cleared', 'success');
            loadThreads();
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function generateRandomThreads() {
    const count = parseInt(prompt('How many threads? (1-50)', '5'));
    if (!count || count < 1 || count > 50) {
        showToast('Invalid count', 'error');
        return;
    }

    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    let added = 0;

    for (let i = 0; i < count; i++) {
        const id = `P${ids[i % ids.length]}${Math.floor(i / ids.length) || ''}`;
        const arrivalTime = Math.floor(Math.random() * 10);
        const burstTime = Math.floor(Math.random() * 15) + 1;
        const priority = Math.floor(Math.random() * 5);

        try {
            await fetch(`${API_BASE}/add-thread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, arrivalTime, burstTime, priority })
            });
            added++;
        } catch (error) {
            console.error(`Error adding thread ${id}:`, error);
        }
    }

    showToast(`✓ Generated ${added} random threads`, 'success');
    loadThreads();
}

function updateThreadsUI() {
    const tbody = document.getElementById('threadsTableBody');
    const count = document.getElementById('threadCountBadge');

    count.textContent = threads.length;

    if (threads.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No threads added yet</td></tr>';
        return;
    }

    tbody.innerHTML = threads.map(thread => `
        <tr>
            <td><strong>${escapeHtml(thread.id)}</strong></td>
            <td>${thread.arrivalTime || 0}</td>
            <td>${thread.burstTime}</td>
            <td>${thread.priority}</td>
            <td>
                <button class="btn btn-danger" onclick="deleteThread('${escapeHtml(thread.id)}')" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function updateDashboard() {
    document.getElementById('statThreadCount').textContent = threads.length;
}

// ==================== SCHEDULING ALGORITHMS ====================

async function runSimulation() {
    if (threads.length === 0) {
        showToast('No threads to simulate', 'error');
        return;
    }

    const comparisonMode = document.getElementById('comparisonMode').checked;

    if (comparisonMode) {
        runAllComparisons();
    } else {
        runSingleSimulation();
    }
}

async function runSingleSimulation() {
    const algorithm = selectedAlgorithm;
    const timeQuantum = algorithm === 'round-robin' ? parseInt(document.getElementById('timeQuantum').value) || 2 : null;

    if (!algorithm) {
        showToast('Please select an algorithm', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                algorithm,
                timeQuantum,
                threads: threads.map(t => ({ ...t, arrivalTime: t.arrivalTime || 0 }))
            })
        });

        if (!response.ok) {
            const error = await response.json();
            showToast(`Error: ${error.error}`, 'error');
            return;
        }

        const result = await response.json();
        currentSimulation = result;

        displayResults(result);
        showToast('✓ Simulation completed', 'success');
        switchSection('simulation');

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function runAllComparisons() {
    showLoading(true);
    allComparisonResults = {};
    const algorithms = ['fcfs', 'sjf', 'priority', 'round-robin'];

    try {
        for (const algo of algorithms) {
            const response = await fetch(`${API_BASE}/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    algorithm: algo,
                    timeQuantum: algo === 'round-robin' ? 2 : null,
                    threads: threads.map(t => ({ ...t, arrivalTime: t.arrivalTime || 0 }))
                })
            });

            if (response.ok) {
                const result = await response.json();
                allComparisonResults[algo] = result;
            }
        }

        displayComparisonResults();
        showToast('✓ Comparison completed', 'success');

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function displayComparisonResults() {
    const tbody = document.getElementById('comparisonTableBody');
    const panel = document.getElementById('comparisonPanel');

    if (!tbody || !panel) return;

    panel.style.display = 'block';
    tbody.innerHTML = '';

    const algorithms = [];
    const waitingTimes = [];
    const turnaroundTimes = [];
    const responseTimes = [];

    Object.entries(allComparisonResults).forEach(([algo, result]) => {
        algorithms.push(algo.toUpperCase());
        waitingTimes.push(result.avgWaitingTime);
        turnaroundTimes.push(result.avgTurnaroundTime);
        responseTimes.push(result.avgResponseTime || 0);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${algo.toUpperCase()}</strong></td>
            <td>${result.avgWaitingTime.toFixed(2)} ms</td>
            <td>${result.avgTurnaroundTime.toFixed(2)} ms</td>
            <td>${(result.avgResponseTime || 0).toFixed(2)} ms</td>
        `;
        tbody.appendChild(row);
    });

    // Render charts
    renderComparisonCharts(algorithms, waitingTimes, turnaroundTimes);
}

function renderComparisonCharts(algorithms, waitingTimes, turnaroundTimes) {
    const colors = ['#00d9ff', '#00f0ff', '#00a8cc', '#0088aa'];
    
    // Waiting Time Chart
    const wtCtx = document.getElementById('waitingTimeChart');
    if (wtCtx) {
        if (comparisonCharts.waitingTime) {
            comparisonCharts.waitingTime.destroy();
        }
        comparisonCharts.waitingTime = new Chart(wtCtx, {
            type: 'bar',
            data: {
                labels: algorithms,
                datasets: [{
                    label: 'Avg Waiting Time (ms)',
                    data: waitingTimes,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#e0e0e0',
                            font: { size: 12, weight: '600' }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 217, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    }
                }
            }
        });
    }

    // Turnaround Time Chart
    const ttCtx = document.getElementById('turnaroundTimeChart');
    if (ttCtx) {
        if (comparisonCharts.turnaroundTime) {
            comparisonCharts.turnaroundTime.destroy();
        }
        comparisonCharts.turnaroundTime = new Chart(ttCtx, {
            type: 'bar',
            data: {
                labels: algorithms,
                datasets: [{
                    label: 'Avg Turnaround Time (ms)',
                    data: turnaroundTimes,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#e0e0e0',
                            font: { size: 12, weight: '600' }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 217, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#b0b0b0'
                        }
                    }
                }
            }
        });
    }
}

function selectAlgorithm(e) {
    const algo = e.currentTarget.getAttribute('data-algo');
    selectedAlgorithm = algo;

    // Update UI
    document.querySelectorAll('.algo-btn').forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');

    // Show/hide time quantum
    document.getElementById('timeQuantumSection').style.display = 
        algo === 'round-robin' ? 'block' : 'none';
}

// ==================== VISUALIZATION ====================

function displayResults(result) {
    const container = document.getElementById('ganttChartContainer');
    const noMsg = document.getElementById('noSimulationMsg');

    if (!container || !noMsg) return;

    container.style.display = 'block';
    noMsg.style.display = 'none';

    displayGanttChart(result.schedule);
    displayExecutionSequence(result.schedule);
    displayMetrics(result);

    // Update dashboard
    document.getElementById('statLastAlgo').textContent = result.algorithm.toUpperCase();
    document.getElementById('statAvgWait').textContent = result.avgWaitingTime + ' ms';
    document.getElementById('statAvgTAT').textContent = result.avgTurnaroundTime + ' ms';

    // Add to recent simulations
    addRecentSimulation(result);
}

function displayGanttChart(schedule) {
    const chart = document.getElementById('ganttChart');
    if (!chart || !schedule || schedule.length === 0) return;

    const colors = generateColors(new Set(schedule.map(s => s.threadId)).size);
    const colorMap = {};
    const maxTime = Math.max(...schedule.map(s => s.endTime));

    let threadIndex = 0;
    const uniqueThreads = new Set();

    schedule.forEach(item => {
        if (!uniqueThreads.has(item.threadId)) {
            uniqueThreads.add(item.threadId);
            colorMap[item.threadId] = colors[threadIndex % colors.length];
            threadIndex++;
        }
    });

    chart.innerHTML = '';

    const threadSchedule = {};
    schedule.forEach(item => {
        if (!threadSchedule[item.threadId]) {
            threadSchedule[item.threadId] = [];
        }
        threadSchedule[item.threadId].push(item);
    });

    Object.entries(threadSchedule).forEach(([threadId, items]) => {
        const container = document.createElement('div');
        container.className = 'gantt-bar-container';

        const label = document.createElement('div');
        label.className = 'gantt-bar-label';
        label.textContent = threadId;

        const barsContainer = document.createElement('div');
        barsContainer.className = 'gantt-bars';

        items.forEach(item => {
            const width = (item.burstTime / maxTime) * 100;
            const offset = (item.startTime / maxTime) * 100;

            const bar = document.createElement('div');
            bar.className = 'gantt-bar';
            bar.style.width = width + '%';
            bar.style.marginLeft = offset + '%';
            bar.style.background = colorMap[threadId];
            bar.textContent = `${item.startTime}-${item.endTime}`;
            bar.title = `${threadId}: ${item.startTime}ms - ${item.endTime}ms`;

            barsContainer.appendChild(bar);
        });

        container.appendChild(label);
        container.appendChild(barsContainer);
        chart.appendChild(container);
    });
}

function displayExecutionSequence(schedule) {
    const seq = document.getElementById('executionSequence');
    if (!seq || !schedule) return;

    const order = [];
    const seen = new Set();

    schedule.forEach(item => {
        if (!seen.has(item.threadId)) {
            order.push(item.threadId);
            seen.add(item.threadId);
        }
    });

    seq.innerHTML = order.map((id, i) =>
        `<span class="sequence-item">${escapeHtml(id)}</span>` +
        (i < order.length - 1 ? '<span style="color: var(--bright-red); margin: 0 0.5rem; font-weight: bold;">→</span>' : '')
    ).join('');
}

function displayMetrics(result) {
    const metricsTable = document.getElementById('metricsTable');
    const metricsContent = document.getElementById('metricsContent');
    const tbody = document.getElementById('metricsTableBody');

    if (!metricsTable || !tbody) return;

    metricsTable.style.display = 'table';
    document.getElementById('noMetricsMsg').style.display = 'none';

    tbody.innerHTML = '';

    Object.keys(result.waitingTimes).forEach(threadId => {
        const thread = threads.find(t => t.id === threadId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(threadId)}</strong></td>
            <td>${thread?.arrivalTime || 0}</td>
            <td>${thread?.burstTime || 0}</td>
            <td>${result.waitingTimes[threadId]}</td>
            <td>${result.turnaroundTimes[threadId]}</td>
            <td>${(result.responseTimes?.[threadId] || 0).toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });

    // Update metrics content
    if (metricsContent) {
        metricsContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                <div style="background: rgba(211, 47, 47, 0.1); padding: 1rem; border-radius: 8px;">
                    <div style="color: var(--text-muted); font-size: 0.9rem;">Avg Waiting Time</div>
                    <div style="color: var(--bright-red); font-size: 1.5rem; font-weight: bold;">${result.avgWaitingTime.toFixed(2)} ms</div>
                </div>
                <div style="background: rgba(211, 47, 47, 0.1); padding: 1rem; border-radius: 8px;">
                    <div style="color: var(--text-muted); font-size: 0.9rem;">Avg Turnaround Time</div>
                    <div style="color: var(--bright-red); font-size: 1.5rem; font-weight: bold;">${result.avgTurnaroundTime.toFixed(2)} ms</div>
                </div>
                <div style="background: rgba(211, 47, 47, 0.1); padding: 1rem; border-radius: 8px;">
                    <div style="color: var(--text-muted); font-size: 0.9rem;">Avg Response Time</div>
                    <div style="color: var(--bright-red); font-size: 1.5rem; font-weight: bold;">${(result.avgResponseTime || 0).toFixed(2)} ms</div>
                </div>
            </div>
        `;
    }
}

function addRecentSimulation(result) {
    const list = document.getElementById('recentSimsList');
    if (!list) return;

    const item = document.createElement('div');
    item.style.cssText = 'padding: 1rem; background: rgba(211, 47, 47, 0.1); border-radius: 8px; border-left: 4px solid var(--bright-red); margin-bottom: 0.75rem;';
    item.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
            <strong>${result.algorithm.toUpperCase()}</strong>
            <span style="color: var(--text-muted);">${new Date().toLocaleTimeString()}</span>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.9rem;">
            Threads: ${result.threadsCount} | WT: ${result.avgWaitingTime.toFixed(2)}ms | TAT: ${result.avgTurnaroundTime.toFixed(2)}ms
        </div>
    `;
    list.insertBefore(item, list.firstChild);

    // Keep only last 5
    while (list.children.length > 5) {
        list.removeChild(list.lastChild);
    }
}

// ==================== ANIMATION ========================

let animationInterval = null;
let currentAnimationIndex = 0;

function animateGantt() {
    if (!currentSimulation || !currentSimulation.schedule) return;

    const bars = document.querySelectorAll('.gantt-bar');
    const totalBars = bars.length;

    animationInterval = setInterval(() => {
        currentAnimationIndex++;
        const progress = (currentAnimationIndex / totalBars) * 100;
        document.getElementById('progressFill').style.width = progress + '%';

        if (currentAnimationIndex >= totalBars) {
            clearInterval(animationInterval);
        }
    }, 100);
}

function stopGanttAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
    }
}

function resetGanttAnimation() {
    stopGanttAnimation();
    currentAnimationIndex = 0;
    document.getElementById('progressFill').style.width = '0%';
}

// ==================== UTILITY FUNCTIONS ====================

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    const container = document.getElementById('ganttChartContainer');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
    if (container && !show) container.style.display = 'block';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.borderLeftColor = type === 'error' ? '#ff5252' : type === 'success' ? '#48bb78' : '#2196F3';

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function generateColors(count) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6'
    ];
    return colors;
}

async function checkServerConnection() {
    try {
        const response = await fetch(`${API_BASE}/threads`);
        if (response.ok) {
            document.getElementById('threadStatusBadge').textContent = '✓ Connected';
            document.getElementById('threadStatusBadge').style.color = '#00d9ff';
        }
    } catch (error) {
        document.getElementById('threadStatusBadge').textContent = '⚠ Offline';
        showToast('Cannot connect to backend. Run: node server.js', 'error');
    }
}
