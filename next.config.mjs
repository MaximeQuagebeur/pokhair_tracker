// Vercel (or CLOUD_BUILD=1): server build with the Turso API. Otherwise: static export bundled into Electron.
const isCloud = !!process.env.VERCEL || process.env.CLOUD_BUILD === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isCloud ? {} : { output: 'export' }),
  // `*.web.ts` files (API routes reading Turso) only exist in the cloud build.
  pageExtensions: isCloud ? ['web.ts', 'tsx', 'ts'] : ['tsx', 'ts'],
  env: { NEXT_PUBLIC_CLOUD: isCloud ? '1' : '' },
  trailingSlash: true,
  images: { unoptimized: true },
  agentRules: false,
};

export default nextConfig;
