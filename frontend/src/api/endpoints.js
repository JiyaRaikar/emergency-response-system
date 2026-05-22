import client from './client'

export const fetchIncidents = (params) =>
  client.get('/api/incidents', { params }).then((r) => r.data)

export const createIncident = (payload) =>
  client.post('/api/incidents', payload).then((r) => r.data)

export const fetchResources = (params) =>
  client.get('/api/resources', { params }).then((r) => r.data)

export const fetchAlerts = (params) =>
  client.get('/api/alerts', { params }).then((r) => r.data)

export const fetchShelters = (params) =>
  client.get('/api/resources/shelters/all', { params }).then((r) => r.data)

export const sendCommand = (text) =>
  client.post('/api/command', { text }).then((r) => r.data)
