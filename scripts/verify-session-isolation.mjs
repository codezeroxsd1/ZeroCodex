import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const USER_A = {
  email: 'sessiontest@example.com',
  password: 'password123',
  name: 'Session Test User',
}
const USER_B = {
  email: 'secondbrowser@example.com',
  password: 'password123',
  name: 'Second Browser User',
}

function extractCookieHeader(response) {
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean)

  const cookieMap = new Map()

  for (const raw of setCookies) {
    const [firstPart] = raw.split(';')
    const separatorIndex = firstPart.indexOf('=')
    if (separatorIndex === -1) continue
    const name = firstPart.slice(0, separatorIndex)
    const value = firstPart.slice(separatorIndex + 1)
    cookieMap.set(name, value)
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  return { response, payload, text }
}

async function signInAndCollectCookie(email, password) {
  const { response, payload } = await request(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  assert.equal(response.status, 200, `sign-in failed for ${email}`)
  assert.ok(payload, 'sign-in response should contain JSON payload')

  const cookieHeader = extractCookieHeader(response)
  assert.ok(cookieHeader, `missing session cookie after sign-in for ${email}`)

  return cookieHeader
}

async function signUpAndCollectCookie(email, password, name, role = 'cliente') {
  const { response, payload } = await request(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    body: JSON.stringify({ email, password, name, role }),
  })

  assert.equal(response.status, 200, `sign-up failed for ${email}`)
  assert.ok(payload, 'sign-up response should contain JSON payload')

  const cookieHeader = extractCookieHeader(response)
  assert.ok(cookieHeader, `missing session cookie after sign-up for ${email}`)

  return cookieHeader
}

async function getSession(cookieHeader) {
  const { response, payload } = await request(`${BASE_URL}/api/auth/get-session`, {
    headers: { Cookie: cookieHeader },
  })

  assert.equal(response.status, 200, 'session endpoint should return 200')
  return payload
}

async function getOrders(cookieHeader) {
  const { response, payload } = await request(`${BASE_URL}/api/cliente/orders`, {
    headers: { Cookie: cookieHeader },
  })

  assert.equal(response.status, 200, 'orders endpoint should return 200')
  return payload
}

try {
  const cookieA = await signInAndCollectCookie(USER_A.email, USER_A.password)
  const sessionA = await getSession(cookieA)
  const ordersA = await getOrders(cookieA)

  assert.equal(sessionA?.user?.email, USER_A.email, 'user A session must match the signed-in account')
  assert.ok(Array.isArray(ordersA.orders), 'user A orders response should be an array')

  const cookieB = await signUpAndCollectCookie(USER_B.email, USER_B.password, USER_B.name)
  const sessionB = await getSession(cookieB)
  const ordersB = await getOrders(cookieB)

  assert.equal(sessionB?.user?.email, USER_B.email, 'user B session must match the signed-up account')
  assert.ok(Array.isArray(ordersB.orders), 'user B orders response should be an array')

  console.log('AUTH_ISOLATION_CHECK: PASS')
  console.log(JSON.stringify({
    userA: sessionA.user.email,
    userB: sessionB.user.email,
    ordersA: ordersA.orders.length,
    ordersB: ordersB.orders.length,
  }, null, 2))
} catch (error) {
  console.error('AUTH_ISOLATION_CHECK: FAIL')
  console.error(error)
  process.exit(1)
}
