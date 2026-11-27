import axios from 'axios'
import { env } from '../env'

const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Authentication handling is managed by the auth store/router.
      // Do not redirect here to avoid coupling Axios to Vue Router.
    }

    if (error.response?.status === 403) {
      // Authorization failure.
      // The calling feature decides how to present the error.
    }

    return Promise.reject(error)
  },
)

export default apiClient