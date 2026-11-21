import type { TransitRoute } from './TransitLayer'

// Existing schematic overlay for orientation until official route shapes are available.
const illustrativeLines: { name: string; color: string; stops: [string, number, number][] }[] = [
  { name: 'Red', color: '#da291c', stops: [['Harvard', 42.3734, -71.1189], ['Central', 42.3654, -71.1037], ['Kendall', 42.3625, -71.0862], ['Charles/MGH', 42.3612, -71.0706], ['Park St', 42.3564, -71.0624], ['Downtown Crossing', 42.3555, -71.0603], ['South Station', 42.3523, -71.0552], ['Broadway', 42.3426, -71.0569], ['Andrew', 42.3302, -71.057], ['JFK/UMass', 42.3207, -71.0524], ['Savin Hill', 42.3112, -71.0533], ['Fields Corner', 42.3, -71.0617]] },
  { name: 'Green', color: '#00843d', stops: [['Washington St', 42.3437, -71.1428], ['Harvard Ave', 42.3503, -71.131], ['Packards Corner', 42.3517, -71.1253], ['BU Central', 42.3503, -71.1067], ['BU East', 42.3497, -71.104], ['Kenmore', 42.3489, -71.0952], ['Hynes', 42.3478, -71.0874], ['Copley', 42.35, -71.0774], ['Arlington', 42.3519, -71.0707], ['Boylston', 42.3529, -71.0646], ['Park St', 42.3564, -71.0624]] },
  { name: 'Orange', color: '#ed8b00', stops: [['Forest Hills', 42.3005, -71.1137], ['Green St', 42.3105, -71.1074], ['Stony Brook', 42.3171, -71.1043], ['Jackson Sq', 42.3231, -71.0997], ['Roxbury Crossing', 42.3314, -71.0954], ['Ruggles', 42.3364, -71.089], ['Mass Ave', 42.3415, -71.0834], ['Back Bay', 42.3473, -71.0754], ['Tufts Medical', 42.3497, -71.0639], ['Chinatown', 42.3524, -71.0627], ['Downtown Crossing', 42.3555, -71.0603], ['State', 42.3589, -71.0576], ['Haymarket', 42.363, -71.0583], ['North Station', 42.3657, -71.0613]] },
  { name: 'Blue', color: '#003da5', stops: [['Bowdoin', 42.3614, -71.062], ['Government Ctr', 42.3597, -71.0592], ['State', 42.3589, -71.0576], ['Aquarium', 42.3598, -71.0517], ['Maverick', 42.3691, -71.0395], ['Airport', 42.3743, -71.0303]] },
]

export const illustrativeRoutes: TransitRoute[] = illustrativeLines.map(({ name, color, stops }) => ({
  id: name,
  color,
  shape: stops.map(([, lat, lng]) => [lat, lng]),
  stops: stops.map(([name, lat, lng]) => ({ id: name, name, lat, lng })),
}))
