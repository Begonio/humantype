import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import type { Request } from 'express'
import type { GoogleTokens } from '../types'

const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'profile',
  'email',
]

export function configurePassport(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${process.env.SERVER_URL ?? 'http://localhost:3001'}/api/auth/google/callback`,
        passReqToCallback: true,
      },
      (req: Request, accessToken: string, refreshToken: string, profile, done) => {
        const tokens: GoogleTokens = {
          access_token: accessToken,
          refresh_token: refreshToken,
        }
        // Store tokens in session
        if (req.session) {
          req.session.tokens = tokens
          req.session.userId = profile.id
        }
        done(null, profile)
      }
    )
  )

  passport.serializeUser((user, done) => {
    done(null, (user as { id: string }).id)
  })

  passport.deserializeUser((id, done) => {
    done(null, { id })
  })
}

export function getAuthUrl(): string {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SERVER_URL ?? 'http://localhost:3001'}/api/auth/google/callback`
  )
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export function createOAuth2Client(tokens: GoogleTokens): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SERVER_URL ?? 'http://localhost:3001'}/api/auth/google/callback`
  )
  client.setCredentials(tokens)
  return client
}
