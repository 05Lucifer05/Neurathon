import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            // Optionally redirect to login
        }
        return Promise.reject(error)
    }
)

// Auth API
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (data) => api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout')
}

// Scans API
export const scansAPI = {
    create: (accounts, name) => api.post('/scans', { accounts, name }),
    getAll: (params) => api.get('/scans', { params }),
    getById: (id) => api.get(`/scans/${id}`),
    getResults: (id, params) => api.get(`/scans/${id}/results`, { params }),
    delete: (id) => api.delete(`/scans/${id}`)
}

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
    getPublicStats: () => api.get('/dashboard/public/stats'),
    getTrends: (days = 30) => api.get('/dashboard/trends', { params: { days } }),
    getRiskDistribution: () => api.get('/dashboard/risk-distribution'),
    getActivityHeatmap: () => api.get('/dashboard/activity-heatmap'),
    getFlaggedAccounts: (limit = 20) => api.get('/dashboard/flagged-accounts', { params: { limit } }),
    getRecentScans: (limit = 10) => api.get('/dashboard/recent-scans', { params: { limit } }),
    getMLStatus: () => api.get('/dashboard/ml-status')
}

// Training API
export const trainingAPI = {
    trainWithFile: (formData) => api.post('/training/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }),
    getStatus: (jobId) => api.get(`/training/status/${jobId}`)
}

export default api
