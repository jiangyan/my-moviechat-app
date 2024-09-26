import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { z } from 'zod'
import { getStringFromBuffer } from './lib/utils'
import { getUser } from './app/login/actions'
import { User } from 'next-auth'
import { DocumentData } from 'firebase/firestore'

// Define a function to convert DocumentData to User
function documentDataToUser(data: DocumentData | null): User | null {
  if (!data) return null;
  return {
    id: data.id, // Assuming your DocumentData has an 'id' field
    email: data.email,
    // Add other required User fields here
  };
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6)
          })
          .safeParse(credentials)

        if (!parsedCredentials.success) return null;

        const { email, password } = parsedCredentials.data;
        const user = await getUser(email);
        if (!user) return null;

        const encoder = new TextEncoder();
        const saltedPassword = encoder.encode(password + user.salt);
        const hashedPasswordBuffer = await crypto.subtle.digest(
          'SHA-256',
          saltedPassword
        );
        const hashedPassword = getStringFromBuffer(hashedPasswordBuffer);

        if (hashedPassword === user.password) {
          return {
            id: user.id,            
            email: user.email,
          };
        } else {
          return null;
        }
      }
    })
  ]
})
