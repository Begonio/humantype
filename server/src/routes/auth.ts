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
  const user = req.user as { accessToken?: string } | undefined
  const authenticated = req.isAuthenticated() && !!user?.accessToken
  console.log('[auth/status] authenticated:', authenticated, '| cookie:', req.headers.cookie ? 'present' : 'missing')
  res.json({ authenticated })
})

// Sign out
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

export default router
