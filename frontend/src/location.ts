export interface OneTimeLocation {
  lat: number
  lng: number
  accuracy_m: number
}

const rounded = (value: number) => Math.round(value * 10_000) / 10_000

/**
 * Ask for one position only. The returned coordinates live in caller memory; this
 * module never writes them to storage, cookies, URLs, analytics, or app state.
 */
export function getOneTimeLocation(): Promise<OneTimeLocation> {
  if (!navigator.geolocation) return Promise.reject(new Error('Location is not available in this browser.'))

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        // Roughly 11 m precision is enough to find a safe walking/transit origin.
        lat: rounded(position.coords.latitude),
        lng: rounded(position.coords.longitude),
        accuracy_m: Math.round(position.coords.accuracy),
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was declined. You can still move the map pin manually.'
          : error.code === error.TIMEOUT
            ? 'Location took too long. Try again or move the map pin manually.'
            : 'Your location could not be determined. Try moving the map pin manually.'
        reject(new Error(message))
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 },
    )
  })
}
