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
  const hasTokens = !!(req.session as { tokens?: unknown }).tokens
  res.json({ authenticated: hasTokens })
})

// Sign out
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

export default router
