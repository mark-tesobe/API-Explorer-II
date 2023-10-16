import * as jose from 'jose'

async function run (): Promise<void>{
  const secret = new TextEncoder().encode(
    'cc7e0d44fd473002f1c42167459001140ec6389b7353f8088f4d9a95f2f596f2',
  )
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1cm46ZXhhbXBsZTpjbGFpbSI6dHJ1ZSwiaWF0IjoxNjY5MDU2MjMxLCJpc3MiOiJ1cm46ZXhhbXBsZTppc3N1ZXIiLCJhdWQiOiJ1cm46ZXhhbXBsZTphdWRpZW5jZSJ9.C4iSlLfAUMBq--wnC6VqD9gEOhwpRZpoRarE0m7KEnI'

  const { payload, protectedHeader } = await jose.jwtVerify(jwt, secret, {
    issuer: 'urn:example:issuer',
    audience: 'urn:example:audience',
  })

  console.log(protectedHeader)
  console.log(payload)
}

(async ()=>{
  console.log("Running verify..")
  await run()
})()


