import axios from 'axios'

export const API_BASE = 'http://localhost:8000'

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail
    let message = null
    if (Array.isArray(detail)) {
      message = detail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
    } else if (typeof detail === 'string') {
      message = detail
    } else if (typeof error.response?.data === 'string') {
      message = error.response.data
    }
    message = message ?? error.message ?? 'Request failed'
    return Promise.reject(new Error(message))
  },
)

export default client
