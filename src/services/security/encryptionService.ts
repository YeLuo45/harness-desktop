import { EncryptionKey } from './securityTypes'

const STORAGE_KEY = 'security_encryption_keys'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

// Simple XOR cipher for demo - in production use Web Crypto API
class SimpleCipher {
  private key: number[]

  constructor(seed: string) {
    this.key = seed.split('').map(c => c.charCodeAt(0))
  }

  encrypt(text: string): string {
    const encrypted: number[] = []
    for (let i = 0; i < text.length; i++) {
      encrypted.push(text.charCodeAt(i) ^ this.key[i % this.key.length])
    }
    return btoa(String.fromCharCode(...encrypted))
  }

  decrypt(encoded: string): string {
    const encrypted = atob(encoded).split('').map(c => c.charCodeAt(0))
    const decrypted: number[] = []
    for (let i = 0; i < encrypted.length; i++) {
      decrypted.push(encrypted[i] ^ this.key[i % this.key.length])
    }
    return String.fromCharCode(...decrypted)
  }
}

export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map()
  private currentKeyId: string | null = null
  private cipher: SimpleCipher | null = null

  constructor() {
    this.loadFromStorage()
    this.ensureActiveKey()
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const keys = JSON.parse(data)
        keys.forEach((k: EncryptionKey) => this.keys.set(k.id, k))
        const activeKey = Array.from(this.keys.values()).find(k => k.isActive)
        if (activeKey) {
          this.currentKeyId = activeKey.id
          this.cipher = new SimpleCipher(activeKey.id)
        }
      }
    } catch (e) {
      console.warn('Failed to load encryption keys:', e)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.keys.values())))
    } catch (e) {
      console.warn('Failed to save encryption keys:', e)
    }
  }

  private ensureActiveKey(): void {
    if (!this.currentKeyId) {
      this.rotateKey()
    }
  }

  rotateKey(): string {
    if (this.currentKeyId) {
      const current = this.keys.get(this.currentKeyId)
      if (current) {
        current.isActive = false
        this.keys.set(this.currentKeyId, current)
      }
    }

    const id = generateId()
    const key: EncryptionKey = {
      id,
      version: this.keys.size + 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      isActive: true
    }

    this.keys.set(id, key)
    this.currentKeyId = id
    this.cipher = new SimpleCipher(id)
    this.saveToStorage()

    return id
  }

  encrypt(data: string): string {
    if (!this.cipher) {
      throw new Error('No encryption key available')
    }
    const encrypted = this.cipher.encrypt(data)
    return `${this.currentKeyId}:${encrypted}`
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':')
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format')
    }
    const [keyId, encrypted] = parts
    const key = this.keys.get(keyId)
    if (!key) {
      throw new Error('Encryption key not found')
    }
    const cipher = new SimpleCipher(keyId)
    return cipher.decrypt(encrypted)
  }

  getCurrentKeyId(): string | null {
    return this.currentKeyId
  }

  getAllKeys(): EncryptionKey[] {
    return Array.from(this.keys.values())
  }

  encryptObject<T>(obj: T): string {
    return this.encrypt(JSON.stringify(obj))
  }

  decryptObject<T>(encryptedData: string): T {
    return JSON.parse(this.decrypt(encryptedData)) as T
  }

  hash(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  verify(data: string, hashed: string): boolean {
    return this.hash(data) === hashed
  }
}

export const encryptionService = new EncryptionService()