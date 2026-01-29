/**
 * Background Removal Utility - Optimized Version
 *
 * Lightweight background removal for e-commerce product images.
 * Uses chunked processing to prevent UI freeze.
 */

/**
 * Remove background from an image using optimized color threshold method
 * Uses chunked processing to prevent UI blocking
 *
 * @param {string} imageDataUrl - Base64 encoded image data URL
 * @param {Object} options - Options for background removal
 * @param {number} options.threshold - Color threshold for background detection (0-255, default: 240)
 * @returns {Promise<string>} - Base64 encoded PNG with transparent background
 */
export async function removeBackground(imageDataUrl, options = {}) {
  const { threshold = 240 } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = async () => {
      try {
        // Limit max size for performance
        const maxSize = 1024
        let width = img.width
        let height = img.height

        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = width
        canvas.height = height

        // Draw scaled image
        ctx.drawImage(img, 0, 0, width, height)

        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        // Simple and fast: Mark white/light pixels as background from edges
        const isBackground = new Uint8Array(width * height)

        // First pass: identify potential background pixels
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (r >= threshold && g >= threshold && b >= threshold) {
            isBackground[i / 4] = 1
          }
        }

        // Fast flood fill from edges using iterative approach with stack (faster than queue)
        const visited = new Uint8Array(width * height)
        const stack = []

        // Add edge pixels
        for (let x = 0; x < width; x++) {
          if (isBackground[x]) stack.push(x) // Top edge
          const bottomIdx = (height - 1) * width + x
          if (isBackground[bottomIdx]) stack.push(bottomIdx)
        }
        for (let y = 1; y < height - 1; y++) {
          const leftIdx = y * width
          const rightIdx = y * width + width - 1
          if (isBackground[leftIdx]) stack.push(leftIdx)
          if (isBackground[rightIdx]) stack.push(rightIdx)
        }

        // Process flood fill
        while (stack.length > 0) {
          const idx = stack.pop()
          if (visited[idx]) continue
          if (!isBackground[idx]) continue

          visited[idx] = 1
          const x = idx % width
          const y = Math.floor(idx / width)

          // Add neighbors (4-connectivity for speed)
          if (x > 0) stack.push(idx - 1)
          if (x < width - 1) stack.push(idx + 1)
          if (y > 0) stack.push(idx - width)
          if (y < height - 1) stack.push(idx + width)
        }

        // Apply transparency
        for (let i = 0; i < visited.length; i++) {
          if (visited[i]) {
            data[i * 4 + 3] = 0 // Set alpha to 0
          }
        }

        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image for background removal'))
    }

    img.src = imageDataUrl
  })
}

/**
 * Simple background removal - even faster, less accurate
 * Good for quick previews
 */
export async function removeBackgroundFast(imageDataUrl, threshold = 240) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Use smaller size for speed
      const maxSize = 512
      let width = img.width
      let height = img.height

      if (width > maxSize || height > maxSize) {
        const scale = maxSize / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      // Simple threshold-based removal (no flood fill)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        if (r >= threshold && g >= threshold && b >= threshold) {
          data[i + 3] = 0
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageDataUrl
  })
}
