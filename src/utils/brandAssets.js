/**
 * Brand Assets Management Utility
 * Stores brand logos in localStorage for reuse
 */

const STORAGE_KEY = 'smart-banner-brand-logos'
const MAX_LOGOS = 10
const MAX_SIZE_KB = 500 // Max size per logo in KB

/**
 * Get all saved brand logos
 * @returns {Array} Array of logo objects
 */
export function getSavedLogos() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load saved logos:', error)
    return []
  }
}

/**
 * Save a new brand logo
 * @param {Object} logo - Logo object with name, base64, mimeType
 * @returns {boolean} Success status
 */
export function saveLogo(logo) {
  try {
    const logos = getSavedLogos()

    // Check if logo with same name exists
    const existingIndex = logos.findIndex(l => l.name === logo.name)
    if (existingIndex >= 0) {
      logos[existingIndex] = { ...logo, updatedAt: Date.now() }
    } else {
      // Add new logo
      if (logos.length >= MAX_LOGOS) {
        // Remove oldest logo
        logos.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0))
        logos.shift()
      }
      logos.push({ ...logo, createdAt: Date.now(), updatedAt: Date.now() })
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logos))
    return true
  } catch (error) {
    console.error('Failed to save logo:', error)
    return false
  }
}

/**
 * Delete a saved logo by name
 * @param {string} name - Logo name
 * @returns {boolean} Success status
 */
export function deleteLogo(name) {
  try {
    const logos = getSavedLogos()
    const filtered = logos.filter(l => l.name !== name)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error('Failed to delete logo:', error)
    return false
  }
}

/**
 * Compress image to reduce storage size
 * @param {string} dataUrl - Image data URL
 * @param {number} maxSizeKB - Max size in KB
 * @returns {Promise<string>} Compressed data URL
 */
export async function compressImage(dataUrl, maxSizeKB = MAX_SIZE_KB) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Calculate new size (max 256px for logos)
      const maxDim = 256
      let width = img.width
      let height = img.height

      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      // Try different quality levels
      let quality = 0.9
      let result = canvas.toDataURL('image/png')

      // If PNG is too large, try JPEG
      if (result.length > maxSizeKB * 1024) {
        while (quality > 0.3 && result.length > maxSizeKB * 1024) {
          result = canvas.toDataURL('image/jpeg', quality)
          quality -= 0.1
        }
      }

      resolve(result)
    }
    img.src = dataUrl
  })
}

/**
 * Process and save a logo from file input
 * @param {File} file - Image file
 * @param {string} name - Logo name
 * @returns {Promise<Object>} Saved logo object
 */
export async function processAndSaveLogo(file, name) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Invalid file type'))
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const compressed = await compressImage(event.target.result)
        const logo = {
          name: name || file.name.replace(/\.[^/.]+$/, ''),
          base64: compressed.split(',')[1],
          mimeType: compressed.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          dataUrl: compressed,
        }

        if (saveLogo(logo)) {
          resolve(logo)
        } else {
          reject(new Error('Failed to save logo'))
        }
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
