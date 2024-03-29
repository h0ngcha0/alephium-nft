/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    //ENVIRONMENT: "development-nodewallet"
    ENVIRONMENT: "browser-extension"
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false;
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/my-nfts',
        permanent: true
      }
    ]
  }
}

module.exports = nextConfig
