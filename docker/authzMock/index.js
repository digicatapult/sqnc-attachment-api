#!/usr/bin/env node

const http = require('node:http')

const port = 3000
const allow = process.env.ALLOW?.toLowerCase() === 'false' ? false : true
const responseBody = JSON.stringify({
  result: {
    allow,
  },
})

const server = http.createServer((req, res) => {
  const code = allow ? 200 : 401
  console.log('Responding to authorization request with:', code, responseBody)

  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(responseBody)
})

server.listen(port, () => {
  console.log(`Server running on ${port}`)
})
