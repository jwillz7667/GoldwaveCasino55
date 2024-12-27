import { showNotification, formatCurrency } from './dashboard.js';

class Analytics {
    constructor() {
        this.charts = {};
        this.timeRange = '7d'; // Default to 7 days

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Time range selector
        document.getElementById('timeRange')?.addEventListener('change', (e) => {
            this.timeRange = e.target.value;
            this.loadAnalytics();
        });
    }

    async loadAnalytics() {
        try {
            const response = await fetch(`/api/admin/analytics?timeRange=${this.timeRange}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load analytics data');
            }

            const data = await response.json();
            this.updateCharts(data);
        } catch (error) {
            showNotification('Error loading analytics', 'error');
        }
    }

    updateCharts(data) {
        this.updateRevenueChart(data.revenue);
        this.updateUserActivityChart(data.userActivity);
        this.updateGamePerformanceChart(data.gamePerformance);
        this.updateTransactionVolumeChart(data.transactionVolume);
    }

    updateRevenueChart(data) {
        const ctx = document.getElementById('revenueChart').getContext('2d');

        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: data.values,
                        borderColor: '#1a73e8',
                        backgroundColor: 'rgba(26, 115, 232, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.raw),
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                        },
                    },
                },
            },
        });
    }

    updateUserActivityChart(data) {
        const ctx = document.getElementById('userActivityChart').getContext('2d');

        if (this.charts.userActivity) {
            this.charts.userActivity.destroy();
        }

        this.charts.userActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Active Users',
                        data: data.activeUsers,
                        backgroundColor: '#1a73e8',
                    },
                    {
                        label: 'New Users',
                        data: data.newUsers,
                        backgroundColor: '#34a853',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                        },
                    },
                },
            },
        });
    }

    updateGamePerformanceChart(data) {
        const ctx = document.getElementById('gamePerformanceChart').getContext('2d');

        if (this.charts.gamePerformance) {
            this.charts.gamePerformance.destroy();
        }

        this.charts.gamePerformance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        data: data.values,
                        backgroundColor: ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e8'],
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = formatCurrency(context.raw);
                                const percentage = ((context.raw / data.total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            },
                        },
                    },
                },
            },
        });
    }

    updateTransactionVolumeChart(data) {
        const ctx = document.getElementById('transactionVolumeChart').getContext('2d');

        if (this.charts.transactionVolume) {
            this.charts.transactionVolume.destroy();
        }

        this.charts.transactionVolume = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Deposits',
                        data: data.deposits,
                        borderColor: '#34a853',
                        backgroundColor: 'rgba(52, 168, 83, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                    {
                        label: 'Withdrawals',
                        data: data.withdrawals,
                        borderColor: '#ea4335',
                        backgroundColor: 'rgba(234, 67, 53, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                return `${label}: ${formatCurrency(context.raw)}`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                        },
                    },
                },
            },
        });
    }
}

// Initialize analytics when the analytics section is shown
document.querySelector('a[href="#analytics"]').addEventListener('click', () => {
    if (!window.analytics) {
        window.analytics = new Analytics();
    }
    window.analytics.loadAnalytics();
});
