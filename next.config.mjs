import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { version } = require('./package.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
}

export default nextConfig
