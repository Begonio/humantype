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

export interface PassportUser {
  id: string
  accessToken: string
  refreshToken: string | null
}

export function configurePassport(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${process.env.SERVER_URL ?? 'http://localhost:3001'}/api/auth/google/callback`,
      },
      (_accessToken: string, _refreshToken: string, profile, done) => {
        // Store tokens on the user object so Passport serializes them into the session
        // (Setting them directly on req.session here would lose them on session regeneration)
        const user: PassportUser = {
          id: profile.id,
          accessToken: _accessToken,
          refreshToken: _refreshToken ?? null,
        }
        done(null, user)
      }
    )
  )

  // Serialize the full user+tokens into the session
  passport.serializeUser((user, done) => {
    done(null, user)
  })

  // Deserialize restores the full user+tokens from the session
  passport.deserializeUser((user, done) => {
    done(null, user as PassportUser)
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
