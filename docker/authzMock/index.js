const http = require('node:http') // eslint-disable-line @typescript-eslint/no-require-imports

const port = 3000
const allow = process.env.ALLOW?.toLowerCase() === 'false' ? false : true
const responseBody = JSON.stringify({
  result: {
    allow,
  },
})

const server = http.createServer((req, res) => {
  const code = allow ? 200 : 401
  // eslint-disable-next-line no-console
  console.log('Responding to authorization request with:', code, responseBody)

  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(responseBody)
})

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on ${port}`)
})
