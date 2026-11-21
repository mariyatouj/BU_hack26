// Hackathon stand-in for auth: the app sends this id as the X-User-Id header.
let userId = 1
export const setUserId = (id: number) => { userId = id }
export const getUserId = () => userId
