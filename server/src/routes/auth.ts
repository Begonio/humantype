import { Router } from 'express'
import passport from 'passport'

const router = Router()

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', {
  scope: [
    'https://www.googleapis.com/auth/documents',
    'profile',
    'email',
  ],
  accessType: 'offline',
  prompt: 'consent',
} as Parameters<typeof passport.authenticate>[1]))

// OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}?error=auth_failed` }),
  (req, res) => {
    // Explicitly save session before redirecting so the cookie is set in time
    req.session.save(() => {
      res.redirect(`${process.env.CLIENT_URL}?authed=1`)
    })
  }
)

// Check auth status
router.get('/status', (req, res) => {
  const session = req.session as { tokens?: unknown }
  const hasTokens = !!session.tokens
  console.log('[auth/status] session id:', req.sessionID, '| hasTokens:', hasTokens, '| cookies:', req.headers.cookie ? 'present' : 'missing')
  res.json({ authenticated: hasTokens })
})

// Debug endpoint — temporary
router.get('/debug', (req, res) => {
  const session = req.session as { tokens?: unknown; userId?: string }
  res.json({
    sessionID: req.sessionID,
    hasTokens: !!session.tokens,
    userId: session.userId ?? null,
    cookieHeader: req.headers.cookie ?? null,
  })
})

// Sign out
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

export default router
