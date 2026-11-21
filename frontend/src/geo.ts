// Simple equirectangular projection for a Boston-sized box (no tile server needed).
export const BOUNDS = { west: -71.148, east: -71.022, north: 42.384, south: 42.291 }
export const W = 1000
export const H = Math.round(((BOUNDS.north - BOUNDS.south) / ((BOUNDS.east - BOUNDS.west) * Math.cos((42.34 * Math.PI) / 180))) * W)

export const project = (lat: number, lng: number): [number, number] => [
  ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W,
  ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H,
]
export const unproject = (x: number, y: number): [number, number] => [
  BOUNDS.north - (y / H) * (BOUNDS.north - BOUNDS.south),
  BOUNDS.west + (x / W) * (BOUNDS.east - BOUNDS.west),
]
export const kmToPx = (km: number) => (km / (111.32 * Math.cos((42.34 * Math.PI) / 180))) / (BOUNDS.east - BOUNDS.west) * W

/** Great-circle distance used client-side so a visitor's location never needs to be sent just to sort pantries. */
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

const path = (pts: [number, number][]) => pts.map(([lat, lng], i) => `${i ? 'L' : 'M'}${project(lat, lng).map((v) => v.toFixed(1)).join(',')}`).join('')

// Stylized geography (approximate, for orientation only)
export const RIVER = path([
  [42.3625, -71.148], [42.3665, -71.135], [42.3705, -71.123], [42.367, -71.1165], [42.3585, -71.118], [42.354, -71.112],
  [42.3535, -71.1], [42.3555, -71.09], [42.358, -71.08], [42.3615, -71.072], [42.368, -71.066], [42.3735, -71.0625], [42.384, -71.058],
])
export const HARBOR = path([
  [42.384, -71.064], [42.372, -71.06], [42.366, -71.052], [42.36, -71.048], [42.355, -71.05], [42.35, -71.047], [42.348, -71.034],
  [42.341, -71.03], [42.336, -71.044], [42.326, -71.05], [42.316, -71.046], [42.305, -71.051], [42.291, -71.042],
  [42.291, -71.022], [42.384, -71.022],
]) + 'Z'
export const EASTIE = path([
  [42.3655, -71.046], [42.374, -71.044], [42.384, -71.04], [42.384, -71.026], [42.372, -71.022], [42.3625, -71.032],
]) + 'Z'

export const T_LINES: { name: string; color: string; stops: [string, number, number][] }[] = [
  { name: 'Red', color: '#da291c', stops: [['Harvard', 42.3734, -71.1189], ['Central', 42.3654, -71.1037], ['Kendall', 42.3625, -71.0862], ['Charles/MGH', 42.3612, -71.0706], ['Park St', 42.3564, -71.0624], ['Downtown Crossing', 42.3555, -71.0603], ['South Station', 42.3523, -71.0552], ['Broadway', 42.3426, -71.0569], ['Andrew', 42.3302, -71.057], ['JFK/UMass', 42.3207, -71.0524], ['Savin Hill', 42.3112, -71.0533], ['Fields Corner', 42.3, -71.0617]] },
  { name: 'Green', color: '#00843d', stops: [['Washington St', 42.3437, -71.1428], ['Harvard Ave', 42.3503, -71.131], ['Packards Corner', 42.3517, -71.1253], ['BU Central', 42.3503, -71.1067], ['BU East', 42.3497, -71.104], ['Kenmore', 42.3489, -71.0952], ['Hynes', 42.3478, -71.0874], ['Copley', 42.35, -71.0774], ['Arlington', 42.3519, -71.0707], ['Boylston', 42.3529, -71.0646], ['Park St', 42.3564, -71.0624]] },
  { name: 'Orange', color: '#ed8b00', stops: [['Forest Hills', 42.3005, -71.1137], ['Green St', 42.3105, -71.1074], ['Stony Brook', 42.3171, -71.1043], ['Jackson Sq', 42.3231, -71.0997], ['Roxbury Crossing', 42.3314, -71.0954], ['Ruggles', 42.3364, -71.089], ['Mass Ave', 42.3415, -71.0834], ['Back Bay', 42.3473, -71.0754], ['Tufts Medical', 42.3497, -71.0639], ['Chinatown', 42.3524, -71.0627], ['Downtown Crossing', 42.3555, -71.0603], ['State', 42.3589, -71.0576], ['Haymarket', 42.363, -71.0583], ['North Station', 42.3657, -71.0613]] },
  { name: 'Blue', color: '#003da5', stops: [['Bowdoin', 42.3614, -71.062], ['Government Ctr', 42.3597, -71.0592], ['State', 42.3589, -71.0576], ['Aquarium', 42.3598, -71.0517], ['Maverick', 42.3691, -71.0395], ['Airport', 42.3743, -71.0303]] },
]
export const linePath = (stops: [string, number, number][]) => path(stops.map(([, lat, lng]) => [lat, lng]))

export const NEIGHBORHOODS: [string, number, number][] = [
  ['Allston', 42.3575, -71.1335], ['Fenway', 42.3425, -71.1], ['Back Bay', 42.3535, -71.0815], ['Cambridge', 42.3725, -71.098],
  ['Roxbury', 42.3215, -71.083], ['Dorchester', 42.3045, -71.074], ['Jamaica Plain', 42.2995, -71.1255], ['East Boston', 42.3775, -71.0335],
  ['South End', 42.3405, -71.071], ['South Boston', 42.3355, -71.038],
]
