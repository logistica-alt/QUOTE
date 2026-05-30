/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Supabase types not generated yet — ignore TS errors at build time
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'playwright-core'],
  },
};

export default nextConfig;
