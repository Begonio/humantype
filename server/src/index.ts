import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'
import passport from 'passport'
import path from 'path'
import { configurePassport } from './google/auth'
import authRouter from './routes/auth'
import writeRouter from './routes/write'

const app = express()
const PORT = process.env.PORT ?? 3001
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Configure passport Google strategy
configurePassport()

// Middleware
if (!IS_PRODUCTION) {
  // In dev, frontend runs on a separate Vite server — allow cross-origin
  app.use(cors({
    origin: CLIENT_URL,
    credentials: true,
  }))
}

app.use(express.json({ limit: '2mb' }))

app.use(session({
  secret: process.env.SESSION_SECRET ?? 'humantype-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,  // HTTPS in production
    sameSite: IS_PRODUCTION ? 'lax' : false,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}))

app.use(passport.initialize())
app.use(passport.session())

// Routes
app.use('/api/auth', authRouter)
app.use('/api', writeRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Serve built frontend in production
if (IS_PRODUCTION) {
  const clientDist = path.join(__dirname, '../../client/dist')
  app.use(express.static(clientDist))
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[server] HumanType server running on http://localhost:${PORT}`)
  console.log(`[server] Mode: ${IS_PRODUCTION ? 'production' : 'development'}`)
  console.log(`[server] Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? '✓ set' : '✗ missing'}`)
  console.log(`[server] Google Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? '✓ set' : '✗ missing'}`)
})
