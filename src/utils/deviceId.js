/**
 * Device ID Utility
 * Generates and stores a unique device ID for user identification
 * This allows separating project data between different devices/users
 */

const STORAGE_KEY = 'smart-banner-device-id'

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Get or create device ID
 * @returns {string} Device ID
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem(STORAGE_KEY)

  if (!deviceId) {
    deviceId = generateUUID()
    localStorage.setItem(STORAGE_KEY, deviceId)
  }

  return deviceId
}

/**
 * Clear device ID (for testing/reset purposes)
 */
export function clearDeviceId() {
  localStorage.removeItem(STORAGE_KEY)
}
