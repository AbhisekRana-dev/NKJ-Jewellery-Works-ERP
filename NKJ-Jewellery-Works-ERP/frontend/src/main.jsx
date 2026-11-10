import './shared/styles/common.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import App from './app/App'
import {AuthProvider} from './core/auth/AuthProvider'
import RealtimeProvider from './core/realtime/RealtimeProvider'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><RealtimeProvider><App/></RealtimeProvider></AuthProvider></BrowserRouter></React.StrictMode>
)
