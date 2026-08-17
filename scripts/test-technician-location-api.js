// Test script to verify technician location API

const testOrderId = 'test-order-123'
const testTechnicianId = 'tech-001'

// Simulating what the useTechnicianLocation hook would do
async function testLocationUpdate() {
  try {
    // Simulate the location update that the technician app would send
    const response = await fetch(`http://localhost:3000/api/technician/location/${testOrderId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, we would need proper authentication
      },
      body: JSON.stringify({
        lat: -33.8688,
        lng: -51.5093,
      }),
    })

    const data = await response.json()
    console.log('POST response:', response.status, data)

    // Now try to retrieve the location
    const getResponse = await fetch(`http://localhost:3000/api/technician/location/${testOrderId}`, {
      method: 'GET',
    })

    const getData = await getResponse.json()
    console.log('GET response:', getResponse.status, getData)
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testLocationUpdate()
