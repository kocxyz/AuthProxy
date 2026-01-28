import crypto from 'crypto';

export function genHash(token: string, username: string, secret: string): string {
    const day = new Date().getUTCDate()
    return crypto.createHash('sha256').update(`${token}${username}${secret}${day}`).digest('hex')
}

export function verifyHash(providedHash: string, token: string, username: string, secret: string): boolean {
    const expectedHash = genHash(token, username, secret)
    return providedHash === expectedHash
}